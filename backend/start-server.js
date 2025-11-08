#!/usr/bin/env node

const { spawn } = require('child_process');
const net = require('net');

const PORT = process.env.PORT || 5001;

// Function to check if port is in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(false));
      server.close();
    });
    server.on('error', () => resolve(true));
  });
}

// Function to kill process on port
function killProcessOnPort(port) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec(`lsof -ti:${port}`, (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve(false);
        return;
      }
      const pid = stdout.trim();
      console.log(`Found process ${pid} using port ${port}. Killing it...`);
      exec(`kill -9 ${pid}`, (killError) => {
        if (killError) {
          console.error(`Failed to kill process: ${killError.message}`);
          resolve(false);
        } else {
          console.log(`Process ${pid} killed successfully.`);
          setTimeout(resolve, 1000); // Wait 1 second for port to be released
        }
      });
    });
  });
}

async function startServer() {
  const portInUse = await isPortInUse(PORT);
  
  if (portInUse) {
    console.log(`Port ${PORT} is in use. Attempting to free it...`);
    const killed = await killProcessOnPort(PORT);
    
    if (killed) {
      console.log(`Port ${PORT} is now free. Starting server...\n`);
    } else {
      console.error(`\n❌ Could not free port ${PORT}.`);
      console.error(`Please manually stop the process using port ${PORT} or use a different port:`);
      console.error(`   PORT=5001 npm start\n`);
      process.exit(1);
    }
  }
  
  // Start the server
  const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    shell: false
  });
  
  server.on('error', (error) => {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  });
  
  server.on('exit', (code) => {
    process.exit(code);
  });
  
  // Handle Ctrl+C
  process.on('SIGINT', () => {
    server.kill('SIGINT');
  });
}

startServer();

