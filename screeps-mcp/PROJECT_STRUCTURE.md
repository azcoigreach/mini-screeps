# Screeps MCP Project Structure

Visual overview of the complete project structure and file organization.

## Directory Tree

```
mini-screeps/
├── main.js                          # Your Screeps bot code (6000+ lines)
├── README.md                        # Bot documentation (updated with MCP info)
├── MCP_SUMMARY.md                   # Complete MCP implementation summary
├── upload-to-screeps.sh             # Original upload script (still works!)
│
└── screeps-mcp/                     # 🆕 MCP Server Directory
    ├── index.js                     # Main MCP server (13 tools implemented)
    ├── package.json                 # Node.js dependencies and scripts
    ├── test-connection.js           # Connection test utility
    │
    ├── .env.example                 # Environment variable template
    ├── .gitignore                   # Protects sensitive files
    │
    ├── README.md                    # Full MCP documentation (13 tools)
    ├── QUICK_START.md               # 5-minute setup guide
    ├── INSTALL.md                   # Complete installation guide
    ├── API_REFERENCE.md             # Screeps API documentation
    ├── CHANGELOG.md                 # Version history
    ├── PROJECT_STRUCTURE.md         # This file
    │
    └── claude_desktop_config.example.json  # Claude Desktop config template
```

## File Descriptions

### Core MCP Files

#### `index.js` (Main Server)
**Lines**: ~700
**Purpose**: Complete MCP server implementation
**Contents**:
- 13 tool implementations
- Authentication handling (token + email/password)
- Axios HTTP client setup
- Error handling and recommendations
- MCP SDK integration

**Key Functions**:
```javascript
createAuthenticatedClient()  // Auth setup
uploadCode()                 // Upload bot code
getConsole()                 // Get console logs
executeConsoleCommand()      // Run commands
getMemory() / setMemory()    // Memory management
getRoomTerrain()             // Terrain data
getRoomStatus()              // Room info
getUserInfo()                // User details
analyzePerformance()         // Performance metrics
troubleshootBot()            // Health check + recommendations
```

#### `package.json` (Dependencies)
**Purpose**: Node.js project configuration
**Scripts**:
- `npm start` - Start MCP server
- `npm test` - Test connection
- `npm run dev` - Development mode with hot reload

**Dependencies**:
- `@modelcontextprotocol/sdk` (0.5.0) - MCP framework
- `axios` (1.6.0) - HTTP client
- `dotenv` (16.0.0) - Environment variables

#### `test-connection.js` (Test Utility)
**Lines**: ~150
**Purpose**: Verify authentication and connection
**Tests**:
- Authentication setup
- API connectivity
- User info retrieval
- Console access
- Memory access
- Game time endpoint

**Usage**: `npm test`

### Configuration Files

#### `.env.example` (Template)
**Purpose**: Environment variable template
**Contents**:
```env
SCREEPS_TOKEN=your_token_here
SCREEPS_EMAIL=your@email.com
SCREEPS_PASSWORD=your_password
SCREEPS_SERVER=https://screeps.com
SCREEPS_BRANCH=default
```

**Usage**: Copy to `.env` and fill in credentials

#### `.gitignore`
**Purpose**: Protect sensitive files from git
**Protects**:
- `.env` files
- `node_modules/`
- Log files
- IDE settings

#### `claude_desktop_config.example.json`
**Purpose**: Ready-to-use Claude Desktop configuration
**Contains**: Complete MCP server setup for Claude
**Usage**: Copy contents to your Claude config file

### Documentation Files

#### `README.md` (Full Documentation)
**Lines**: ~500
**Sections**:
- Feature overview
- Installation instructions
- All 13 tools documented
- Usage examples
- Troubleshooting
- API reference
- Claude Desktop integration

**Audience**: All users

#### `QUICK_START.md` (Getting Started)
**Lines**: ~200
**Sections**:
- 5-minute setup guide
- Step-by-step instructions
- Common commands
- Testing procedures
- Example workflows

**Audience**: New users

#### `INSTALL.md` (Complete Installation)
**Lines**: ~400
**Sections**:
- Prerequisites
- Detailed installation steps
- Claude Desktop integration
- Troubleshooting guide
- Verification checklist
- Security notes

**Audience**: First-time installers

#### `API_REFERENCE.md` (API Documentation)
**Lines**: ~600
**Sections**:
- All Screeps API endpoints
- Request/response formats
- Authentication methods
- Rate limits
- Error handling
- Composite tool details

**Audience**: Developers and advanced users

#### `CHANGELOG.md` (Version History)
**Lines**: ~200
**Sections**:
- Current version (1.0.0)
- Feature list
- Known limitations
- Future enhancements

**Audience**: All users tracking changes

#### `PROJECT_STRUCTURE.md` (This File)
**Purpose**: Visual overview of project organization

## File Sizes (Approximate)

```
index.js                  ~25 KB   (700 lines)
test-connection.js        ~5 KB    (150 lines)
README.md                 ~40 KB   (500+ lines)
QUICK_START.md            ~15 KB   (200+ lines)
INSTALL.md                ~30 KB   (400+ lines)
API_REFERENCE.md          ~50 KB   (600+ lines)
CHANGELOG.md              ~15 KB   (200+ lines)
package.json              ~1 KB    (30 lines)
.env.example              ~0.5 KB  (15 lines)
.gitignore                ~0.3 KB  (25 lines)
claude_desktop_config...  ~0.3 KB  (12 lines)
PROJECT_STRUCTURE.md      ~8 KB    (This file)
```

**Total**: ~190 KB of code and documentation

## Dependency Tree

```
screeps-mcp
├── @modelcontextprotocol/sdk@0.5.0
│   └── (MCP dependencies...)
├── axios@1.6.0
│   └── (HTTP client dependencies...)
└── dotenv@16.0.0
    └── (Minimal dependencies)
```

## Tool Organization

### Category 1: Code Management (1 tool)
- `upload_code` - Deploy code to Screeps

### Category 2: Console & Debugging (3 tools)
- `get_console` - Retrieve logs
- `execute_command` - Run JavaScript
- `check_for_errors` - Detect errors

### Category 3: Performance (2 tools)
- `analyze_performance` - Metrics
- `troubleshoot_bot` - Health check

### Category 4: Memory (2 tools)
- `get_memory` - Read memory
- `set_memory` - Write memory

### Category 5: Game State (5 tools)
- `get_room_terrain` - Terrain data
- `get_room_status` - Room info
- `get_room_objects` - Room details
- `get_user_info` - User account
- `get_game_time` - Current tick

## API Endpoints Used

### Core Screeps APIs
```
POST /api/user/code              # Upload code
GET  /api/user/console           # Get console
POST /api/user/console           # Execute command
GET  /api/user/memory            # Get memory
POST /api/user/memory            # Set memory
GET  /api/game/room-terrain      # Terrain
GET  /api/game/room-status       # Room status
GET  /api/auth/me                # User info
GET  /api/game/time              # Game time
```

### Composite Tools (Multiple APIs)
- `analyze_performance` - Uses console execution
- `troubleshoot_bot` - Uses multiple endpoints
- `get_room_objects` - Uses console execution
- `check_for_errors` - Analyzes console logs

## Data Flow

```
Claude Desktop
    ↓
MCP Protocol (stdio)
    ↓
index.js (MCP Server)
    ↓
Axios HTTP Client
    ↓
Screeps API (https://screeps.com)
    ↓
Your Screeps Bot
```

## Authentication Flow

```
Environment Variables (.env)
    ↓
createAuthenticatedClient()
    ↓
[Token Auth] → X-Token header
[Email/Pass] → Basic Auth header
    ↓
Axios Instance
    ↓
All API Requests
```

## Development Workflow

```
1. Edit main.js (your bot code)
2. Ask Claude: "Upload my code"
3. Claude → MCP → upload_code
4. Wait 2-3 ticks
5. Ask Claude: "Check for errors"
6. Claude → MCP → check_for_errors
7. Fix any issues
8. Ask Claude: "Analyze performance"
9. Claude → MCP → analyze_performance
10. Optimize based on feedback
```

## Usage Patterns

### Pattern 1: Deploy and Monitor
```
User: Upload code at /path/to/main.js
MCP: upload_code → Screeps API
User: Wait 10 seconds, then check for errors
MCP: get_console + check_for_errors → Screeps API
```

### Pattern 2: Troubleshoot
```
User: Troubleshoot my bot
MCP: troubleshoot_bot → Multiple APIs
  → analyze_performance
  → check_for_errors
  → get_memory
  → get_user_info
  → Generate recommendations
```

### Pattern 3: Room Analysis
```
User: Analyze room W1N1
MCP: get_room_objects → Console command
MCP: get_room_terrain → Terrain API
MCP: get_room_status → Status API
→ Comprehensive room report
```

## Integration Points

### With Claude Desktop
- Stdio transport for MCP communication
- Environment variables from config file
- 13 tools available as Claude capabilities

### With Screeps
- Official HTTP API
- Token or email/password auth
- All major endpoints covered

### With Your Bot
- Uploads main.js code
- Reads/writes Memory object
- Executes console commands
- Monitors performance

## Security Architecture

```
Sensitive Data:
  SCREEPS_TOKEN
  SCREEPS_EMAIL
  SCREEPS_PASSWORD
      ↓
.env file (gitignored)
      ↓
process.env variables
      ↓
Axios auth headers
      ↓
HTTPS encrypted transport
      ↓
Screeps servers
```

## Extension Points

### Easy to Add
- More composite tools
- Additional API endpoints
- Custom analysis functions
- Enhanced recommendations

### Future Possibilities
- WebSocket support
- Market API integration
- Multi-module uploads
- Memory segments
- Battle replays
- Room visualizations

## Maintenance

### Regular Updates Needed
- Security patches: `npm update`
- Token rotation: Generate new tokens periodically
- Documentation: Keep in sync with new features

### Monitoring
- Check `npm test` regularly
- Monitor Claude logs
- Track API rate limits
- Review error patterns

## Quick Reference

### Installation
```bash
cd screeps-mcp
npm install
cp .env.example .env
# Edit .env with your token
npm test
```

### Running
```bash
npm start        # Start server
npm test         # Test connection
npm run dev      # Development mode
```

### Configuration
```bash
.env                           # Local environment
claude_desktop_config.json     # Claude integration
```

### Documentation
```bash
README.md          # Start here
QUICK_START.md     # 5-minute guide
INSTALL.md         # Full installation
API_REFERENCE.md   # API details
```

---

## Summary

**Total Files**: 12 files (9 new, 2 updated, 1 summary)
**Total Tools**: 13 MCP tools implemented
**Total Documentation**: 6 comprehensive guides
**Total Code**: ~850 lines of JavaScript
**Total Docs**: ~2000+ lines of markdown
**Dependencies**: 3 npm packages
**API Coverage**: 9+ Screeps endpoints
**Ready for Production**: ✅ Yes

---

*Last Updated: 2025-10-10*
*Version: 1.0.0*
*Status: Complete and Production Ready*


