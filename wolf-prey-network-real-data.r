# Install and load required packages
if (!require("rglobi")) install.packages("rglobi")
if (!require("dplyr")) install.packages("dplyr")
if (!require("jsonlite")) install.packages("jsonlite")
if (!require("taxize")) install.packages("taxize")

library(rglobi)
library(dplyr)
library(jsonlite)
library(taxize)

# Function to get taxonomic information for a species with improved error handling
get_taxonomy <- function(species_name) {
  tryCatch({
    # Get taxonomic classification from GBIF
    cat("Looking up taxonomy for:", species_name, "\n")
    tax_info <- classification(species_name, db = "gbif")
    
    # Debug information
    cat("  Received taxonomy data type:", class(tax_info), "\n")
    
    # Check if tax_info is NULL or empty
    if (is.null(tax_info) || length(tax_info) == 0) {
      cat("  No taxonomy data found\n")
      return(NULL)
    }
    
    # The result is a list where each element corresponds to a queried name
    # Get the first element (our species)
    species_info <- tax_info[[1]]
    
    # Check if species_info is NULL or not a data frame
    if (is.null(species_info)) {
      cat("  Taxonomy data is NULL for this species\n")
      return(NULL)
    }
    
    if (!is.data.frame(species_info)) {
      cat("  Unexpected taxonomy data format:", class(species_info), "\n")
      return(NULL)
    }
    
    # Check if the data frame has the expected columns
    if (!"rank" %in% colnames(species_info) || !"name" %in% colnames(species_info)) {
      cat("  Taxonomy data is missing expected columns\n")
      return(NULL)
    }
    
    return(species_info)
  }, error = function(e) {
    cat("  Error in taxonomy lookup:", conditionMessage(e), "\n")
    return(NULL)
  })
}

# Function to check if a target function has a specific parameter
has_parameter <- function(func_name, param_name) {
  tryCatch({
    params <- names(formals(func_name))
    return(param_name %in% params)
  }, error = function(e) {
    return(FALSE)
  })
}

# Function to fetch predator prey data and create JSON structure
fetch_predator_prey_data <- function(predator_taxon = "Canis lupus", output_dir = ".") {
  cat("\n==================================================\n")
  cat("Fetching interaction data for", predator_taxon, "\n")
  cat("==================================================\n")
  
  # Get common name for the predator
  predator_info <- get_taxonomy(predator_taxon)
  predator_common_name <- predator_taxon
  
  if (!is.null(predator_info)) {
    # Try to find the common name from the taxonomy
    if ("rank" %in% colnames(predator_info) && "name" %in% colnames(predator_info)) {
      common_name_row <- which(predator_info$rank == "species")
      if (length(common_name_row) > 0) {
        predator_common_name <- predator_info$name[common_name_row]
      }
    }
  }
  
  # Check if get_interactions_by_taxa supports the limit parameter
  can_use_limit <- has_parameter("get_interactions_by_taxa", "limit")
  
  # Initialize empty data frame for all interactions
  all_interactions <- data.frame()
  
  # Define interaction types to fetch
  interaction_types <- c("preysOn", "eats", "pollinates")
  
  # Fetch data for each interaction type
  for(interaction_type in interaction_types) {
    cat("Attempting to fetch data with '", interaction_type, "' interaction type...\n")
    if (can_use_limit) {
      interaction_data <- get_interactions_by_taxa(sourcetaxon = predator_taxon, 
                                                 interactiontype = interaction_type,
                                                 limit = 1000)
    } else {
      interaction_data <- get_interactions_by_taxa(sourcetaxon = predator_taxon, 
                                                 interactiontype = interaction_type)
    }
    
    if(nrow(interaction_data) > 0) {
      # Add interaction type column
      interaction_data$interaction_type <- interaction_type
      all_interactions <- rbind(all_interactions, interaction_data)
    }
  }
  
  # Data cleaning and processing
  if(nrow(all_interactions) > 0) {
    cat("Found", nrow(all_interactions), "total interactions for", predator_taxon, "\n")
    
    # Select relevant columns
    prey_data <- all_interactions %>%
      select(target_taxon_name, target_taxon_path, interaction_type) %>%
      distinct()
    
    cat("Processing", nrow(prey_data), "unique target species\n")
    
    # Create data frame to store taxonomic information
    taxonomy_data <- data.frame(
      species = character(0),
      kingdom = character(0),
      class = character(0),
      order = character(0),
      family = character(0),
      scientific_name = character(0),
      interaction_type = character(0),
      stringsAsFactors = FALSE
    )
    
    # Process each target species
    for(i in 1:nrow(prey_data)) {
      species_name <- prey_data$target_taxon_name[i]
      interaction_type <- prey_data$interaction_type[i]
      cat("Processing species", i, "of", nrow(prey_data), ":", species_name, "(", interaction_type, ")\n")
      
      # Try to get taxonomy from taxize
      tax_info <- get_taxonomy(species_name)
      
      if(!is.null(tax_info) && is.data.frame(tax_info) && 
         "rank" %in% colnames(tax_info) && "name" %in% colnames(tax_info)) {
        # Extract kingdom, class, order, and family information
        kingdom_row <- which(tax_info$rank == "kingdom")
        class_row <- which(tax_info$rank == "class")
        order_row <- which(tax_info$rank == "order")
        family_row <- which(tax_info$rank == "family")
        
        kingdom <- if(length(kingdom_row) > 0) tax_info$name[kingdom_row] else "Unknown"
        class <- if(length(class_row) > 0) tax_info$name[class_row] else "Unknown"
        order <- if(length(order_row) > 0) tax_info$name[order_row] else "Unknown"
        family <- if(length(family_row) > 0) tax_info$name[family_row] else "Unknown"
        
        # Add to taxonomy data
        taxonomy_data <- rbind(taxonomy_data, data.frame(
          species = species_name,
          kingdom = kingdom,
          class = class,
          order = order,
          family = family,
          scientific_name = species_name,
          interaction_type = interaction_type,
          stringsAsFactors = FALSE
        ))
        
        cat("  Added taxonomy: Kingdom:", kingdom, "- Class:", class, "- Family:", family, "\n")
      } else {
        # If taxonomy lookup fails, use the taxonomic path from GloBI if available
        if(!is.na(prey_data$target_taxon_path[i])) {
          cat("  Using taxonomic path from GloBI\n")
          path <- unlist(strsplit(prey_data$target_taxon_path[i], "\\|"))
          
          # Try to extract taxonomy information from path
          kingdom <- "Unknown"
          class <- "Unknown"
          order <- "Unknown"
          family <- "Unknown"
          
          for(item in path) {
            if(grepl("kingdom:", item)) kingdom <- gsub("kingdom:", "", item)
            if(grepl("class:", item)) class <- gsub("class:", "", item)
            if(grepl("order:", item)) order <- gsub("order:", "", item)
            if(grepl("family:", item)) family <- gsub("family:", "", item)
          }
          
          # Add to taxonomy data
          taxonomy_data <- rbind(taxonomy_data, data.frame(
            species = species_name,
            kingdom = kingdom,
            class = class,
            order = order,
            family = family,
            scientific_name = species_name,
            interaction_type = interaction_type,
            stringsAsFactors = FALSE
          ))
          
          cat("  Added taxonomy from path: Kingdom:", kingdom, "- Class:", class, "- Family:", family, "\n")
        } else {
          # If no taxonomy information is available at all, add with Unknown values
          cat("  No taxonomy information available, adding as Unknown\n")
          taxonomy_data <- rbind(taxonomy_data, data.frame(
            species = species_name,
            kingdom = "Unknown",
            class = "Unknown",
            order = "Unknown",
            family = "Unknown",
            scientific_name = species_name,
            interaction_type = interaction_type,
            stringsAsFactors = FALSE
          ))
        }
      }
    }
    
    # Count occurrences of each target species to use as a value for visualization weight
    interaction_counts <- all_interactions %>%
      group_by(target_taxon_name, interaction_type) %>%
      summarize(count = n()) %>%
      rename(species = target_taxon_name)
    
    # Join taxonomy data with counts
    prey_data_complete <- left_join(taxonomy_data, interaction_counts, by = c("species", "interaction_type"))
    
    # Replace NA counts with 1
    prey_data_complete$count[is.na(prey_data_complete$count)] <- 1
    
    # Filter out unknown kingdoms and only keep animal kingdoms
    animal_kingdoms <- c("Animalia", "Metazoa")
    prey_data_filtered <- prey_data_complete %>%
      filter(kingdom %in% animal_kingdoms | 
             class %in% c("Mammalia", "Aves", "Actinopterygii", "Reptilia", "Amphibia") |
             kingdom == "Unknown" | class == "Unknown")  # Include Unknown classifications
    
    # If kingdom is unknown but class is known animal class, assign to Animalia
    prey_data_filtered$kingdom[prey_data_filtered$kingdom == "Unknown" & 
                              prey_data_filtered$class %in% c("Mammalia", "Aves", "Actinopterygii", "Reptilia", "Amphibia")] <- "Animalia"
    
    # Sort by count (descending)
    prey_data_filtered <- prey_data_filtered %>%
      arrange(desc(count))
    
    cat("After filtering, found", nrow(prey_data_filtered), "target species\n")
    
    # Create hierarchical JSON structure for visualization
    hierarchy <- list(
      name = paste0(predator_common_name, " (", predator_taxon, ")"),
      children = list()
    )
    
    # Add kingdoms as first level
    unique_kingdoms <- unique(prey_data_filtered$kingdom)
    for(k in unique_kingdoms) {
      kingdom_children <- list()
      kingdom_data <- prey_data_filtered %>% filter(kingdom == k)
      
      # Add families as second level
      unique_families <- unique(kingdom_data$family)
      for(f in unique_families) {
        family_children <- list()
        family_data <- kingdom_data %>% filter(family == f)
        
        # Add species as third level
        for(i in 1:nrow(family_data)) {
          species_item <- list(
            name = paste0(family_data$species[i], " (", family_data$species[i], ")"),
            value = as.numeric(family_data$count[i]),
            interaction_type = family_data$interaction_type[i]  # Add interaction type to the visualization
          )
          family_children[[length(family_children) + 1]] <- species_item
        }
        
        family_item <- list(
          name = f,
          children = family_children
        )
        kingdom_children[[length(kingdom_children) + 1]] <- family_item
      }
      
      kingdom_item <- list(
        name = k,
        children = kingdom_children
      )
      hierarchy$children[[length(hierarchy$children) + 1]] <- kingdom_item
    }
    
    # Convert to JSON
    json_data <- toJSON(hierarchy, auto_unbox = TRUE, pretty = TRUE)
    
    # Create output filename
    output_filename <- gsub(" ", "_", predator_taxon)
    output_path <- file.path(output_dir, paste0(output_filename, "_prey_hierarchy.json"))
    
    # Ensure output directory exists
    dir.create(dirname(output_path), showWarnings = FALSE, recursive = TRUE)
    
    # Save to file
    write(json_data, output_path)
    cat("Data saved to", output_path, "\n")
    
    # Output some statistics
    cat("\nSummary of", predator_taxon, "Interaction Data:\n")
    cat("Total target species found:", nrow(prey_data_filtered), "\n")
    cat("Kingdoms represented:", paste(unique_kingdoms, collapse = ", "), "\n")
    cat("Number of families:", length(unique(prey_data_filtered$family)), "\n")
    cat("Interaction types:", paste(unique(prey_data_filtered$interaction_type), collapse = ", "), "\n")
    cat("Top 5 target species by frequency:\n")
    top_prey <- prey_data_filtered %>% 
      select(species, family, interaction_type, count) %>% 
      head(5)
    print(top_prey)
    
    return(TRUE)
  } else {
    cat("No interaction data found in GloBI database for", predator_taxon, "\n")
    return(FALSE)
  }
}

# Main execution script
# Check if command line arguments were provided
args <- commandArgs(trailingOnly = TRUE)

if (length(args) > 0) {
  # Use the first argument as the predator taxon
  predator_taxon <- args[1]
  
  # Use the second argument as the output directory if provided
  output_dir <- if (length(args) > 1) args[2] else "."
  
  # Fetch data for the specified predator
  fetch_predator_prey_data(predator_taxon, output_dir)
} else {
  # Default predators to process if no arguments provided
  predators <- c(
    "Canis lupus"      # Gray wolf - start with just one for testing
  )
  
  # Create output directory
  output_dir <- "data"
  if (!dir.exists(output_dir)) {
    dir.create(output_dir, recursive = TRUE)
  }
  
  # Process each predator
  for (predator in predators) {
    fetch_predator_prey_data(predator, output_dir)
    # Add a small delay to avoid overwhelming the API
    Sys.sleep(2)
  }
}
