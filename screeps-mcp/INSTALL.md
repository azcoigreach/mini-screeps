# Screeps MCP - Complete Installation Guide

This guide will walk you through setting up the Screeps MCP server from scratch.

## Prerequisites

- **Node.js 18+** installed
- **npm** package manager
- A **Screeps account** (https://screeps.com)
- **Claude Desktop** (for AI integration) or any MCP-compatible client

## Installation Steps

### 1. Navigate to the MCP Directory

```bash
cd /home/azcoigreach/repos/mini-screeps/screeps-mcp
```

### 2. Install Dependencies

```bash
npm install
```

This will install:
- `@modelcontextprotocol/sdk` - MCP framework
- `axios` - HTTP client for Screeps API
- `dotenv` - Environment variable management

### 3. Get Your Screeps Authentication Token

#### Option A: Token Authentication (Recommended)

1. Log in to Screeps: https://screeps.com
2. Go to Account Settings → Auth Tokens: https://screeps.com/a/#!/account/auth-tokens
3. Click "Generate New Token"
4. Name it (e.g., "MCP Server")
5. Select **"Full Access"** permission
6. Copy the token (you'll need it in the next step)

#### Option B: Email/Password (Alternative)

You can also use your Screeps email and password, but token auth is more secure.

### 4. Create Environment Configuration

```bash
cp .env.example .env
```

Edit the `.env` file:

```bash
nano .env
# or
code .env
# or
vim .env
```

Add your credentials:

```env
# Option 1: Token (Recommended)
SCREEPS_TOKEN=your_actual_token_here

# Option 2: Email/Password
# SCREEPS_EMAIL=your@email.com
# SCREEPS_PASSWORD=your_password

# Server Configuration
SCREEPS_SERVER=https://screeps.com
SCREEPS_BRANCH=default
```

**Important**: 
- Use your actual token, not "your_actual_token_here"
- Don't use quotes around the token
- Save the file

### 5. Test Your Connection

```bash
npm test
```

Expected output:
```
✓ Loaded .env file

🔍 Screeps MCP Connection Test

Configuration:
  Server: https://screeps.com
  Token: ✓ Set (abc12345...)
  
✓ Using token authentication (recommended)

📡 Testing connection...
✓ Connection successful!

👤 User Information:
  Username: YourUsername
  GCL: 1
  CPU Limit: 20
  Credits: 0

⏰ Testing game time endpoint...
✓ Game time: 12345678

💬 Testing console endpoint...
✓ Console accessible (5 recent messages)

💾 Testing memory endpoint...
✓ Memory accessible (1234 bytes)

✅ All tests passed!

🎉 Your Screeps MCP is ready to use!
```

If you see errors:
- **401 Unauthorized**: Check your token is correct
- **Cannot find module**: Run `npm install` again
- **ENOTFOUND**: Check your internet connection

### 6. Verify MCP Server Starts

```bash
npm start
```

You should see:
```
Screeps MCP Server running on stdio
```

This means it's working! Press `Ctrl+C` to stop.

## Claude Desktop Integration

### 7. Find Your Claude Config File

The location depends on your operating system:

**Linux**:
```bash
~/.config/Claude/claude_desktop_config.json
```

**MacOS**:
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows**:
```
%APPDATA%\Claude\claude_desktop_config.json
```

### 8. Edit Claude Desktop Config

Open the config file in your editor:

```bash
# Linux/Mac
nano ~/.config/Claude/claude_desktop_config.json

# Or use VS Code
code ~/.config/Claude/claude_desktop_config.json
```

If the file doesn't exist, create it with this content:

```json
{
  "mcpServers": {
    "screeps": {
      "command": "node",
      "args": [
        "/home/azcoigreach/repos/mini-screeps/screeps-mcp/index.js"
      ],
      "env": {
        "SCREEPS_TOKEN": "paste_your_actual_token_here",
        "SCREEPS_SERVER": "https://screeps.com",
        "SCREEPS_BRANCH": "default"
      }
    }
  }
}
```

If the file already exists with other MCP servers, add the "screeps" section:

```json
{
  "mcpServers": {
    "existing-server": {
      ...existing config...
    },
    "screeps": {
      "command": "node",
      "args": [
        "/home/azcoigreach/repos/mini-screeps/screeps-mcp/index.js"
      ],
      "env": {
        "SCREEPS_TOKEN": "paste_your_actual_token_here",
        "SCREEPS_SERVER": "https://screeps.com",
        "SCREEPS_BRANCH": "default"
      }
    }
  }
}
```

**Important**:
- Replace `/home/azcoigreach/repos/mini-screeps/screeps-mcp/index.js` with your actual path
- Replace `paste_your_actual_token_here` with your real token
- Don't escape quotes or add extra formatting
- Make sure the JSON is valid (use a JSON validator if unsure)

### 9. Restart Claude Desktop

**Completely close** Claude Desktop (not just minimize), then reopen it.

On Linux:
```bash
pkill claude
# Then open Claude Desktop from your applications menu
```

### 10. Test in Claude

Open Claude Desktop and try these commands:

**Test 1: Check Available Tools**
```
What Screeps tools do you have available?
```

Expected: Claude lists 13 tools including upload_code, get_console, troubleshoot_bot, etc.

**Test 2: Get User Info**
```
Show me my Screeps user information
```

Expected: Claude returns your username, GCL, CPU limit, etc.

**Test 3: Get Game Time**
```
What's the current Screeps game time?
```

Expected: Claude returns the current game tick number.

**Test 4: Troubleshoot**
```
Troubleshoot my Screeps bot
```

Expected: Claude performs a health check and gives recommendations.

## Troubleshooting

### MCP Not Showing in Claude

**Problem**: Claude doesn't recognize Screeps commands

**Solutions**:
1. Check the path in `claude_desktop_config.json` is correct
2. Verify the path exists: `ls /path/to/screeps-mcp/index.js`
3. Make sure you **completely restarted** Claude Desktop
4. Check Claude's logs for errors (usually in `~/.config/Claude/logs/`)
5. Verify JSON syntax is valid: `cat ~/.config/Claude/claude_desktop_config.json | jq`

### Authentication Errors

**Problem**: "401 Unauthorized" or "Authentication failed"

**Solutions**:
1. Verify your token in `.env` file
2. Check the token hasn't expired
3. Ensure the token has "Full Access" permission
4. Try regenerating a new token
5. If using email/password, check for typos

### Module Not Found

**Problem**: "Cannot find module '@modelcontextprotocol/sdk'"

**Solutions**:
1. Run `npm install` in the screeps-mcp directory
2. Check that `node_modules` folder exists
3. Try deleting `node_modules` and `package-lock.json`, then run `npm install` again

### Connection Timeouts

**Problem**: Requests to Screeps timeout

**Solutions**:
1. Check your internet connection
2. Verify SCREEPS_SERVER URL is correct
3. Try accessing https://screeps.com in a browser
4. If using a private server, ensure it's running

### Console Commands Not Working

**Problem**: Commands execute but no output

**Solutions**:
1. Console commands take 1-2 game ticks to execute
2. Try: "Execute this command: Game.time, then show me the console logs"
3. Wrap complex objects in JSON.stringify()
4. Check if your bot is actually running in game

## Verification Checklist

✅ Node.js 18+ installed (`node --version`)  
✅ Dependencies installed (`npm install` succeeded)  
✅ `.env` file created with token  
✅ Connection test passed (`npm test` shows all green)  
✅ MCP server starts (`npm start` shows "running on stdio")  
✅ Claude config file edited with correct path  
✅ Claude Desktop completely restarted  
✅ Claude recognizes Screeps tools  
✅ Test commands work in Claude  

## Next Steps

Now that your MCP is installed:

1. **Read the Documentation**
   - `README.md` - Full tool reference
   - `QUICK_START.md` - Common commands
   - `API_REFERENCE.md` - API details

2. **Try Common Workflows**
   ```
   Upload my code at /path/to/main.js
   Check for errors
   Analyze my bot's performance
   Get information about room W1N1
   ```

3. **Explore All 13 Tools**
   - Code upload
   - Console monitoring
   - Error detection
   - Performance analysis
   - Memory management
   - Room information
   - Troubleshooting

4. **Automate Your Development**
   Use Claude to:
   - Monitor your bot continuously
   - Debug issues automatically
   - Optimize performance
   - Analyze room strategies

## Getting Help

- **Check logs**: `~/.config/Claude/logs/` (Claude Desktop)
- **Test connection**: `npm test` (MCP server)
- **Verify auth**: Log in to https://screeps.com manually
- **Read docs**: See README.md and QUICK_START.md
- **Discord**: Join Screeps community on Discord

## Uninstallation

To remove the MCP:

1. Remove from Claude config:
   ```bash
   # Edit and remove the "screeps" section
   nano ~/.config/Claude/claude_desktop_config.json
   ```

2. Restart Claude Desktop

3. (Optional) Delete the MCP files:
   ```bash
   cd /home/azcoigreach/repos/mini-screeps
   rm -rf screeps-mcp
   ```

## Updates

To update the MCP in the future:

```bash
cd /home/azcoigreach/repos/mini-screeps/screeps-mcp
git pull  # If using git
npm install  # Update dependencies
npm test  # Verify still working
```

Then restart Claude Desktop.

## Security Notes

- Your `.env` file contains sensitive credentials - never commit it to git
- The `.gitignore` file protects your `.env` automatically
- Token auth is more secure than email/password
- Rotate your tokens periodically
- Use "Full Access" only for trusted tools

## Success!

You've successfully installed the Screeps MCP! 🎉

Try it now:
```
Hey Claude, show me my Screeps user info and troubleshoot my bot
```

Happy coding! 🚀


