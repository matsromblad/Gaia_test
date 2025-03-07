const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));
app.use('/data', express.static('public/data'));

// API endpoint to fetch fresh data for a predator
app.post('/api/fetch-predator-data', (req, res) => {
  const predator = req.query.predator;
  
  if (!predator) {
    return res.status(400).json({ error: 'Predator taxon is required' });
  }
  
  console.log(`Fetching fresh data for ${predator}...`);
  
  // Execute R script with the predator taxon - use double quotes for Windows paths
  exec(`Rscript wolf-prey-network-real-data.r "${predator}" "public\\data"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return res.status(500).json({ error: 'Failed to fetch data', details: error.message });
    }
    
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }
    
    console.log(`stdout: ${stdout}`);
    res.json({ success: true, message: 'Data fetched successfully' });
  });
});

// Serve the React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
