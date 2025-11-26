#!/bin/bash

set -e

echo "========================================="
echo "  BlueK9 Client Startup Script"
echo "========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running in Docker or native
if [ -f /.dockerenv ]; then
    echo -e "${BLUE}Running in Docker container${NC}"
    DOCKER_MODE=true
else
    DOCKER_MODE=false
fi

# Function to check dependencies
check_dependencies() {
    echo "Checking dependencies..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Error: Node.js not found. Please install Node.js 18 or later.${NC}"
        echo "Visit: https://nodejs.org/"
        exit 1
    else
        NODE_VERSION=$(node -v)
        echo -e "${GREEN}✓ Node.js ${NODE_VERSION}${NC}"
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}Error: npm not found.${NC}"
        exit 1
    else
        NPM_VERSION=$(npm -v)
        echo -e "${GREEN}✓ npm ${NPM_VERSION}${NC}"
    fi

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}⚠ Dependencies not installed. Installing...${NC}"
        npm install --legacy-peer-deps
        echo -e "${GREEN}✓ Dependencies installed${NC}"
    else
        echo -e "${GREEN}✓ Dependencies found${NC}"
    fi

    # Check Bluetooth (optional for development)
    if command -v hciconfig &> /dev/null; then
        echo -e "${GREEN}✓ Bluetooth tools available${NC}"

        # Try to bring up Bluetooth interfaces
        if [ "$EUID" -eq 0 ]; then
            hciconfig hci0 up 2>/dev/null || true
            hciconfig hci1 up 2>/dev/null || true
        fi
    else
        echo -e "${YELLOW}⚠ Bluetooth tools not found. Virtual mode will be used.${NC}"
    fi

    echo ""
}

# Function to start the application
start_app() {
    echo "Starting BlueK9 Client..."
    echo ""

    # Build if needed
    if [ ! -d ".next" ]; then
        echo "Building application..."
        npm run build
        echo ""
    fi

    # Configure Kismet connection to local client
    export KISMET_URL="http://10.109.100.1:2501"
    echo -e "${GREEN}✓ Kismet configured: ${KISMET_URL}${NC}"
    echo ""

    # Check if production or development
    if [ "$NODE_ENV" = "production" ]; then
        echo -e "${BLUE}Starting in production mode...${NC}"
        npm start
    else
        echo -e "${BLUE}Starting in development mode...${NC}"
        npm run dev
    fi
}

# Function to check ports
check_ports() {
    PORT=3000
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠ Port $PORT is already in use${NC}"
        echo "Please stop the existing service or change the PORT environment variable"
        exit 1
    fi
}

# Function to show startup info
show_info() {
    echo ""
    echo "========================================="
    echo -e "${GREEN}BlueK9 Client Started Successfully!${NC}"
    echo "========================================="
    echo ""
    echo "Access the web interface at:"
    echo -e "${BLUE}  http://localhost:3000${NC}"
    echo ""
    echo "Default login credentials:"
    echo "  Username: bluek9"
    echo "  Password: warhammer"
    echo ""
    echo "Features:"
    echo "  • Bluetooth Classic & LE scanning"
    echo "  • Real-time geolocation with CEP"
    echo "  • Mapbox visualization"
    echo "  • Target tracking & alerts"
    echo "  • SMS notifications (if hardware available)"
    echo "  • Live analytics & logging"
    echo ""
    echo "Press Ctrl+C to stop"
    echo "========================================="
    echo ""
}

# Main execution
if [ "$DOCKER_MODE" = false ]; then
    check_dependencies
    check_ports
fi

show_info
start_app
