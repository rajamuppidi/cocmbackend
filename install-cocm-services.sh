#!/bin/bash

# Make sure script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

# Define paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_SERVICE_PATH="${SCRIPT_DIR}/cocm-backend.service"
FRONTEND_SERVICE_PATH="${SCRIPT_DIR}/cocm-frontend.service"
SYSTEMD_DIR="/etc/systemd/system"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  echo "npm is not installed. Please install Node.js and npm first."
  exit 1
fi

# Update paths in service files to match actual installation directory
sed -i "s|/home/uphcs/Desktop/cocm/backend|/home/uphcs/Desktop/cocm/backend|g" "$BACKEND_SERVICE_PATH"
sed -i "s|/home/uphcs/Desktop/cocm/frontend|/home/uphcs/Desktop/cocm/frontend|g" "$FRONTEND_SERVICE_PATH"

# Find the correct path to npm
NPM_PATH=$(which npm)
sed -i "s|/usr/bin/npm|${NPM_PATH}|g" "$BACKEND_SERVICE_PATH"
sed -i "s|/usr/bin/npm|${NPM_PATH}|g" "$FRONTEND_SERVICE_PATH"

# Copy service files to systemd directory
echo "Installing service files..."
cp "$BACKEND_SERVICE_PATH" "$SYSTEMD_DIR"
cp "$FRONTEND_SERVICE_PATH" "$SYSTEMD_DIR"

# Reload systemd to recognize new services
echo "Reloading systemd..."
systemctl daemon-reload

# Enable services to start at boot
echo "Enabling services to start at boot..."
systemctl enable cocm-backend.service
systemctl enable cocm-frontend.service

# Start services
echo "Starting services..."
systemctl start cocm-backend.service
systemctl start cocm-frontend.service

# Check status
echo "Service status:"
echo "Backend:"
systemctl status cocm-backend.service --no-pager
echo "Frontend:"
systemctl status cocm-frontend.service --no-pager

echo "Installation complete. Services will start automatically on system boot."
echo "Use 'systemctl status cocm-backend.service' or 'systemctl status cocm-frontend.service' to check status."
echo "Use 'journalctl -u cocm-backend.service' or 'journalctl -u cocm-frontend.service' to view logs." 