/**
 * WebSocket Manager for Screeps Console Logs
 * 
 * Maintains a persistent WebSocket connection to Screeps for real-time console monitoring.
 */

import { ScreepsAPI } from 'screeps-api';

let api = null;
let consoleBuffer = [];
let resultsBuffer = [];
const MAX_BUFFER_SIZE = 200; // Keep last 200 log entries
let connectionStatus = 'disconnected';

/**
 * Initialize WebSocket connection to Screeps
 */
export async function initWebSocket(token, server = 'https://screeps.com') {
  if (api && connectionStatus === 'connected') {
    console.error('WebSocket already connected');
    return api;
  }

  try {
    const serverUrl = new URL(server);
    
    api = new ScreepsAPI({
      token: token,
      protocol: serverUrl.protocol.replace(':', ''),
      hostname: serverUrl.hostname,
      port: serverUrl.protocol === 'https:' ? 443 : 80,
      path: '/'
    });

    console.error('Connecting to Screeps WebSocket...');
    await api.socket.connect();
    connectionStatus = 'connected';
    
    // Subscribe to console messages
    api.socket.subscribe('console', (event) => {
      try {
        const { messages } = event.data;
        
        if (messages) {
          // Handle log messages
          if (messages.log && Array.isArray(messages.log)) {
            consoleBuffer.push(...messages.log);
            // Keep buffer size manageable
            if (consoleBuffer.length > MAX_BUFFER_SIZE) {
              consoleBuffer = consoleBuffer.slice(-MAX_BUFFER_SIZE);
            }
          }
          
          // Handle results (from console commands)
          if (messages.results && Array.isArray(messages.results)) {
            resultsBuffer.push(...messages.results);
            if (resultsBuffer.length > MAX_BUFFER_SIZE) {
              resultsBuffer = resultsBuffer.slice(-MAX_BUFFER_SIZE);
            }
          }
        }
      } catch (error) {
        console.error('Error processing console message:', error);
      }
    });

    // Handle connection errors
    api.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      connectionStatus = 'error';
    });

    api.socket.on('close', () => {
      console.error('WebSocket connection closed');
      connectionStatus = 'disconnected';
    });

    console.error('✅ WebSocket connected to Screeps successfully');
    return api;
  } catch (error) {
    console.error('❌ Failed to initialize WebSocket:', error.message);
    connectionStatus = 'error';
    throw error;
  }
}

/**
 * Get buffered console logs
 */
export function getConsoleBuffer() {
  return {
    logs: [...consoleBuffer],
    results: [...resultsBuffer],
    count: consoleBuffer.length,
    status: connectionStatus
  };
}

/**
 * Clear console buffer
 */
export function clearConsoleBuffer() {
  const oldCount = consoleBuffer.length;
  consoleBuffer = [];
  resultsBuffer = [];
  return { cleared: oldCount };
}

/**
 * Get connection status
 */
export function getConnectionStatus() {
  return {
    status: connectionStatus,
    connected: connectionStatus === 'connected',
    bufferSize: consoleBuffer.length
  };
}

/**
 * Close WebSocket connection
 */
export async function closeWebSocket() {
  if (api && api.socket) {
    try {
      await api.socket.disconnect();
      connectionStatus = 'disconnected';
      console.error('WebSocket disconnected');
    } catch (error) {
      console.error('Error disconnecting WebSocket:', error);
    }
    api = null;
  }
}

/**
 * Reconnect WebSocket if needed
 */
export async function ensureConnection(token, server) {
  if (connectionStatus !== 'connected') {
    console.error('Reconnecting WebSocket...');
    await initWebSocket(token, server);
  }
  return connectionStatus === 'connected';
}


