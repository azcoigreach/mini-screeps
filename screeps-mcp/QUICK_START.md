# Screeps MCP Quick Start Guide

Get your Screeps MCP server up and running in 5 minutes!

## Step 1: Install Dependencies

```bash
cd /home/azcoigreach/repos/mini-screeps/screeps-mcp
npm install
```

## Step 2: Get Your Screeps Auth Token

1. Log in to Screeps at https://screeps.com
2. Navigate to Account Settings → Auth Tokens: https://screeps.com/a/#!/account/auth-tokens
3. Click "Generate New Token"
4. Give it a name (e.g., "MCP Server")
5. Select "Full Access" permission
6. Copy the generated token

## Step 3: Configure Environment

Create a `.env` file in the `screeps-mcp` directory:

```bash
cp .env.example .env
```

Edit `.env` and add your token:

```bash
SCREEPS_TOKEN=your_token_here
SCREEPS_SERVER=https://screeps.com
SCREEPS_BRANCH=default
```

## Step 3.5: Test Your Connection (Recommended)

Before setting up Claude, verify your credentials work:

```bash
npm test
```

You should see:
```
✓ Connection successful!
✓ Game time: 12345678
✓ Console accessible
✓ Memory accessible
✅ All tests passed!
```

If you see errors, check your token and try again.

## Step 4: Test the Server

```bash
npm start
```

You should see: `Screeps MCP Server running on stdio`

Press `Ctrl+C` to stop.

## Step 5: Configure Claude Desktop

### Find Your Config File

- **MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### Edit the Config

Add the Screeps MCP server to your config:

```json
{
  "mcpServers": {
    "screeps": {
      "command": "node",
      "args": ["/home/azcoigreach/repos/mini-screeps/screeps-mcp/index.js"],
      "env": {
        "SCREEPS_TOKEN": "paste_your_token_here",
        "SCREEPS_SERVER": "https://screeps.com",
        "SCREEPS_BRANCH": "default"
      }
    }
  }
}
```

**Important**: Replace the path with your actual path and paste your real token!

### Restart Claude Desktop

Close and reopen Claude Desktop for the changes to take effect.

## Step 6: Test It!

In Claude Desktop, try these commands:

### 1. Check if it's working
```
What Screeps tools do you have available?
```

### 2. Get your user info
```
Show me my Screeps user information
```

### 3. Check game time
```
What's the current Screeps game time?
```

### 4. Analyze your bot
```
Troubleshoot my Screeps bot
```

### 5. Upload code (if you have main.js)
```
Upload my Screeps code at /home/azcoigreach/repos/mini-screeps/main.js
```

## Common Commands

### Monitoring
- "Show me the console logs"
- "Check if my bot has any errors"
- "Analyze my bot's performance"
- "What's my CPU bucket level?"

### Code Management
- "Upload my code at [path] to the default branch"
- "Upload my code at [path] to the experimental branch"

### Debugging
- "Troubleshoot my bot"
- "Execute this command: Game.time"
- "Execute this command: Object.keys(Game.creeps)"

### Room Information
- "Get information about room W1N1"
- "Get terrain for room W1N1"
- "Show me the status of room W1N1"

### Memory Management
- "Show me my bot's memory"
- "Get memory at path: rooms.W1N1"
- "Set memory at path 'config.debug' to value 'true'"

## Troubleshooting

### "MCP server not found"
- Check that the path in `claude_desktop_config.json` is correct
- Verify the path exists: `ls /home/azcoigreach/repos/mini-screeps/screeps-mcp/index.js`
- Make sure you restarted Claude Desktop after editing config

### "Authentication failed"
- Verify your token in the `.env` file or Claude config
- Check that the token hasn't expired
- Ensure the token has "Full Access" permission

### "Cannot find module"
- Run `npm install` in the screeps-mcp directory
- Check that `node_modules` folder exists

### "Command not executing"
- Console commands take 1-2 game ticks to execute
- Try checking console logs after executing: "Execute command X, then show me the logs"
- Some commands need to be wrapped in JSON.stringify() for output

## Next Steps

### Explore All Tools
Check the full [README.md](README.md) for all 13 available tools and their detailed usage.

### Automate Your Workflow
Use the MCP to:
- Monitor your bot continuously
- Upload code after changes
- Debug issues automatically
- Check performance metrics
- Analyze room strategies

### Build Custom Workflows
Combine tools for powerful workflows:
```
Upload my code, wait 5 seconds, check for errors, then analyze performance
```

### Advanced Usage
- Execute complex JavaScript in console
- Parse and analyze memory data
- Monitor multiple rooms
- Track resource flow
- Optimize spawn queues

## Example Session

Here's a complete example workflow:

```
User: Upload my Screeps code at /home/user/screeps/main.js
