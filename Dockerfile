FROM node:16

# Install R and required dependencies
RUN apt-get update && apt-get install -y \
    r-base \
    r-base-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev

# Install required R packages
RUN R -e "install.packages(c('rglobi', 'dplyr', 'jsonlite', 'taxize'), repos='https://cloud.r-project.org/')"

# Set up application
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Create writable directory for data
RUN mkdir -p /tmp/data && chmod 777 /tmp/data

# Expose port
EXPOSE 8080

# Start application
CMD ["node", "server.js"]