# Changelog

All notable changes to the Screeps MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-10

### Added

#### Core Features
- **MCP Server Implementation**: Full Model Context Protocol server for Screeps
- **Dual Authentication**: Support for token and email/password authentication
- **Environment Configuration**: `.env` file support for credentials

#### Code Management Tools
- `upload_code`: Upload bot code to Screeps server
- Multi-branch support for code deployment
- Single-file module upload (main.js)

#### Console & Debugging Tools
- `get_console`: Retrieve recent console logs
- `execute_command`: Run JavaScript commands in Screeps console
- `check_for_errors`: Automatic error detection in logs
- Error pattern matching (errors, exceptions, undefined references)

#### Performance Analysis Tools
- `analyze_performance`: Comprehensive CPU and game state analysis
  - CPU bucket and limit tracking
  - GCL progress monitoring
  - Room and creep population counts
  - Real-time performance metrics
- `troubleshoot_bot`: Full health check with recommendations
  - Automatic issue detection
  - Actionable recommendations
  - Critical threshold warnings

#### Memory Management Tools
- `get_memory`: Read bot memory (full or specific paths)
- `set_memory`: Write to bot memory
- JSON serialization/deserialization
- Memory size tracking

#### Game State Tools
- `get_room_terrain`: Retrieve terrain data for any room
- `get_room_status`: Check room ownership and reservation
- `get_room_objects`: Get detailed room information
  - Structure counts
  - Creep populations
  - Energy availability
  - Controller status
- `get_user_info`: Access user account details
- `get_game_time`: Get current game tick

#### Documentation
- **README.md**: Comprehensive usage guide
- **QUICK_START.md**: 5-minute setup guide
- **API_REFERENCE.md**: Complete API documentation
- **CHANGELOG.md**: Version history (this file)
- Example configuration files
- Claude Desktop integration guide

#### Developer Experience
- TypeScript-ready with JSDoc comments
- Error handling with detailed stack traces
- Axios HTTP client for robust API calls
- Environment variable validation
- Example configurations

### Technical Details

#### Architecture
- Built with `@modelcontextprotocol/sdk` v0.5.0
- Axios for HTTP requests
- Stdio transport for MCP communication
- Node.js 18+ required

#### API Coverage
- All major Screeps HTTP API endpoints
- Custom composite tools for enhanced functionality
- Rate limit awareness
- Error handling and retries

#### Security
- Token-based authentication (recommended)
- Environment variable credential storage
- No credential hardcoding
- `.gitignore` for sensitive files

### Dependencies
- `@modelcontextprotocol/sdk`: ^0.5.0
- `axios`: ^1.6.0

### Configuration
- Environment variables for all settings
- Claude Desktop config examples
- Multi-server support (official and private)
- Configurable default branch

### Known Limitations
- Single module upload (main.js only)
- No WebSocket support for real-time updates
- Console commands execute on next tick (async)
- No market API integration
- No memory segment support

### Future Enhancements
Consider for future versions:
- Multi-module upload support
- WebSocket console streaming
- Market API integration
- Memory segment access
- Battle replay analysis
- Room visualization tools
- Automated performance profiling
- Multi-shard support
- Room history and statistics
- Power creep management

---

## Format Guidelines

### Types of Changes
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

### Version Numbering
- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bug fixes, backward compatible

---

*For upgrade instructions and migration guides, see the README.md file.*


