# Screeps MCP Server

A Model Context Protocol (MCP) server for interfacing with Screeps. This MCP provides AI assistants with tools to upload code, monitor console output, troubleshoot bots, and interact with the Screeps game state.

## Features

### 🚀 Code Management
- **Upload Code**: Deploy your bot code to Screeps servers
- **Branch Support**: Upload to different branches for testing

### 🔍 Monitoring & Debugging
- **Console Logs**: Retrieve and monitor console output
- **Execute Commands**: Run JavaScript commands in the Screeps console
- **Error Detection**: Automatically scan for errors and exceptions
- **Performance Analysis**: Monitor CPU, bucket, GCL, and resource usage
- **Comprehensive Troubleshooting**: Health checks with actionable recommendations

### 💾 Memory Management
- **Read Memory**: Access bot memory (full or specific paths)
- **Write Memory**: Modify bot memory for configuration
- **Memory Size Tracking**: Monitor memory usage

### 🗺️ Game State Access
- **Room Information**: Get room objects, structures, creeps, and resources
- **Terrain Data**: Retrieve terrain maps for pathfinding and planning
- **Room Status**: Check ownership, reservation, and controller status
- **User Info**: Access your GCL, CPU limits, and account details
- **Game Time**: Get current tick/time

## Installation

1. **Install Dependencies**:
   ```bash
   cd screeps-mcp
   npm install
   ```

2. **Configure Authentication**:
   
   Create a `.env` file (or set environment variables):
   ```bash
   # Option 1: Use Auth Token (Recommended)
   SCREEPS_TOKEN=your_screeps_auth_token_here
   
   # Option 2: Use Email/Password
   SCREEPS_EMAIL=your@email.com
   SCREEPS_PASSWORD=your_password
   
   # Optional: Custom Server
   SCREEPS_SERVER=https://screeps.com
   SCREEPS_BRANCH=default
   ```

3. **Get Your Auth Token**:
   - Go to https://screeps.com/a/#!/account/auth-tokens
   - Generate a token with "Full Access"
   - Copy the token to your `.env` file

## Usage with Claude Desktop

Add to your Claude Desktop MCP configuration:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "screeps": {
      "command": "node",
      "args": ["/home/azcoigreach/repos/mini-screeps/screeps-mcp/index.js"],
      "env": {
        "SCREEPS_TOKEN": "your_token_here",
        "SCREEPS_SERVER": "https://screeps.com",
        "SCREEPS_BRANCH": "default"
      }
    }
  }
}
```

After adding the configuration, restart Claude Desktop.

## Available Tools

### 1. `upload_code`
Upload your bot code to Screeps.

**Parameters**:
- `mainJsPath` (required): Path to your main.js file
- `branch` (optional): Branch name (default: "default")

**Example**:
```
Upload my bot code at /home/user/screeps/main.js to the experimental branch
```

### 2. `get_console`
Retrieve recent console logs.

**Example**:
```
Show me the console logs from my Screeps bot
```

### 3. `execute_command`
Execute JavaScript commands in the Screeps console.

**Parameters**:
- `command` (required): JavaScript expression to execute

**Examples**:
```
Execute the command: Game.time
Execute the command: Object.keys(Game.creeps).length
Execute the command: Memory.rooms['W1N1'].energyAvailable
```

### 4. `get_memory`
Get bot memory data.

**Parameters**:
- `path` (optional): Specific memory path (e.g., "rooms.W1N1")

**Examples**:
```
Get my bot's memory
Get memory at path: rooms.W1N1
```

### 5. `set_memory`
Set bot memory values.

**Parameters**:
- `path` (required): Memory path
- `value` (required): JSON value to set

**Example**:
```
Set memory at path 'config.debug' to value 'true'
```

### 6. `get_room_terrain`
Get terrain data for a room.

**Parameters**:
- `roomName` (required): Room name (e.g., "W1N1")
- `encoded` (optional): Return encoded format (default: false)

**Example**:
```
Get terrain for room W1N1
```

### 7. `get_room_status`
Get room status (ownership, reservation).

**Parameters**:
- `roomName` (required): Room name

**Example**:
```
Get status for room W1N1
```

### 8. `get_user_info`
Get your user information.

**Example**:
```
Show me my Screeps user info
```

### 9. `get_game_time`
Get current game tick.

**Example**:
```
What's the current game time?
```

### 10. `analyze_performance`
Comprehensive performance analysis.

**Returns**:
- CPU usage and bucket level
- GCL level and progress
- Room and creep counts
- Tick number

**Example**:
```
Analyze my bot's performance
```

### 11. `check_for_errors`
Scan console logs for errors.

**Returns**:
- Error count
- List of errors
- All recent logs

**Example**:
```
Check if my bot has any errors
```

### 12. `troubleshoot_bot`
Comprehensive health check with recommendations.

**Returns**:
- Performance metrics
- Error analysis
- Memory usage
- Actionable recommendations

**Example**:
```
Troubleshoot my Screeps bot
```

### 13. `get_room_objects`
Get detailed room information.

**Parameters**:
- `roomName` (required): Room name

**Returns**:
- Structure count
- Creep counts (friendly and hostile)
- Energy available
- Controller status

**Example**:
```
Get information about room W1N1
```

## Common Use Cases

### 1. Deploy and Monitor
```
Upload my code at /home/user/screeps/main.js
Wait a few seconds
Show me the console logs
Check for errors
```

### 2. Troubleshoot Issues
```
Troubleshoot my bot
Show me the console logs
Analyze performance
```

### 3. Check Room Status
```
Get information about room W1N1
Get terrain for room W1N1
Get status for room W1N1
```

### 4. Debug Bot Behavior
```
Execute command: JSON.stringify(Memory.creeps)
Execute command: Object.keys(Game.creeps).forEach(name => console.log(name, Game.creeps[name].memory.role))
```

### 5. Monitor Performance
```
Analyze performance
What's my CPU bucket level?
How many creeps do I have?
```

## Troubleshooting

### Authentication Errors
- Ensure `SCREEPS_TOKEN` is set correctly
- Verify your token has "Full Access" permissions
- Check that your token hasn't expired

### Connection Issues
- Verify `SCREEPS_SERVER` URL is correct
- Check your internet connection
- Ensure firewall isn't blocking the connection

### Command Execution Delays
- Console commands may take 1-2 game ticks to execute
- Results appear in the next `get_console` call
- Use `troubleshoot_bot` for immediate analysis

### Path Issues
- Use absolute paths for `mainJsPath` parameter
- Ensure the file exists and is readable
- Check file permissions

## Development

### Testing Locally
```bash
# Start the MCP server
npm start

# Or with hot reload
npm run dev
```

### Adding New Tools
1. Add the tool definition in `ListToolsRequestSchema` handler
2. Implement the function to handle the tool logic
3. Add the case in `CallToolRequestSchema` handler
4. Update this README with the new tool

## API Reference

This MCP uses the official Screeps HTTP API:
- Base URL: `https://screeps.com/api`
- Authentication: Token-based (X-Token header) or Basic Auth
- Documentation: https://docs.screeps.com/auth-tokens.html

### Key Endpoints Used
- `POST /api/user/code` - Upload code
- `GET /api/user/console` - Get console logs
- `POST /api/user/console` - Execute console command
- `GET /api/user/memory` - Get memory
- `POST /api/user/memory` - Set memory
- `GET /api/game/room-terrain` - Get terrain
- `GET /api/game/room-status` - Get room status
- `GET /api/auth/me` - Get user info
- `GET /api/game/time` - Get game time

## Security

- **Never commit tokens**: Add `.env` to `.gitignore`
- **Use environment variables**: Don't hardcode credentials
- **Token permissions**: Use minimal required permissions
- **Rotate tokens**: Regularly regenerate auth tokens

## Contributing

Contributions welcome! Areas for improvement:
- WebSocket support for real-time console monitoring
- Market API integration
- Segment memory support
- Room visualization tools
- Battle replay analysis
- Performance profiling tools

## License

MIT

## Related Resources

- [Screeps Documentation](https://docs.screeps.com/)
- [Screeps API Reference](https://docs.screeps.com/api/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Mini-Screeps Bot](../README.md)

## Version History

### 1.0.0 (2025-10-10)
- Initial release
- Code upload functionality
- Console monitoring and command execution
- Memory management
- Performance analysis and troubleshooting
- Room information and terrain access
- Game state queries


