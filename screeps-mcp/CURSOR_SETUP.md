# Screeps MCP Setup for Cursor

## Quick Setup for Cursor IDE

### 1. Find Your Cursor MCP Config

Cursor stores MCP configurations in:
- **Linux**: `~/.cursor/mcp_config.json`
- **MacOS**: `~/Library/Application Support/Cursor/mcp_config.json`
- **Windows**: `%APPDATA%\Cursor\mcp_config.json`

### 2. Create/Edit the Config File

```bash
# Linux/Mac
nano ~/.cursor/mcp_config.json

# Or use any editor
code ~/.cursor/mcp_config.json
```

### 3. Add Screeps MCP Configuration

If the file doesn't exist, create it with:

```json
{
  "mcpServers": {
    "screeps": {
      "command": "node",
      "args": [
        "/home/azcoigreach/repos/mini-screeps/screeps-mcp/index.js"
      ],
      "env": {
        "SCREEPS_TOKEN": "534cb69f...",
        "SCREEPS_SERVER": "https://screeps.com",
        "SCREEPS_BRANCH": "default"
      }
    }
  }
}
```

If the file already exists with other MCPs, just add the "screeps" section:

```json
{
  "mcpServers": {
    "existing-mcp": {
      ...
    },
    "screeps": {
      "command": "node",
      "args": [
        "/home/azcoigreach/repos/mini-screeps/screeps-mcp/index.js"
      ],
      "env": {
        "SCREEPS_TOKEN": "534cb69f...",
        "SCREEPS_SERVER": "https://screeps.com",
        "SCREEPS_BRANCH": "default"
      }
    }
  }
}
```

**Important**: Replace `534cb69f...` with your full token from the `.env` file!

### 4. Reload Cursor

After adding the config:
1. Save the file
2. Restart Cursor or reload the window
   - **Command Palette** (Ctrl+Shift+P / Cmd+Shift+P)
   - Type: "Reload Window"
   - Or just restart Cursor completely

### 5. Test It!

In the Cursor chat (Ctrl+L / Cmd+L), try:

```
Show me my Screeps user info
```

You should see your account details (Username: Stranger, GCL: 1720, etc.)

Then try:
```
Upload my Screeps code at /home/azcoigreach/repos/mini-screeps/main.js
```

## Verification

You'll know it's working when:
- ✅ Cursor recognizes Screeps commands
- ✅ You can ask "What Screeps tools do you have?"
- ✅ Commands return actual data from your account

## Troubleshooting

### MCP Not Showing Up

1. Check the config file path is correct
2. Verify JSON syntax is valid: `cat ~/.cursor/mcp_config.json | jq`
3. Make sure the path to index.js is absolute
4. Restart Cursor completely (not just reload)

### Permission Errors

```bash
chmod +x /home/azcoigreach/repos/mini-screeps/screeps-mcp/index.js
```

### Node Not Found

Make sure node is in your PATH:
```bash
which node
# Should show: /usr/bin/node or similar
```

If not found, use full path in config:
```json
"command": "/usr/bin/node"
```

## Quick Test Commands

Once configured, try these in Cursor chat:

```
# Basic info
Show me my Screeps user info

# Upload code
Upload my code at /home/azcoigreach/repos/mini-screeps/main.js

# Memory
Get my bot's memory

# Room info
Get terrain for room W1N1

# Account stats
How many pixels do I have?
What's my GCL level?
```

## Using in Cursor Composer

You can also use the MCP in Cursor Composer (Ctrl+I / Cmd+I):

```
@screeps upload my code at /home/azcoigreach/repos/mini-screeps/main.js
@screeps show me my account info
```

## Config File Template

Here's the complete template for your system:

```json
{
  "mcpServers": {
    "screeps": {
      "command": "node",
      "args": [
        "/home/azcoigreach/repos/mini-screeps/screeps-mcp/index.js"
      ],
      "env": {
        "SCREEPS_TOKEN": "YOUR_FULL_TOKEN_HERE",
        "SCREEPS_SERVER": "https://screeps.com",
        "SCREEPS_BRANCH": "default"
      }
    }
  }
}
```

Copy your token from:
```bash
cat /home/azcoigreach/repos/mini-screeps/screeps-mcp/.env | grep SCREEPS_TOKEN
```

## Benefits in Cursor

Using the Screeps MCP in Cursor gives you:
- 🚀 Quick code deployment without leaving IDE
- 🔍 Instant account status checks
- ⚙️ Memory configuration on the fly
- 🗺️ Room analysis while coding
- 📊 GCL/CPU/Pixel monitoring
- 💾 Direct memory read/write

## Example Workflow

```
1. Write code in main.js
2. Ask Cursor: "Upload my code"
3. Cursor uses MCP to deploy
4. Continue coding
5. Ask: "Check my CPU usage"
6. Get instant feedback
```

## Success!

You're now set up to use the Screeps MCP directly in Cursor! 🎉

Try it now:
```
Show me my Screeps user info
```


