# Quick Start Guide - Mini Screeps Bot

## Getting Started

### 1. Installation
1. Create a Screeps account at https://screeps.com/
2. Download or copy all the `.js` files from this repository
3. Upload them to your Screeps codebase using the in-game code editor or Screeps CLI

### 2. First Deployment
1. Upload all files to your main branch
2. The bot will automatically start working when you spawn in a room
3. Watch the console for status updates and progress reports

### 3. What to Expect

#### Early Game (RCL 1-2)
- Bot spawns basic harvesters and upgraders
- Starts building extensions around the spawn
- Establishes energy collection routes

#### Mid Game (RCL 3-5) 
- Begins building defensive towers
- Starts scouting adjacent rooms
- Implements remote mining operations
- Builds storage and containers

#### Late Game (RCL 6-8)
- Maximizes energy throughput  
- Manages multiple creep types efficiently
- Maintains full defensive capabilities
- Focuses on rapid controller upgrading

### 4. Configuration

Edit `config.js` to customize bot behavior:

```javascript
// Example: Increase upgrader count for faster RCL growth
creeps: {
    upgraders: {
        baseCount: 3,      // Start with 3 upgraders instead of 2
        perRoomLevel: 2,   // Add 2 per RCL instead of 1
        maxTotal: 8        // Allow up to 8 upgraders
    }
}
```

### 5. Monitoring

Watch the console for key information:
- `Managing room: W1N1 RCL: 3` - Current room and level
- `Room W1N1 - H:4 U:3 B:2 R:1 D:0 S:1` - Creep counts by role
- `Planned STRUCTURE_EXTENSION at 25,25` - Base building progress
- `Scout completed intelligence gathering` - Expansion discoveries

### 6. Troubleshooting

**Bot not working?**
- Check console for error messages
- Ensure all files are uploaded correctly
- Verify you have a spawn in the room

**Slow progress?**
- Check energy efficiency in console logs
- Adjust creep ratios in `config.js`
- Ensure harvesters are reaching sources

**Under attack?**
- Bot automatically spawns defenders
- Towers will engage hostiles automatically
- Check defensive structure placement

### 7. Advanced Usage

**Remote Mining:**
- Automatically starts at RCL 3
- Scouts find energy sources in adjacent rooms
- Remote harvesters bring energy back to base

**Multiple Rooms:**
- Bot automatically manages multiple owned rooms
- Each room operates independently
- Expansion planning begins at RCL 8

**Customization:**
- Modify role behavior in `role.*.js` files
- Adjust base layouts in `base.planner.js`
- Change expansion logic in `expansion.manager.js`

## Support

This bot is designed to work out-of-the-box with minimal configuration. For issues:
1. Check the console logs for error messages
2. Review the configuration settings
3. Verify all required files are present

The bot will handle everything automatically from spawn placement through reaching RCL 8 and beyond!