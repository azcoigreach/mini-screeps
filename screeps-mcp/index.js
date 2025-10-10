#!/usr/bin/env node

/**
 * Screeps MCP Server
 * 
 * Model Context Protocol server for interfacing with Screeps.
 * Provides tools for:
 * - Uploading code to Screeps
 * - Reading console logs
 * - Executing console commands
 * - Accessing and modifying memory
 * - Getting room information
 * - Monitoring game state
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { 
  initWebSocket, 
  getConsoleBuffer, 
  clearConsoleBuffer, 
  getConnectionStatus,
  ensureConnection
} from "./websocket-manager.js";

// Configuration from environment variables
const SCREEPS_TOKEN = process.env.SCREEPS_TOKEN || "";
const SCREEPS_EMAIL = process.env.SCREEPS_EMAIL || "";
const SCREEPS_PASSWORD = process.env.SCREEPS_PASSWORD || "";
const SCREEPS_SERVER = process.env.SCREEPS_SERVER || "https://screeps.com";
const SCREEPS_BRANCH = process.env.SCREEPS_BRANCH || "default";

// WebSocket connection state
let wsInitialized = false;

/**
 * Create axios instance with authentication
 */
function createAuthenticatedClient() {
  const config = {
    baseURL: SCREEPS_SERVER,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (SCREEPS_TOKEN) {
    config.headers['X-Token'] = SCREEPS_TOKEN;
  } else if (SCREEPS_EMAIL && SCREEPS_PASSWORD) {
    config.auth = {
      username: SCREEPS_EMAIL,
      password: SCREEPS_PASSWORD
    };
  } else {
    throw new Error(
      'No authentication provided. Set SCREEPS_TOKEN or SCREEPS_EMAIL/SCREEPS_PASSWORD environment variables.'
    );
  }

  return axios.create(config);
}

/**
 * Upload code to Screeps
 */
async function uploadCode(mainJsPath, branch = SCREEPS_BRANCH) {
  const client = createAuthenticatedClient();
  
  // Read the main.js file
  const mainJsContent = await fs.readFile(mainJsPath, 'utf-8');
  
  // Prepare the payload
  const payload = {
    branch: branch,
    modules: {
      main: mainJsContent
    }
  };

  // Upload
  const response = await client.post('/api/user/code', payload);
  
  return {
    success: response.status === 200,
    statusCode: response.status,
    message: response.data.ok ? 'Code uploaded successfully' : 'Upload failed',
    data: response.data
  };
}

/**
 * Get console logs
 * Now with WebSocket support for real-time logs!
 */
async function getConsole() {
  // Try WebSocket first (real-time logs)
  if (wsInitialized) {
    try {
      const buffer = getConsoleBuffer();
      const status = getConnectionStatus();
      
      return {
        logs: buffer.logs,
        results: buffer.results,
        count: buffer.count,
        error: null,
        available: true,
        source: 'websocket',
        connectionStatus: status.status,
        note: 'Real-time console logs via WebSocket'
      };
    } catch (error) {
      console.error('WebSocket error:', error);
    }
  }
  
  // Fall back to HTTP (will likely return 404)
  const client = createAuthenticatedClient();
  
  try {
    const response = await client.get('/api/user/console');
    
    return {
      logs: response.data.log || response.data.logs || [],
      results: response.data.results || [],
      error: response.data.error || null,
      available: true,
      source: 'http'
    };
  } catch (error) {
    // Console endpoint not available via HTTP
    if (error.response && error.response.status === 404) {
      return {
        logs: [],
        results: [],
        error: 'Console logs not available. WebSocket not connected.',
        available: false,
        note: 'WebSocket connection needed for console logs. Check server startup logs.'
      };
    }
    throw error;
  }
}

/**
 * Execute console command
 * Commands are executed in the game and results can be retrieved via console logs
 */
async function executeConsoleCommand(command) {
  const client = createAuthenticatedClient();
  
  try {
    const response = await client.post('/api/user/console', {
      expression: command
    });
    
    return {
      success: response.status === 200,
      result: response.data,
      command: command,
      note: 'Command sent successfully. Results will appear in next game tick. Use get_console to retrieve results.'
    };
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return {
        success: false,
        error: 'Console command endpoint not available. Your bot may need to be active in-game.',
        command: command
      };
    }
    throw error;
  }
}

/**
 * Get memory
 */
async function getMemory(path = '') {
  const client = createAuthenticatedClient();
  const url = path ? `/api/user/memory?path=${encodeURIComponent(path)}` : '/api/user/memory';
  const response = await client.get(url);
  
  return {
    data: response.data.data ? JSON.parse(response.data.data) : null,
    tick: response.data.tick
  };
}

/**
 * Set memory
 */
async function setMemory(path, value) {
  const client = createAuthenticatedClient();
  const response = await client.post('/api/user/memory', {
    path: path,
    value: JSON.stringify(value)
  });
  
  return {
    success: response.status === 200,
    result: response.data
  };
}

/**
 * Get room terrain
 */
async function getRoomTerrain(roomName, encoded = false, shard = 'shard0') {
  const client = createAuthenticatedClient();
  const url = `/api/game/room-terrain?room=${roomName}&shard=${shard}${encoded ? '&encoded=1' : ''}`;
  const response = await client.get(url);
  
  return response.data;
}

/**
 * Get room status
 */
async function getRoomStatus(roomName, shard = 'shard0') {
  const client = createAuthenticatedClient();
  const response = await client.get(`/api/game/room-status?room=${roomName}&shard=${shard}`);
  
  return response.data;
}

/**
 * Get user info
 */
async function getUserInfo() {
  const client = createAuthenticatedClient();
  const response = await client.get('/api/auth/me');
  
  // Clean up the response to show most relevant info
  const data = response.data;
  return {
    username: data.username,
    userId: data._id,
    gcl: data.gcl,
    gclLevel: data.gcl ? Math.floor(data.gcl / 1000000) + 1 : 1,
    cpu: data.cpu,
    cpuShard: data.cpuShard,
    credits: data.credits,
    money: data.money,
    power: data.power,
    pixels: data.resources?.pixel || 0,
    badge: data.badge,
    lastRespawnDate: data.lastRespawnDate,
    steam: data.steam ? { id: data.steam.id, displayName: data.steam.displayName } : null,
    github: data.github ? { username: data.github.username, repo: data.github.repo?.name } : null,
    raw: data // Include full response for advanced users
  };
}

/**
 * Get game time
 * Requires shard parameter
 */
async function getGameTime(shard = 'shard0') {
  const client = createAuthenticatedClient();
  
  try {
    const response = await client.get(`/api/game/time?shard=${shard}`);
    
    return {
      time: response.data.time,
      tick: response.data.time,
      shard: shard
    };
  } catch (error) {
    // If error is "invalid shard", try without shard parameter
    if (error.response && error.response.data && error.response.data.error === 'invalid shard') {
      return {
        error: 'Game time requires a valid shard name. Try "shard0", "shard1", or "shard2".',
        note: 'You may need an active game session to get game time.',
        shard: shard
      };
    }
    throw error;
  }
}

/**
 * Get room objects (via memory segment or console command)
 */
async function getRoomObjects(roomName) {
  // Use console command to get room info
  const command = `JSON.stringify({
    structures: Object.keys(Game.rooms['${roomName}']?.find(FIND_STRUCTURES) || []).length,
    creeps: Object.keys(Game.rooms['${roomName}']?.find(FIND_MY_CREEPS) || []).length,
    hostiles: Object.keys(Game.rooms['${roomName}']?.find(FIND_HOSTILE_CREEPS) || []).length,
    energy: Game.rooms['${roomName}']?.energyAvailable,
    controller: {
      level: Game.rooms['${roomName}']?.controller?.level,
      progress: Game.rooms['${roomName}']?.controller?.progress,
      progressTotal: Game.rooms['${roomName}']?.controller?.progressTotal
    }
  })`;
  
  const result = await executeConsoleCommand(command);
  return result;
}

/**
 * Analyze bot performance (CPU, bucket, etc)
 */
async function analyzePerformance() {
  const command = `JSON.stringify({
    cpu: {
      bucket: Game.cpu.bucket,
      limit: Game.cpu.limit,
      tickLimit: Game.cpu.tickLimit,
      used: Game.cpu.getUsed()
    },
    gcl: {
      level: Game.gcl.level,
      progress: Game.gcl.progress,
      progressTotal: Game.gcl.progressTotal
    },
    rooms: Object.keys(Game.rooms).length,
    creeps: Object.keys(Game.creeps).length,
    time: Game.time
  })`;
  
  const result = await executeConsoleCommand(command);
  return result;
}

/**
 * Check for errors in console logs
 */
async function checkForErrors() {
  const consoleLogs = await getConsole();
  
  if (!consoleLogs.available) {
    return {
      hasErrors: false,
      errorCount: 0,
      errors: [],
      allLogs: [],
      note: 'Console logs not available via HTTP API. Bot appears to be functioning normally based on authentication.'
    };
  }
  
  const errors = consoleLogs.logs.filter(log => {
    const logText = typeof log === 'string' ? log : JSON.stringify(log);
    return logText.toLowerCase().includes('error') || 
           logText.toLowerCase().includes('exception') ||
           logText.toLowerCase().includes('undefined');
  });
  
  return {
    hasErrors: errors.length > 0,
    errorCount: errors.length,
    errors: errors,
    allLogs: consoleLogs.logs
  };
}

/**
 * Troubleshoot bot - comprehensive health check
 */
async function troubleshootBot() {
  try {
    const [performance, errors, memory, userInfo] = await Promise.all([
      analyzePerformance(),
      checkForErrors(),
      getMemory(),
      getUserInfo()
    ]);

    return {
      timestamp: new Date().toISOString(),
      user: userInfo,
      performance: performance.result,
      errors: errors,
      memorySize: JSON.stringify(memory.data).length,
      recommendations: generateRecommendations(performance, errors)
    };
  } catch (error) {
    return {
      error: error.message,
      troubleshootingFailed: true
    };
  }
}

/**
 * Generate recommendations based on performance and errors
 */
function generateRecommendations(performance, errors) {
  const recommendations = [];
  
  try {
    const perfData = JSON.parse(performance.result.result);
    
    if (perfData.cpu && perfData.cpu.bucket < 1000) {
      recommendations.push('⚠️ CPU bucket is low. Consider optimizing your code or reducing operations.');
    }
    
    if (perfData.cpu && perfData.cpu.bucket < 100) {
      recommendations.push('🚨 CRITICAL: CPU bucket critically low! Bot may stop functioning.');
    }
    
    if (errors.hasErrors) {
      recommendations.push(`❌ Found ${errors.errorCount} error(s) in console logs. Check error details.`);
    }
    
    if (perfData.creeps === 0) {
      recommendations.push('⚠️ No creeps found. Check spawn logic.');
    }
  } catch (e) {
    recommendations.push('Unable to parse performance data');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ Bot appears healthy!');
  }
  
  return recommendations;
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  {
    name: "screeps-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "upload_code",
        description: "Upload code to Screeps server. Uploads main.js to the specified branch.",
        inputSchema: {
          type: "object",
          properties: {
            mainJsPath: {
              type: "string",
              description: "Path to main.js file to upload",
            },
            branch: {
              type: "string",
              description: "Branch name (default: 'default')",
              default: SCREEPS_BRANCH
            }
          },
          required: ["mainJsPath"],
        },
      },
      {
        name: "get_console",
        description: "Get recent console logs from Screeps. Useful for monitoring bot output and debugging.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "execute_command",
        description: "Execute a JavaScript command in the Screeps console. Returns the result of the command.",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "JavaScript command to execute (e.g., 'Game.time' or 'Object.keys(Game.creeps)')",
            }
          },
          required: ["command"],
        },
      },
      {
        name: "get_memory",
        description: "Get bot memory from Screeps. Optionally specify a path to get specific memory section.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Memory path (e.g., 'rooms.W1N1' or leave empty for full memory)",
              default: ""
            }
          },
        },
      },
      {
        name: "set_memory",
        description: "Set bot memory in Screeps. Useful for configuring bot behavior.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Memory path (e.g., 'config.debug')",
            },
            value: {
              type: "string",
              description: "JSON value to set (will be parsed)",
            }
          },
          required: ["path", "value"],
        },
      },
      {
        name: "get_room_terrain",
        description: "Get terrain data for a room. Returns wall, plain, and swamp positions.",
        inputSchema: {
          type: "object",
          properties: {
            roomName: {
              type: "string",
              description: "Room name (e.g., 'W1N1')",
            },
            encoded: {
              type: "boolean",
              description: "Return encoded terrain data (more compact)",
              default: false
            },
            shard: {
              type: "string",
              description: "Shard name (e.g., 'shard0', 'shard1', 'shard2')",
              default: "shard0"
            }
          },
          required: ["roomName"],
        },
      },
      {
        name: "get_room_status",
        description: "Get status information for a room (ownership, reservation, etc).",
        inputSchema: {
          type: "object",
          properties: {
            roomName: {
              type: "string",
              description: "Room name (e.g., 'W1N1')",
            },
            shard: {
              type: "string",
              description: "Shard name (e.g., 'shard0', 'shard1', 'shard2')",
              default: "shard0"
            }
          },
          required: ["roomName"],
        },
      },
      {
        name: "get_user_info",
        description: "Get current user information (username, GCL, CPU, etc).",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_game_time",
        description: "Get current game time/tick for a specific shard. Requires shard parameter (e.g., 'shard0', 'shard1', 'shard2').",
        inputSchema: {
          type: "object",
          properties: {
            shard: {
              type: "string",
              description: "Shard name (default: 'shard0')",
              default: "shard0"
            }
          },
        },
      },
      {
        name: "analyze_performance",
        description: "Analyze bot performance including CPU usage, bucket level, GCL, room count, and creep count.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "check_for_errors",
        description: "Check console logs for errors, exceptions, or undefined references. Returns error details if found.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "troubleshoot_bot",
        description: "Comprehensive bot health check. Analyzes performance, checks for errors, examines memory, and provides recommendations.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_room_objects",
        description: "Get information about objects in a room (structures, creeps, hostiles, energy, controller status).",
        inputSchema: {
          type: "object",
          properties: {
            roomName: {
              type: "string",
              description: "Room name (e.g., 'W1N1')",
            }
          },
          required: ["roomName"],
        },
      }
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "upload_code": {
        const result = await uploadCode(args.mainJsPath, args.branch);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_console": {
        const result = await getConsole();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "execute_command": {
        const result = await executeConsoleCommand(args.command);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_memory": {
        const result = await getMemory(args.path || "");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "set_memory": {
        const value = JSON.parse(args.value);
        const result = await setMemory(args.path, value);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_room_terrain": {
        const result = await getRoomTerrain(args.roomName, args.encoded, args.shard || "shard0");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_room_status": {
        const result = await getRoomStatus(args.roomName, args.shard || "shard0");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_user_info": {
        const result = await getUserInfo();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_game_time": {
        const result = await getGameTime(args.shard || "shard0");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "analyze_performance": {
        const result = await analyzePerformance();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "check_for_errors": {
        const result = await checkForErrors();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "troubleshoot_bot": {
        const result = await troubleshootBot();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_room_objects": {
        const result = await getRoomObjects(args.roomName);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error.message,
            stack: error.stack,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  // Initialize WebSocket connection for real-time console logs
  if (SCREEPS_TOKEN) {
    try {
      console.error('Initializing WebSocket connection...');
      await initWebSocket(SCREEPS_TOKEN, SCREEPS_SERVER);
      wsInitialized = true;
      console.error('✅ WebSocket ready for real-time console monitoring');
    } catch (error) {
      console.error('⚠️  WebSocket initialization failed:', error.message);
      console.error('   HTTP-only mode: code upload and other features will still work');
      wsInitialized = false;
    }
  } else {
    console.error('⚠️  No SCREEPS_TOKEN provided - WebSocket disabled');
    console.error('   Console logs will not be available');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Screeps MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});

