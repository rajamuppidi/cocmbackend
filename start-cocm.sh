#!/bin/bash

# Define paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="/home/uphcs/Desktop/cocm/backend"
FRONTEND_DIR="/home/uphcs/Desktop/cocm/frontend"
LOG_DIR="${SCRIPT_DIR}/logs"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to check if a process is running
is_running() {
  pgrep -f "$1" > /dev/null
}

# Function to start a service
start_service() {
  local dir="$1"
  local name="$2"
  local command="$3"
  local log_file="${LOG_DIR}/${name}.log"
  
  echo "Starting $name service..."
  cd "$dir" || { echo "Error: Directory $dir not found"; exit 1; }
  
  if is_running "$command"; then
    echo "$name is already running"
  else
    nohup npm $command > "$log_file" 2>&1 &
    echo "$name started with PID $! (logs at $log_file)"
  fi
}

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  echo "npm is not installed. Please install Node.js and npm first."
  exit 1
fi

# Start backend service
start_service "$BACKEND_DIR" "cocm-backend" "start"

# Start frontend service
start_service "$FRONTEND_DIR" "cocm-frontend" "run dev"

echo "All services started. Check logs in $LOG_DIR directory."
echo "To stop services, use: pkill -f 'npm start' && pkill -f 'npm run dev'" 