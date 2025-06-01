# Predator-Prey Network Visualization

A web application that visualizes predator-prey relationships using data from the Global Biotic Interactions (GloBI) database. The application provides an interactive radial tree visualization of prey networks for different predators, with a focus on the Gray Wolf (Canis lupus) as the default example.

## Features

- Interactive radial tree visualization of predator-prey relationships
- Real-time data fetching from GloBI database
- Taxonomic classification of prey species
- Search functionality for different predators
- Responsive design with modern UI
- Wikipedia integration for species information
- Pan and zoom capabilities for the visualization

## Prerequisites

- Node.js (v16 or higher)
- R (for data processing)
- Required R packages:
  - rglobi
  - dplyr
  - jsonlite
  - taxize

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd [repository-name]
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Install R packages:
```R
Rscript -e "install.packages(c('rglobi', 'dplyr', 'jsonlite', 'taxize'), repos='https://cloud.r-project.org/')"
```

4. Run the setup script (Windows):
```powershell
.\setup.ps1
```

## Usage

1. Start the application:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:8089
```

3. The application will load with the default Gray Wolf (Canis lupus) prey network visualization.

4. Use the search functionality to explore prey networks for other predators.

## Data Processing

The application uses an R script (`wolf-prey-network-real-data.r`) to:
- Fetch predator-prey interaction data from GloBI
- Process and classify prey species taxonomically
- Generate hierarchical JSON data for visualization
- Store results in a temporary data directory

## Development

- Build the application:
```bash
npm run build
```

- Run in development mode with hot reloading:
```bash
npm run dev
```

- Fetch fresh data for all predators:
```bash
npm run fetch-data
```

## Docker Support

The application includes a Dockerfile for containerized deployment:

```bash
docker build -t predator-prey-viz .
docker run -p 8089:8089 predator-prey-viz
```

## Technologies Used

- Frontend:
  - React
  - D3.js
  - Tailwind CSS
- Backend:
  - Node.js
  - Express
- Data Processing:
  - R
  - GloBI API
- Development:
  - Webpack
  - Babel

## License

[Add your license information here]

## Contributing

[Add contribution guidelines here] 