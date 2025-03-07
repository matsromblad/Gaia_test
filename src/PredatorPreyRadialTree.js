import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import _ from 'lodash';

const IlluminumStyledPredatorPreyTree = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPredator, setSelectedPredator] = useState("Canis lupus");
  const [availablePredators, setAvailablePredators] = useState([]);
  
  // Create a ref for the visualization container
  const vizRef = useRef(null);

  // Illuminum brand colors
  const brandColors = {
    darkPurple: "#2D217A",
    sunriseYellow: "#F2AF29",
    glacierBlue: "#2FACBC",
    grassGreen: "#4DA02D",
    flamingRed: "#F25C33",
    carbonBlack: "#1C1D20",
    mediumGrey: "#4B4B4B",
    lightGrey: "#D2D2D2",
    pureWhite: "#FFFFFF"
  };

  useEffect(() => {
    // Initialize the list of available predators
    setAvailablePredators([
      { id: "Canis lupus", name: "Gray wolf (Canis lupus)" },
      { id: "Canis latrans", name: "Coyote (Canis latrans)" },
      { id: "Canis aureus", name: "Golden jackal (Canis aureus)" },
      { id: "Vulpes vulpes", name: "Red fox (Vulpes vulpes)" },
      { id: "Lycaon pictus", name: "African wild dog (Lycaon pictus)" }
    ]);
  }, []);

  useEffect(() => {
    // Load data for the selected predator
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Path to the JSON file
        const jsonFilePath = `/data/${selectedPredator.replace(' ', '_')}_prey_hierarchy.json`;
        console.log("Attempting to load data from:", jsonFilePath);
        
        try {
          // Fetch the data from the JSON file
          const response = await fetch(jsonFilePath);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
          }
          
          const predatorData = await response.json();
          console.log("Successfully loaded data:", predatorData.name);
          console.log("Data structure:", predatorData);
          setData(predatorData);
        } catch (fetchError) {
          console.error("Error fetching JSON data: ", fetchError);
          
          // If we can't fetch the specific predator data, try using the default wolf data
          if (selectedPredator !== "Canis lupus") {
            console.log("Attempting to fetch default wolf data instead...");
            
            const defaultResponse = await fetch('/data/Canis_lupus_prey_hierarchy.json');
            
            if (!defaultResponse.ok) {
              throw new Error("Failed to fetch even the default wolf data");
            }
            
            const defaultData = await defaultResponse.json();
            
            // Modify the title to indicate we're using default data
            defaultData.name = `${selectedPredator} (using Gray wolf data)`;
            setData(defaultData);
          } else {
            throw fetchError; // Re-throw the error if we're already trying to fetch wolf data
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Failed to load data:", err.message);
        setError("Failed to load data. Error: " + err.message);
        setLoading(false);
      }
    };

    loadData();
  }, [selectedPredator]);

  const handlePredatorChange = (e) => {
    setSelectedPredator(e.target.value);
  };

  const handlePredatorDataFetch = async () => {
    try {
      setLoading(true);
      // This would trigger the server-side R script to fetch new data for the selected predator
      const response = await fetch(`/api/fetch-predator-data?predator=${selectedPredator}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to trigger data fetch: ${response.statusText}`);
      }
      
      // After successful trigger, reload the data
      const jsonFilePath = `/data/${selectedPredator.replace(' ', '_')}_prey_hierarchy.json`;
      const dataResponse = await fetch(jsonFilePath);
      
      if (!dataResponse.ok) {
        throw new Error(`Failed to fetch new data: ${dataResponse.statusText}`);
      }
      
      const predatorData = await dataResponse.json();
      setData(predatorData);
      setLoading(false);
    } catch (err) {
      setError("Failed to fetch new predator data: " + err.message);
      setLoading(false);
    }
  };

  // This effect runs when data changes or the container is available
  useEffect(() => {
    if (!data || !vizRef.current) {
      console.log("Missing prerequisites for visualization:", { 
        hasData: !!data, 
        hasVizRef: !!vizRef.current 
      });
      return;
    }
    
    console.log("Starting visualization with data:", data.name);
    
    try {
      // Get container and clear it completely
      const vizContainer = vizRef.current;
      vizContainer.innerHTML = ''; // More reliable clearing method in React
      
      const width = 900;
      const height = 900;
      const radius = width / 2;

      // Create SVG element with proper namespace
      const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svgElement.setAttribute("width", width);
      svgElement.setAttribute("height", height);
      svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`);
      svgElement.style.maxWidth = "100%";
      svgElement.style.height = "auto";
      vizContainer.appendChild(svgElement);
      
      // Create a group for centering the visualization
      const gElement = document.createElementNS("http://www.w3.org/2000/svg", "g");
      gElement.setAttribute("transform", `translate(${width/2},${height/2})`);
      svgElement.appendChild(gElement);
      
      // Now use D3 to select the elements we created
      const svg = d3.select(gElement);
      
      // Create a radial tree layout
      const tree = d3.tree()
        .size([2 * Math.PI, radius - 100])
        .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

      // Convert hierarchical data
      const root = d3.hierarchy(data)
        .sort((a, b) => d3.ascending(a.data.name, b.data.name));

      // Generate tree layout
      tree(root);
      
      console.log("Tree layout generated with nodes:", root.descendants().length);

      // Use Illuminum brand colors for the visualization
      const classColorMap = {
        "Mammalia": brandColors.grassGreen,
        "Aves": brandColors.sunriseYellow,
        "Actinopterygii": brandColors.glacierBlue,
        "Reptilia": brandColors.flamingRed,
        "Amphibia": "#b3de69",
        "Unknown": brandColors.mediumGrey
      };

      // Infer class from family for better categorization
      const familyClassMap = {};
      const mammalFamilies = ["Cervidae", "Bovidae", "Leporidae", "Castoridae", "Suidae", "Cricetidae", "Canidae", "Mustelidae", "Sciuridae"];
      const birdFamilies = ["Phasianidae", "Anatidae", "Corvidae", "Tetraonidae"];
      const fishFamilies = ["Salmonidae", "Cyprinidae", "Esocidae"];
      
      mammalFamilies.forEach(f => { familyClassMap[f] = "Mammalia"; });
      birdFamilies.forEach(f => { familyClassMap[f] = "Aves"; });
      fishFamilies.forEach(f => { familyClassMap[f] = "Actinopterygii"; });

      // Add links
      svg.selectAll(".link")
        .data(root.links())
        .join("path")
        .attr("class", "link")
        .attr("d", d3.linkRadial()
          .angle(d => d.x)
          .radius(d => d.y))
        .style("fill", "none")
        .style("stroke", d => {
          if (d.target.depth === 2) {
            const family = d.target.data.name;
            const classType = familyClassMap[family] || "Unknown";
            return classColorMap[classType];
          } else if (d.target.depth === 3) {
            const family = d.target.parent.data.name;
            const classType = familyClassMap[family] || "Unknown";
            return classColorMap[classType];
          }
          return brandColors.lightGrey;
        })
        .style("stroke-width", d => d.target.data.value ? Math.sqrt(d.target.data.value) / 2 : 1.5)
        .style("stroke-opacity", 0.6);

      console.log("Links created, now adding nodes");

      // Helper function to calculate radial points
      function radialPoint(x, y) {
        return [(y = +y) * Math.cos(x -= Math.PI / 2), y * Math.sin(x)];
      }

      // Add nodes
      const node = svg.selectAll(".node")
        .data(root.descendants())
        .join("g")
        .attr("class", d => `node ${d.children ? "node--internal" : "node--leaf"}`)
        .attr("transform", d => {
          // Special case for the root node (predator)
          if (d.depth === 0) {
            return `translate(0,0)`; // Position at center
          }
          return `translate(${radialPoint(d.x, d.y)})`;
        });

      // Special handling for root node (predator)
      node.filter(d => d.depth === 0)
        .append("circle")
        .attr("r", 50)
        .style("fill", brandColors.darkPurple)
        .style("stroke", brandColors.pureWhite)
        .style("stroke-width", 2);

      // Add circles to non-root nodes
      node.filter(d => d.depth !== 0)
        .append("circle")
        .attr("r", d => {
          if (d.depth === 1) return 8;  // Kingdom
          if (d.depth === 2) return 6;  // Family
          return d.data.value ? Math.sqrt(d.data.value) / 1.5 : 4; // Species
        })
        .style("fill", d => {
          if (d.depth === 2) {
            const family = d.data.name;
            const classType = familyClassMap[family] || "Unknown";
            return classColorMap[classType];
          }
          if (d.depth === 3) {
            const family = d.parent.data.name;
            const classType = familyClassMap[family] || "Unknown";
            return classColorMap[classType];
          }
          return brandColors.mediumGrey; // Default
        })
        .style("stroke", brandColors.pureWhite)
        .style("stroke-width", 1.5);

      console.log("Nodes created, now adding labels");

      // Special label for root node (horizontal text in center)
      node.filter(d => d.depth === 0)
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .text(d => {
          const name = d.data.name;
          const match = name.match(/(.+?) \((.+?)\)/);
          return match ? match[2] : name; // Scientific name
        })
        .style("font-family", "'Kanit', sans-serif")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", brandColors.pureWhite);

      // Add common name below scientific name for root
      node.filter(d => d.depth === 0)
        .append("text")
        .attr("text-anchor", "middle")
        .attr("y", 20)
        .text(d => {
          const name = d.data.name;
          const match = name.match(/(.+?) \((.+?)\)/);
          return match ? match[1] : ""; // Common name
        })
        .style("font-family", "'Roboto', sans-serif")
        .style("font-size", "12px")
        .style("fill", brandColors.pureWhite);

      // Add labels to non-root nodes
      node.filter(d => d.depth !== 0)
        .append("text")
        .attr("dy", "0.31em")
        .attr("x", d => (d.x < Math.PI === !d.children) ? 6 : -6)
        .attr("text-anchor", d => (d.x < Math.PI === !d.children) ? "start" : "end")
        .attr("transform", d => `rotate(${(d.x < Math.PI ? d.x - Math.PI / 2 : d.x + Math.PI / 2) * 180 / Math.PI})`)
        .text(d => {
          // Shorten long names
          const name = d.data.name;
          if (d.depth === 3) {
            // Extract common name from parenthesis
            const match = name.match(/(.+?) \((.+?)\)/);
            return match ? match[1] : name;
          }
          return name;
        })
        .style("font-family", d => {
          if (d.depth === 1) return "'Kanit', sans-serif";
          return "'Roboto', sans-serif";
        })
        .style("font-size", d => {
          if (d.depth === 1) return "14px";
          if (d.depth === 2) return "12px";
          return "10px";
        })
        .style("font-weight", d => d.depth < 2 ? "bold" : "normal")
        .style("fill", brandColors.carbonBlack);

      // Add legend
      const legend = svg.append("g")
        .attr("transform", `translate(${-radius + 50}, ${-radius + 50})`);
        
      const classes = ["Mammalia", "Aves", "Actinopterygii"];
      
      classes.forEach((className, i) => {
        const legendRow = legend.append("g")
          .attr("transform", `translate(0, ${i * 25})`);
          
        legendRow.append("rect")
          .attr("width", 20)
          .attr("height", 20)
          .attr("fill", classColorMap[className]);
          
        legendRow.append("text")
          .attr("x", 30)
          .attr("y", 15)
          .text(className)
          .style("font-family", "'Roboto', sans-serif")
          .style("font-size", "15px");
      });

      // Add title and subtitle in Illuminum brand style
      svg.append("text")
        .attr("x", 0)
        .attr("y", -radius + 20)
        .attr("text-anchor", "middle")
        .style("font-family", "'Kanit', sans-serif")
        .style("font-size", "24px")
        .style("font-weight", "bold")
        .style("fill", brandColors.darkPurple)
        .text(`${data.name.split(' (')[0]} Prey Network`);
        
      svg.append("text")
        .attr("x", 0)
        .attr("y", -radius + 50)
        .attr("text-anchor", "middle")
        .style("font-family", "'Roboto', sans-serif")
        .style("font-size", "16px")
        .style("font-style", "italic")
        .style("fill", brandColors.mediumGrey)
        .text("Data from Global Biotic Interactions (GloBI)");

      // Add instructions
      svg.append("text")
        .attr("x", 0)
        .attr("y", radius - 40)
        .attr("text-anchor", "middle")
        .style("font-family", "'Roboto', sans-serif")
        .style("font-size", "14px")
        .style("font-style", "italic")
        .style("fill", brandColors.mediumGrey)
        .text("* Circle size indicates relative frequency in GloBI records");
        
      console.log("Visualization created successfully");
    } catch (vizError) {
      console.error("Error creating visualization:", vizError);
      
      // Add error message to the visualization container
      const vizContainer = vizRef.current;
      vizContainer.innerHTML = '';
      
      const errorDiv = document.createElement("div");
      errorDiv.style.color = brandColors.flamingRed;
      errorDiv.style.padding = "20px";
      errorDiv.style.fontFamily = "'Roboto', sans-serif";
      errorDiv.textContent = `Visualization Error: ${vizError.message}`;
      vizContainer.appendChild(errorDiv);
    }
  }, [data, brandColors]);


  return (
    <div className="flex flex-col items-center p-4">
      <div className="w-full max-w-2xl mb-4">
        <div className="flex flex-row justify-between items-center">
          <h2 className="text-xl">Predator-Prey Network Visualization</h2>
          <div className="flex space-x-4">
            <div className="relative inline-block w-64">
              <label htmlFor="predator-select" className="block text-sm font-medium mb-1" style={{color: brandColors.mediumGrey}}>
                Select Predator:
              </label>
              <select
                id="predator-select"
                className="block w-full p-2 border rounded-md shadow-sm focus:outline-none"
                value={selectedPredator}
                onChange={handlePredatorChange}
                style={{borderColor: brandColors.lightGrey, color: brandColors.carbonBlack}}
              >
                {availablePredators.map(predator => (
                  <option key={predator.id} value={predator.id}>
                    {predator.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handlePredatorDataFetch}
              className="px-4 py-2 rounded-md hover:opacity-90 focus:outline-none focus:ring-2"
              style={{backgroundColor: brandColors.glacierBlue, color: brandColors.pureWhite}}
            >
              Fetch Fresh Data
            </button>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center h-64 text-lg font-medium" style={{color: brandColors.darkPurple}}>
          <div className="flex flex-col items-center">
            <svg className="animate-spin -ml-1 mr-3 h-10 w-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading predation data from GloBI...</span>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 rounded" style={{backgroundColor: "#FEF2F2", color: brandColors.flamingRed}}>{error}</div>
      ) : (
        <div 
          ref={vizRef}
          className="overflow-auto p-4 border rounded-lg shadow-sm" 
          style={{ width: "100%", height: "800px", maxWidth: "1000px", backgroundColor: brandColors.pureWhite, borderColor: brandColors.lightGrey }}
        ></div>
      )}
      
      <div className="mt-4 p-6 rounded max-w-2xl" style={{backgroundColor: "#F9FAFB"}}>
        <div className="flex items-start mb-4">
          <div className="mr-3 pt-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 16V12M12 8H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" 
                stroke={brandColors.darkPurple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2" style={{color: brandColors.darkPurple}}>About this Visualization</h3>
            <p className="mb-2">This radial tree shows predator-prey relationships between the selected predator and their prey species, based on data from the Global Biotic Interactions database (GloBI).</p>
            <p className="mb-2 print-text">The data was extracted using the rglobi R package and processed to categorize prey species by taxonomic family and class. Circle size indicates the relative frequency of each prey item in the database records.</p>
            <p className="text-sm italic" style={{color: brandColors.mediumGrey}}>Note: Select different predators from the dropdown menu and click "Fetch Fresh Data" to retrieve their prey networks from GloBI.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IlluminumStyledPredatorPreyTree;
