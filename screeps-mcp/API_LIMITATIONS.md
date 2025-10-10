# Screeps API Limitations & Workarounds

This document explains the limitations of the Screeps HTTP API and how the MCP server handles them.

## Summary

✅ **What Works Perfectly**:
- Authentication (token & email/password)
- Code upload (`upload_code`)
- User info (`get_user_info`)
- Memory read/write (`get_memory`, `set_memory`)
- Room terrain (`get_room_terrain`)
- Room status (`get_room_status`)

⚠️ **What Has Limitations**:
- Console logs (`get_console`) - Requires WebSocket
- Console commands (`execute_command`) - Requires active bot
- Game time (`get_game_time`) - Requires valid shard and active session
- Performance analysis (`analyze_performance`) - Requires active bot

## Detailed Findings

### 1. Console Logs (HTTP API Limitation)

**Issue**: The `/api/user/console` endpoint returns 404

**Reason**: Console logs in Screeps are primarily available through WebSocket connections, not HTTP API.

**Workaround**:
- The MCP gracefully handles this by returning a note explaining the limitation
- Console commands can still be executed (when bot is active)
- Results appear in-game but not via HTTP API

**Future Enhancement**: Add WebSocket support using `node-screeps-api` library

**Example Response**:
```json
{
  "logs": [],
  "results": [],
  "error": "Console logs not available via HTTP API",
  "available": false,
  "note": "Console monitoring typically requires WebSocket connection"
}
```

### 2. Console Commands (Requires Active Bot)

**Issue**: The `/api/user/console` POST endpoint may return 404 if bot is not active

**Reason**: Console commands require an active game session with a running bot

**Workaround**:
- Deploy your bot code first using `upload_code`
- Wait for bot to start running in-game
- Then console commands will work
- Commands execute on next game tick

**MCP Behavior**: Returns helpful error message if bot is not active

### 3. Game Time (Shard Requirement)

**Issue**: `/api/game/time` returns "invalid shard" error

**Reason**: Screeps has multiple shards (servers). You must specify which one.

**Workaround**:
- The MCP now requires a `shard` parameter (default: "shard0")
- Common shards: "shard0", "shard1", "shard2", "shard3"
- You need an active session on that shard

**Updated Tool Usage**:
```
Get game time for shard0
Get game time for shard1
```

**API Call**: `GET /api/game/time?shard=shard0`

### 4. Performance Analysis (Requires Active Bot)

**Issue**: Performance metrics require executing console commands, which need an active bot

**Reason**: CPU, bucket, and game state info only exists when bot is running

**Workaround**:
1. Upload your code: `upload_code`
2. Wait 30-60 seconds for bot to spawn
3. Then run: `analyze_performance`

**Alternative**: Use `get_user_info` which works without an active bot and shows:
- GCL level
- CPU limit
- Credits
- Pixels

## Working Without Active Bot

Even without an active bot in-game, these tools work perfectly:

### ✅ Core Functionality
1. **`upload_code`** - Deploy your bot
2. **`get_user_info`** - Account details (GCL, CPU, credits, pixels)
3. **`get_memory`** - Read bot memory (returns empty if bot not run yet)
4. **`set_memory`** - Write bot configuration
5. **`get_room_terrain`** - Terrain maps (always available)
6. **`get_room_status`** - Room ownership info

### ⚠️ Requires Active Bot
1. **`get_console`** - Console logs
2. **`execute_command`** - Console commands
3. **`get_game_time`** - Current tick
4. **`analyze_performance`** - CPU/bucket metrics
5. **`get_room_objects`** - Live room data
6. **`troubleshoot_bot`** - Health check (partial functionality)

## Typical Workflow

### First Time Setup (No Bot Running)
```
1. "Show me my Screeps user info"
   ✅ Works - shows GCL, CPU, credits

2. "Upload my code at /path/to/main.js"
   ✅ Works - deploys your bot

3. Wait 30-60 seconds for bot to spawn in-game

4. "Analyze my bot's performance"
   ✅ Now works - bot is active
```

### Development Workflow (Bot Running)
```
1. Edit your main.js locally

2. "Upload my code at /path/to/main.js"
   ✅ Uploads changes

3. "Check for errors"
   ⚠️  Limited - may not see console logs
   ✅  But upload success confirms code is valid

4. Check in-game console manually for detailed logs
```

## WebSocket Support (Future Enhancement)

To get full console log access, we would need to:

1. Install `node-screeps-api` library
2. Add WebSocket connection support
3. Subscribe to console events
4. Stream logs in real-time

**Example Implementation** (not yet added):
```javascript
const { ScreepsAPI } = require('screeps-api');

const api = new ScreepsAPI({ token: SCREEPS_TOKEN });
await api.socket.connect();

api.socket.subscribe('console', (event) => {
  const { messages } = event.data;
  // Process messages...
});
```

**Trade-offs**:
- ✅ Real-time console logs
- ✅ Live error detection
- ❌ Requires persistent connection
- ❌ More complex setup
- ❌ Additional dependency

## API Endpoint Reference

### Working via HTTP
| Endpoint | Method | Works? | Notes |
|----------|--------|--------|-------|
| `/api/auth/me` | GET | ✅ Yes | User info, always works |
| `/api/user/code` | POST | ✅ Yes | Code upload, always works |
| `/api/user/memory` | GET | ✅ Yes | Memory read, returns empty if no bot |
| `/api/user/memory` | POST | ✅ Yes | Memory write, always works |
| `/api/game/room-terrain` | GET | ✅ Yes | Terrain, always works |
| `/api/game/room-status` | GET | ✅ Yes | Room status, always works |
| `/api/game/time` | GET | ⚠️ Partial | Requires shard + active session |
| `/api/user/console` | GET | ❌ No | Returns 404, use WebSocket |
| `/api/user/console` | POST | ⚠️ Partial | Requires active bot |

### Requires WebSocket
- Real-time console logs
- Live room events
- Active creep monitoring
- Memory change notifications

## Recommendations

### For Best Experience

1. **Start bot in-game first**
   - Navigate to https://screeps.com
   - Wait for your bot to spawn
   - Then use all MCP tools

2. **Use in-game console for debugging**
   - MCP excels at code upload and configuration
   - In-game console best for live debugging
   - Use both together for optimal workflow

3. **Monitor via user info**
   - `get_user_info` always works
   - Shows GCL progress, CPU, credits, pixels
   - Good indicator of bot health

4. **Upload early, upload often**
   - Code upload is instant and always works
   - No need to wait for bot state
   - Deploy frequently during development

### Error Messages You Might See

**"Console logs not available via HTTP API"**
- Normal behavior
- Use WebSocket or in-game console
- Code upload still works fine

**"Console command endpoint not available"**
- Bot not active in-game
- Upload code and wait for spawn
- Or check in-game if bot is running

**"invalid shard"**
- Need to specify correct shard name
- Try "shard0", "shard1", or "shard2"
- Check which shard your bot is on in-game

**"Memory accessible (0 bytes)"**
- Bot hasn't run yet to create memory
- Upload code and wait for first tick
- Memory will populate automatically

## Testing Your Setup

Run `npm test` to verify:
- ✅ Authentication works
- ✅ User info loads
- ✅ Memory endpoint accessible
- ⚠️ Console warnings (expected)
- ✅ Code upload endpoint ready

All tests passing means your MCP is ready to use!

## Support

For issues or questions:
1. Check this document for known limitations
2. Review `README.md` for tool usage
3. Check `INSTALL.md` for setup instructions
4. Verify bot is active in-game at https://screeps.com
5. Regenerate auth token if authentication fails

## Version Notes

**Version 1.0.0**:
- HTTP API only (no WebSocket)
- Core functionality (upload, memory, terrain) works
- Console features have known limitations
- Suitable for development workflow
- Future: WebSocket support planned

---

*Last Updated: 2025-10-10*
*Tested against: Screeps official server (screeps.com)*


