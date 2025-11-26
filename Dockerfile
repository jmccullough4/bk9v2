FROM node:18-bullseye

# Install system dependencies for Bluetooth, GPS, and Serial
RUN apt-get update && apt-get install -y \
    bluetooth \
    bluez \
    libbluetooth-dev \
    libudev-dev \
    python3 \
    python3-pip \
    gpsd \
    gpsd-clients \
    build-essential \
    usbutils \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --legacy-peer-deps

# Copy application files
COPY . .

# Build Next.js application
RUN npm run build

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start script
CMD ["npm", "start"]
