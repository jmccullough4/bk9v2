#!/bin/bash

set -e

echo "========================================="
echo "  BlueK9 Client Installation Script"
echo "========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
    exit 1
fi

echo "Checking dependencies..."
echo ""

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker not found. Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}✓ Docker installed${NC}"
else
    echo -e "${GREEN}✓ Docker found${NC}"
fi

# Check for Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}Docker Compose not found. Installing...${NC}"
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓ Docker Compose installed${NC}"
else
    echo -e "${GREEN}✓ Docker Compose found${NC}"
fi

# Check for Bluetooth
if ! command -v hciconfig &> /dev/null; then
    echo -e "${YELLOW}Bluetooth tools not found. Installing...${NC}"
    apt-get update
    apt-get install -y bluetooth bluez bluez-tools
    echo -e "${GREEN}✓ Bluetooth tools installed${NC}"
else
    echo -e "${GREEN}✓ Bluetooth tools found${NC}"
fi

# Enable Bluetooth service
echo "Enabling Bluetooth service..."
systemctl enable bluetooth
systemctl start bluetooth
echo -e "${GREEN}✓ Bluetooth service enabled${NC}"

# Check for Bluetooth adapters
echo ""
echo "Checking for Bluetooth adapters..."
if hciconfig -a | grep -q "hci"; then
    echo -e "${GREEN}✓ Bluetooth adapter(s) detected:${NC}"
    hciconfig -a | grep "hci" | cut -d: -f1
else
    echo -e "${YELLOW}⚠ No Bluetooth adapters detected${NC}"
    echo "  Please connect a Bluetooth adapter (e.g., Sena UD100)"
fi

# Check for GPS
echo ""
echo "Checking for GPS device..."
if ls /dev/ttyUSB* /dev/ttyACM* &> /dev/null; then
    echo -e "${GREEN}✓ Serial devices detected (may include GPS):${NC}"
    ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null || true
else
    echo -e "${YELLOW}⚠ No USB serial devices detected${NC}"
    echo "  GPS functionality will use simulated data"
fi

# Check for SIMCOM modem
echo ""
echo "Checking for SIMCOM7600 modem..."
if lsusb | grep -i "simcom\|1e0e"; then
    echo -e "${GREEN}✓ SIMCOM modem detected${NC}"
else
    echo -e "${YELLOW}⚠ SIMCOM modem not detected${NC}"
    echo "  SMS alerts will be logged only"
fi

# Create data directory
echo ""
echo "Creating data directory..."
mkdir -p ./data
chmod 777 ./data
echo -e "${GREEN}✓ Data directory created${NC}"

# Create public directory for assets
echo "Creating public directory..."
mkdir -p ./public
echo -e "${GREEN}✓ Public directory created${NC}"

# Download alert sound (or create a placeholder)
echo "Setting up alert sound..."
if ! [ -f "./public/alert.mp3" ]; then
    # Create a simple beep using sox if available, otherwise just create empty file
    if command -v sox &> /dev/null; then
        sox -n -r 44100 -c 2 ./public/alert.mp3 synth 0.5 sine 1000 vol 0.5
    else
        touch ./public/alert.mp3
        echo -e "${YELLOW}⚠ Alert sound placeholder created. Add your own alert.mp3 to ./public/${NC}"
    fi
fi
echo -e "${GREEN}✓ Alert sound configured${NC}"

# Add user to bluetooth and dialout groups
if [ -n "$SUDO_USER" ]; then
    echo ""
    echo "Adding user $SUDO_USER to bluetooth and dialout groups..."
    usermod -a -G bluetooth,dialout $SUDO_USER
    echo -e "${GREEN}✓ User groups configured${NC}"
    echo -e "${YELLOW}⚠ You may need to log out and back in for group changes to take effect${NC}"
fi

echo ""
echo "========================================="
echo -e "${GREEN}Installation Complete!${NC}"
echo "========================================="
echo ""
echo "To start BlueK9:"
echo "  ./start.sh"
echo ""
echo "To start in Docker:"
echo "  docker-compose up -d"
echo ""
echo "Default login credentials:"
echo "  Username: bluek9"
echo "  Password: warhammer"
echo ""
echo "Access the web interface at:"
echo "  http://localhost:3000"
echo ""
