# PowerShell script to set up and run the wolf prey network visualization on Windows
# Save this as setup.ps1

# Create necessary directories
Write-Host "Creating data directories..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "data" | Out-Null
New-Item -ItemType Directory -Force -Path "public\data" | Out-Null

# Check if R is installed and in PATH
$rInstalled = $null
try {
    $rInstalled = Get-Command Rscript -ErrorAction Stop
    Write-Host "Found R installation at: $($rInstalled.Source)" -ForegroundColor Green
} catch {
    Write-Host "Error: R does not appear to be installed or is not in your PATH" -ForegroundColor Red
    Write-Host "Please install R from https://cran.r-project.org/bin/windows/base/" -ForegroundColor Yellow
    Write-Host "After installing, make sure R's bin directory is in your PATH" -ForegroundColor Yellow
    exit 1
}

# Install required R packages if needed
Write-Host "Installing required R packages..." -ForegroundColor Cyan
Rscript -e "if (!require('rglobi')) install.packages('rglobi'); if (!require('dplyr')) install.packages('dplyr'); if (!require('jsonlite')) install.packages('jsonlite'); if (!require('taxize')) install.packages('taxize')"

# Run R script to fetch data for all predators
Write-Host "Fetching predator-prey data from GloBI..." -ForegroundColor Cyan
Rscript wolf-prey-network-real-data.r

# Copy JSON files to the public directory for the React app to access
Write-Host "Copying data files to public directory..." -ForegroundColor Cyan
Copy-Item -Path "data\*.json" -Destination "public\data\" -Force

# Create server.js file to serve the React app and handle API requests
Write-Host "Creating server.js file..." -ForegroundColor Cyan
$serverContent = @'
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
'@
Set-Content -Path "server.js" -Value $serverContent

# Create package.json if it doesn't exist
Write-Host "Setting up package.json..." -ForegroundColor Cyan
if (-not (Test-Path "package.json")) {
    $packageJsonContent = @'
{
  "name": "wolf-prey-network-visualization",
  "version": "1.0.0",
  "description": "Visualization of wolf prey networks using data from GloBI",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "fetch-data": "Rscript wolf-prey-network-real-data.r",
    "build": "webpack --mode production"
  },
  "dependencies": {
    "express": "^4.17.1",
    "react": "^17.0.2",
    "react-dom": "^17.0.2",
    "d3": "^7.0.0",
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "@babel/core": "^7.14.6",
    "@babel/preset-env": "^7.14.7",
    "@babel/preset-react": "^7.14.5",
    "babel-loader": "^8.2.2",
    "webpack": "^5.44.0",
    "webpack-cli": "^4.7.2"
  }
}
'@
    Set-Content -Path "package.json" -Value $packageJsonContent
}

# Create a simple React app structure if it doesn't exist
Write-Host "Setting up basic React app structure..." -ForegroundColor Cyan
if (-not (Test-Path "public\index.html")) {
    $indexHtmlContent = @'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wolf Prey Network Visualization</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
</head>
<body>
    <div id="root"></div>
    <script src="bundle.js"></script>
</body>
</html>
'@
    Set-Content -Path "public\index.html" -Value $indexHtmlContent
}

# Check if Node.js is installed
$nodeInstalled = $null
try {
    $nodeInstalled = Get-Command node -ErrorAction Stop
    $npmInstalled = Get-Command npm -ErrorAction Stop
    Write-Host "Found Node.js installation at: $($nodeInstalled.Source)" -ForegroundColor Green
    Write-Host "Found npm installation at: $($npmInstalled.Source)" -ForegroundColor Green
    
    # Install dependencies
    Write-Host "Installing Node.js dependencies..." -ForegroundColor Cyan
    npm install
} catch {
    Write-Host "Node.js or npm does not appear to be installed or is not in your PATH" -ForegroundColor Yellow
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "After installing, you'll need to run 'npm install' manually" -ForegroundColor Yellow
}

Write-Host "`nSetup complete! You can now build and run the application." -ForegroundColor Green
Write-Host "To fetch data for all predators: npm run fetch-data" -ForegroundColor Cyan
Write-Host "To start the server: npm start" -ForegroundColor Cyan

# Provide instructions on how to run in PowerShell
Write-Host "`nIMPORTANT: If you get a script execution policy error, you may need to run:" -ForegroundColor Yellow
Write-Host "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass" -ForegroundColor Yellow
Write-Host "Then run the script again: .\setup.ps1" -ForegroundColor Yellow
