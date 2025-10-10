# Screeps MCP API Reference

Complete reference for all Screeps API endpoints used by this MCP server.

## Authentication

All API requests require authentication using one of these methods:

### Token Authentication (Recommended)
```http
X-Token: your_auth_token
```

### Basic Authentication
```http
Authorization: Basic base64(email:password)
```

## Base URL
```
https://screeps.com/api
```

For private servers, use your custom server URL.

---

## Code Management

### Upload Code
Upload bot code to a specific branch.

**Endpoint**: `POST /api/user/code`

**Request Body**:
```json
{
  "branch": "default",
  "modules": {
    "main": "module.exports.loop = function() { ... }"
  }
}
```

**Response**:
```json
{
  "ok": 1,
  "timestamp": 1234567890
}
```

**MCP Tool**: `upload_code`

---

## Console Management

### Get Console Logs
Retrieve recent console output.

**Endpoint**: `GET /api/user/console`

**Response**:
```json
{
  "ok": 1,
  "log": [
    "Console message 1",
    "Console message 2"
  ],
  "results": ["result1", "result2"],
  "error": null
}
```

**MCP Tool**: `get_console`

---

### Execute Console Command
Run JavaScript code in the game console.

**Endpoint**: `POST /api/user/console`

**Request Body**:
```json
{
  "expression": "Game.time"
}
```

**Response**:
```json
{
  "ok": 1,
  "result": {
    "ok": 1,
    "n": 1
  }
}
```

**Notes**:
- Commands execute on the next game tick
- Results appear in subsequent console log calls
- Wrap output in `JSON.stringify()` for complex objects

**MCP Tool**: `execute_command`

---

## Memory Management

### Get Memory
Retrieve bot memory.

**Endpoint**: `GET /api/user/memory`

**Query Parameters**:
- `path` (optional): Specific memory path (e.g., `rooms.W1N1`)

**Response**:
```json
{
  "ok": 1,
  "data": "{\"rooms\":{...}}",
  "tick": 12345678
}
```

**MCP Tool**: `get_memory`

---

### Set Memory
Modify bot memory.

**Endpoint**: `POST /api/user/memory`

**Request Body**:
```json
{
  "path": "config.debug",
  "value": "true"
}
```

**Response**:
```json
{
  "ok": 1,
  "data": "true",
  "tick": 12345678
}
```

**MCP Tool**: `set_memory`

---

## Game State

### Get Room Terrain
Retrieve terrain data for a room.

**Endpoint**: `GET /api/game/room-terrain`

**Query Parameters**:
- `room` (required): Room name (e.g., `W1N1`)
- `encoded` (optional): Return encoded format (1 or 0)

**Response (Encoded)**:
```json
{
  "ok": 1,
  "terrain": [{
    "room": "W1N1",
    "x": 0,
    "y": 0,
    "type": "wall"
  }]
}
```

**Terrain Types**:
- `plain` (0): Normal terrain
- `wall` (1): Impassable wall
- `swamp` (2): Swamp (slower movement)

**MCP Tool**: `get_room_terrain`

---

### Get Room Status
Get room ownership and reservation information.

**Endpoint**: `GET /api/game/room-status`

**Query Parameters**:
- `room` (required): Room name

**Response**:
```json
{
  "ok": 1,
  "room": "W1N1",
  "status": "normal",
  "owner": {
    "username": "Player1",
    "badge": {...}
  },
  "reservation": {
    "username": "Player2",
    "endTime": 12345678
  }
}
```

**Status Values**:
- `normal`: Regular room
- `closed`: Novice/respawn area
- `out of borders`: Invalid room

**MCP Tool**: `get_room_status`

---

### Get Game Time
Get current game tick.

**Endpoint**: `GET /api/game/time`

**Response**:
```json
{
  "ok": 1,
  "time": 12345678
}
```

**MCP Tool**: `get_game_time`

---

## User Information

### Get User Info
Retrieve authenticated user details.

**Endpoint**: `GET /api/auth/me`

**Response**:
```json
{
  "ok": 1,
  "user": {
    "_id": "user_id",
    "username": "YourUsername",
    "gcl": 1000000,
    "cpu": 20,
    "cpuAvailable": 10000,
    "money": 50000,
    "badge": {...},
    "email": "your@email.com"
  }
}
```

**Fields**:
- `gcl`: Global Control Level progress
- `cpu`: CPU limit
- `cpuAvailable`: Available CPU from subscription
- `money`: Credits balance

**MCP Tool**: `get_user_info`

---

## Composite Tools

These tools combine multiple API calls for enhanced functionality.

### Analyze Performance
Executes console command to gather comprehensive performance data.

**Console Command**:
```javascript
JSON.stringify({
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
})
```

**MCP Tool**: `analyze_performance`

---

### Check For Errors
Scans console logs for error patterns.

**Error Patterns**:
- Contains "error" (case-insensitive)
- Contains "exception"
- Contains "undefined"

**MCP Tool**: `check_for_errors`

---

### Troubleshoot Bot
Comprehensive health check combining:
1. Performance analysis
2. Error checking
3. Memory inspection
4. User info
5. Actionable recommendations

**Recommendations Include**:
- CPU bucket warnings
- Error counts and details
- Memory usage concerns
- Creep population issues

**MCP Tool**: `troubleshoot_bot`

---

### Get Room Objects
Retrieves detailed room information via console.

**Console Command**:
```javascript
JSON.stringify({
  structures: Game.rooms['ROOM'].find(FIND_STRUCTURES).length,
  creeps: Game.rooms['ROOM'].find(FIND_MY_CREEPS).length,
  hostiles: Game.rooms['ROOM'].find(FIND_HOSTILE_CREEPS).length,
  energy: Game.rooms['ROOM'].energyAvailable,
  controller: {
    level: Game.rooms['ROOM'].controller.level,
    progress: Game.rooms['ROOM'].controller.progress,
    progressTotal: Game.rooms['ROOM'].controller.progressTotal
  }
})
```

**MCP Tool**: `get_room_objects`

---

## Rate Limits

Screeps API has rate limiting:
- **Typical Limit**: 120 requests per minute
- **Token Auth**: Higher limits than basic auth
- **Console Commands**: Limited to 10 per tick
- **Memory Access**: No specific limits but impacts CPU

**Best Practices**:
- Cache data when possible
- Use composite tools to reduce API calls
- Implement exponential backoff on errors
- Avoid polling console logs too frequently

---

## Error Handling

### Common Error Codes

**401 Unauthorized**
- Invalid token or credentials
- Token expired
- Insufficient permissions

**429 Too Many Requests**
- Rate limit exceeded
- Wait before retrying

**500 Internal Server Error**
- Screeps server issue
- Retry with exponential backoff

### Error Response Format
```json
{
  "ok": 0,
  "error": "error message"
}
```

---

## Security Best Practices

1. **Use Token Auth**: More secure than email/password
2. **Rotate Tokens**: Regenerate periodically
3. **Minimal Permissions**: Use least privilege principle
4. **Environment Variables**: Never hardcode credentials
5. **Private Servers**: Use HTTPS with valid certificates

---

## Additional Resources

- **Official Docs**: https://docs.screeps.com/
- **API Reference**: https://docs.screeps.com/api/
- **Auth Tokens**: https://docs.screeps.com/auth-tokens.html
- **Community**: https://screeps.com/forum/
- **Discord**: https://discord.gg/screeps

---

## Unsupported Features

The following Screeps API features are not yet implemented but could be added:

### Market API
- `GET /api/game/market/orders`
- `POST /api/game/market/orders`
- Market history and statistics

### Segments
- Memory segments for inter-shard communication
- `GET /api/user/memory-segment`
- `POST /api/user/memory-segment`

### Rooms API
- Room history and statistics
- `GET /api/game/room-overview`
- Power bank data

### Shards
- Multi-shard support
- `GET /api/game/shards/info`

### WebSocket
- Real-time console streaming
- Live game events
- Room visibility updates

---

## Version History

### 1.0.0
- Initial API implementation
- Basic code upload
- Console management
- Memory access
- Room information
- User info
- Performance analysis
- Error detection
- Troubleshooting tools

---

## Contributing

To add new API endpoints:

1. Add the function in `index.js`
2. Add the tool definition in `ListToolsRequestSchema`
3. Add the handler in `CallToolRequestSchema`
4. Document it in this file
5. Update README.md with usage examples
6. Test thoroughly

Example template:
```javascript
/**
 * Description of what this does
 */
async function newApiFunction(params) {
  const client = createAuthenticatedClient();
  const response = await client.get('/api/endpoint', { params });
  return response.data;
}
```

---

*Last Updated: 2025-10-10*


