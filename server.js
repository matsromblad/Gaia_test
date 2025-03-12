const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Add JSON body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));
app.use('/data', express.static('public/data'));

// API endpoint to fetch fresh data for a predator
app.post('/api/fetch-predator-data', (req, res) => {
  const predator = req.query.predator;
  
  if (!predator) {
    return res.status(400).json({ success: false, error: 'Predator taxon is required' });
  }
  
  console.log(`Fetching fresh data for ${predator}...`);
  
  // Sanitize the predator input to prevent command injection
  // Only allow alphanumeric characters, spaces, and some special characters used in scientific names
  const sanitizedPredator = predator.replace(/[^a-zA-Z0-9 \.]/g, '');
  
  if (sanitizedPredator !== predator) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid characters in predator name. Please use only letters, numbers, spaces, and periods.' 
    });
  }
  
  // Create the data directory if it doesn't exist
  const dataDir = path.join(__dirname, 'public', 'data');
  const { execSync } = require('child_process');
  try {
    execSync(`mkdir -p "${dataDir}"`);
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
  
  // Set a timeout for the R script (10 minutes)
  const timeout = 600000;
  
  // Execute R script with the predator taxon - use appropriate path formats
  const isWindows = process.platform === 'win32';
  const dataPath = isWindows ? "public\\data" : "public/data";
  
  const command = `Rscript wolf-prey-network-real-data.r "${sanitizedPredator}" "${dataPath}"`;
  
  const childProcess = exec(command, { timeout }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      
      // Check if it's a timeout error
      if (error.signal === 'SIGTERM') {
        return res.status(504).json({ 
          success: false, 
          error: 'Request timed out. The data fetch took too long to complete.' 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch data', 
        details: error.message 
      });
    }
    
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      // Some R scripts output warnings to stderr but still succeed
      // Only treat this as an error if it contains specific error patterns
      if (stderr.includes('Error:') || stderr.includes('could not find')) {
        return res.status(500).json({ 
          success: false, 
          error: 'R script reported an error', 
          details: stderr 
        });
      }
    }
    
    console.log(`stdout: ${stdout}`);
    
    // Check if the output file was created
    const outputFilePath = path.join(
      dataDir, 
      `${sanitizedPredator.replace(' ', '_')}_prey_hierarchy.json`
    );
    
    const fs = require('fs');
    if (!fs.existsSync(outputFilePath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Data file was not created. The species may not exist in the GloBI database.' 
      });
    }
    
    res.json({ success: true, message: 'Data fetched successfully' });
  });
  
  // Log when the process starts
  console.log(`Started R process for ${predator} with PID: ${childProcess.pid}`);
  
  // Set up error handling for the child process
  childProcess.on('error', (error) => {
    console.error(`Child process error: ${error.message}`);
  });
});

// API endpoint for species autocompletion (for future enhancement)
app.get('/api/suggest-species', (req, res) => {
  const query = req.query.q;
  
  if (!query || query.length < 3) {
    return res.json({ suggestions: [] });
  }
  
  // For now, we'll return a static list for demonstration
  // In a production environment, this would call an external API
  const suggestions = [
    { id: "Panthera leo", name: "Lion (Panthera leo)" },
    { id: "Panthera tigris", name: "Tiger (Panthera tigris)" },
    { id: "Ursus arctos", name: "Brown bear (Ursus arctos)" },
    { id: "Canis lupus", name: "Gray wolf (Canis lupus)" },
    { id: "Vulpes vulpes", name: "Red fox (Vulpes vulpes)" }
  ].filter(item => 
    item.id.toLowerCase().includes(query.toLowerCase()) || 
    item.name.toLowerCase().includes(query.toLowerCase())
  );
  
  res.json({ suggestions });
});

// Serve the React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
