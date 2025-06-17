#!/bin/bash

echo "Stopping COCM services..."

# Stop backend service
if pgrep -f "npm start" > /dev/null; then
  echo "Stopping backend service..."
  pkill -f "npm start"
  echo "Backend service stopped."
else
  echo "Backend service is not running."
fi

# Stop frontend service
if pgrep -f "npm run dev" > /dev/null; then
  echo "Stopping frontend service..."
  pkill -f "npm run dev"
  echo "Frontend service stopped."
else
  echo "Frontend service is not running."
fi

echo "All services stopped." 