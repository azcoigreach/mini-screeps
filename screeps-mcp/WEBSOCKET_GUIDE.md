# Adding WebSocket Support to Screeps MCP

This guide explains how to add real-time console log support via WebSocket.

## Why WebSocket?

The Screeps HTTP API doesn't provide console logs via GET `/api/user/console`. Instead, Screeps uses WebSocket connections for real-time data:

- ✅ Real-time console logs
- ✅ Live room events  
- ✅ Immediate error detection
- ✅ Streaming performance data

## What's Needed

### 1. Install `screeps-api` Package

```bash
cd /home/azcoigreach/repos/mini-screeps/screeps-mcp
npm install screeps-api
```

This adds the official Screeps WebSocket client library.

### 2. Code Changes Required

The `screeps-api` library provides a different API than our current `axios` implementation:

**Current (HTTP only)**:
```javascript
import axios from 'axios';
const client = axios.create({ ... });
await client.get('/api/user/console');  // Returns 404
```

**With WebSocket**:
```javascript
import { ScreepsAPI } from 'screeps-api';

const api = new ScreepsAPI({
  token: SCREEPS_TOKEN,
  protocol: 'https',
  hostname: 'screeps.com',
  port: 443,
  path: '/'
});

// Connect WebSocket
await api.socket.connect();

// Subscribe to console events
api.socket.subscribe('console', (event) => {
  const { messages } = event.data;
  console.log('Console logs:', messages.log);
  console.log('Results:', messages.results);
});
```

## Implementation Options

### Option A: Hybrid Approach (Recommended)

Keep current HTTP implementation for simple requests, add WebSocket only for console logs:

**Pros**:
- ✅ Minimal changes to existing code
- ✅ HTTP still works for uploads, memory, etc.
- ✅ WebSocket only for features that need it

**Cons**:
- ⚠️ Two different API clients to maintain
- ⚠️ Slightly more complex

### Option B: Full Migration

Replace all `axios` calls with `screeps-api`:

**Pros**:
- ✅ One unified API client
- ✅ WebSocket + HTTP in one package
- ✅ Official Screeps library

**Cons**:
- ⚠️ Need to rewrite all API calls
- ⚠️ Different API structure

## Recommended Implementation (Option A)

### 1. Update package.json

```bash
npm install screeps-api
```

### 2. Add WebSocket Manager

Create a new file `websocket-manager.js`:

```javascript
import { ScreepsAPI } from 'screeps-api';

let api = null;
let consoleBuffer = [];
const MAX_BUFFER_SIZE = 100;

export async function initWebSocket(token, server = 'https://screeps.com') {
  if (api) return api; // Already connected
  
  api = new ScreepsAPI({
    token: token,
    protocol: server.startsWith('https') ? 'https' : 'http',
    hostname: new URL(server).hostname,
    port: server.startsWith('https') ? 443 : 80,
    path: '/'
  });

  await api.socket.connect();
  
  // Subscribe to console messages
  api.socket.subscribe('console', (event) => {
    const { messages } = event.data;
    if (messages && messages.log) {
      // Add to buffer
      consoleBuffer.push(...messages.log);
      // Keep buffer size manageable
      if (consoleBuffer.length > MAX_BUFFER_SIZE) {
        consoleBuffer = consoleBuffer.slice(-MAX_BUFFER_SIZE);
      }
    }
  });

  console.error('WebSocket connected to Screeps');
  return api;
}

export function getConsoleBuffer() {
  return [...consoleBuffer];
}

export function clearConsoleBuffer() {
  consoleBuffer = [];
}

export async function closeWebSocket() {
  if (api && api.socket) {
    await api.socket.disconnect();
    api = null;
  }
}
```

### 3. Update index.js

Add at the top:
```javascript
import { initWebSocket, getConsoleBuffer, clearConsoleBuffer } from './websocket-manager.js';
```

Modify the server initialization:
```javascript
// Initialize WebSocket connection at startup
let wsInitialized = false;

async function ensureWebSocket() {
  if (!wsInitialized && SCREEPS_TOKEN) {
    try {
      await initWebSocket(SCREEPS_TOKEN, SCREEPS_SERVER);
      wsInitialized = true;
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error.message);
    }
  }
}

// Call this before starting the MCP server
async function main() {
  await ensureWebSocket();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Screeps MCP Server running on stdio");
}
```

Update the `getConsole` function:
```javascript
async function getConsole() {
  // Try WebSocket first
  if (wsInitialized) {
    const logs = getConsoleBuffer();
    return {
      logs: logs,
      results: [],
      error: null,
      available: true,
      source: 'websocket'
    };
  }
  
  // Fall back to HTTP (which returns 404)
  const client = createAuthenticatedClient();
  try {
    const response = await client.get('/api/user/console');
    return {
      logs: response.data.log || [],
      results: response.data.results || [],
      error: response.data.error || null,
      available: true,
      source: 'http'
    };
  } catch (error) {
    return {
      logs: [],
      results: [],
      error: 'Console logs not available. WebSocket not connected.',
      available: false,
      note: 'WebSocket connection needed for console logs'
    };
  }
}
```

## Trade-offs

### With WebSocket

**Advantages**:
- ✅ Real-time console logs
- ✅ Immediate error detection  
- ✅ Live performance monitoring
- ✅ No more 404 errors

**Disadvantages**:
- ⚠️ Persistent connection (uses resources)
- ⚠️ More complex error handling
- ⚠️ Connection can drop (need reconnect logic)
- ⚠️ Another dependency

### Without WebSocket (Current)

**Advantages**:
- ✅ Simple HTTP-only implementation
- ✅ Stateless (no persistent connections)
- ✅ Easy to understand and debug
- ✅ Works for core features (upload, memory, etc.)

**Disadvantages**:
- ❌ No console logs
- ❌ No real-time monitoring
- ❌ Limited error detection

## When Do You Need WebSocket?

**You DON'T need WebSocket if**:
- ✅ Just uploading code
- ✅ Checking account stats
- ✅ Managing memory
- ✅ Getting terrain/room status
- ✅ Using in-game console for debugging

**You DO need WebSocket if**:
- ⚠️ Want console logs via MCP
- ⚠️ Want automatic error detection
- ⚠️ Want real-time bot monitoring
- ⚠️ Building automated troubleshooting

## Recommended Approach

**For most users**: The current HTTP-only implementation is sufficient. Use the Screeps in-game console at https://screeps.com for live debugging.

**For advanced automation**: Add WebSocket support using Option A (Hybrid) to get console logs while keeping the simple HTTP implementation for everything else.

## Installation Steps (If You Want It)

```bash
# 1. Install the package
cd /home/azcoigreach/repos/mini-screeps/screeps-mcp
npm install screeps-api

# 2. Create websocket-manager.js (copy code above)

# 3. Update index.js (add imports and modify getConsole)

# 4. Restart Cursor
# Press Ctrl+Shift+P → "Reload Window"

# 5. Test
# "Show me my console logs"
```

## Testing WebSocket Connection

After implementing, test with:
```javascript
// In Screeps console (in-game)
console.log("Test message from game!");

// In Cursor (via MCP)
"Show me the console logs"
// Should see: "Test message from game!"
```

## Full Example Code

See the implementation guide above for complete code examples. The key files are:

1. `websocket-manager.js` - WebSocket connection handler
2. `index.js` - Updated to use WebSocket for console
3. `package.json` - Add `screeps-api` dependency

## Maintenance

With WebSocket support:
- Monitor connection health
- Handle reconnections gracefully  
- Clear buffer periodically to avoid memory leaks
- Test after Screeps server updates

## Current Status

**Without WebSocket** (current implementation):
- ✅ Code upload works
- ✅ Memory access works
- ✅ Account info works
- ✅ Terrain/room data works
- ❌ Console logs return 404

**With WebSocket** (after implementation):
- ✅ All of the above
- ✅ Console logs work in real-time

## Conclusion

WebSocket support is **optional but useful** for:
- Automated monitoring
- Real-time debugging via MCP
- Error detection without checking in-game

The current HTTP implementation is **sufficient** for:
- Code deployment
- Configuration management  
- Room analysis
- Account monitoring

**Recommendation**: Start with the current implementation. Add WebSocket only if you need automated console monitoring.

---

*Last Updated: 2025-10-10*
*Implementation Difficulty: Moderate (2-3 hours)*
*Benefit: Real-time console logs via MCP*


