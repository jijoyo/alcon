#!/bin/bash
# Deploy Alcon to VPS
# Usage: ./deploy.sh

set -e

VPS_IP="159.54.143.227"
VPS_USER="ubuntu"
SSH_KEY="$HOME/.ssh/oracle_key"
REMOTE_DIR="/home/ubuntu/alcon"

echo "=== Deploying Alcon to VPS ==="

# Create remote directory
echo "Creating remote directory..."
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_IP" "mkdir -p $REMOTE_DIR/server $REMOTE_DIR/agents"

# Copy server
echo "Copying server..."
scp -i "$SSH_KEY" -r server/* "$VPS_USER@$VPS_IP:$REMOTE_DIR/server/"

# Copy agents
echo "Copying agents..."
scp -i "$SSH_KEY" agents/agent.js "$VPS_USER@$VPS_IP:$REMOTE_DIR/agents/"

# Install dependencies on VPS
echo "Installing dependencies..."
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_IP" "cd $REMOTE_DIR/server && npm install --production"

# Stop existing processes
echo "Stopping existing processes..."
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_IP" "pm2 stop alcon-server 2>/dev/null || true; pm2 stop kali-agent 2>/dev/null || true; pm2 stop vps-agent 2>/dev/null || true"

# Start server
echo "Starting server..."
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_IP" "cd $REMOTE_DIR/server && pm2 start server.js --name alcon-server"

# Start agents
echo "Starting agents..."
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_IP" "cd $REMOTE_DIR/agents && pm2 start agent.js --name kali-agent -- kali http://localhost:3003"
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_IP" "cd $REMOTE_DIR/agents && pm2 start agent.js --name vps-agent -- vps http://localhost:3003"

# Save pm2 config
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_IP" "pm2 save"

# Test
echo "Testing..."
sleep 2
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_IP" "curl -s http://localhost:3003/health"

echo ""
echo "=== Deploy complete ==="
echo "Server: http://$VPS_IP:3003"
echo "Health: http://$VPS_IP:3003/health"
echo "Status: http://$VPS_IP:3003/api/status"
