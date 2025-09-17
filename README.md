# Mini-Screeps Bot

A minimal, self-contained Screeps bot focused on **Pixel earning** and efficient base management. This bot operates autonomously in a single room with no expansion or remote operations.

## 🎯 **Primary Goals**

1. **Pixel Generation**: Earn Pixels by using 10,000 CPU per tick (1 Pixel per 10,000 CPU)
2. **Base Maintenance**: Keep the room controller upgraded and maintain essential infrastructure
3. **Efficiency**: Minimize CPU usage during bucket refill phases

## 🏗️ **Architecture**

### **Single File Design**
- **`main.js`**: Complete bot implementation in one file
- **No external dependencies**: Pure JavaScript using Screeps API
- **Self-contained**: No user interaction required

### **Energy Distribution System**
```
Sources → Containers (near sources) → Harvesters deposit
Containers (near controller) → Upgraders withdraw → Controller upgrade
Containers/Storage → Builders withdraw → Construction sites
```

## 👥 **Creep Roles**

### **Harvester**
- **Purpose**: Collect energy from sources
- **Behavior**: 
  - Harvests from closest source
  - Deposits energy into containers near sources
  - Fallback to extensions/spawn/towers if no containers
  - Final fallback to storage

### **Upgrader**
- **Purpose**: Upgrade room controller (prevents downgrading)
- **Behavior**:
  - Gets energy from container near controller (2-3 tiles away)
  - Continuously upgrades controller
  - Fallback to storage/extensions if no controller container

### **Builder**
- **Purpose**: Construct planned structures
- **Behavior**:
  - Gets energy from containers/storage/extensions
  - Builds construction sites
  - Helps upgrade controller when no construction sites

## 🏘️ **Base Layout**

### **Centralized Design**
- Base positioned between spawn and controller
- Structures arranged in a 3-tile radius grid pattern

### **Planned Structures**
- **Extensions**: 10x (for more creep spawning capacity)
- **Towers**: 2x (for defense)
- **Storage**: Central energy storage
- **Terminal**: Resource trading
- **Link**: Energy transfer
- **Containers**: 
  - Near each source (for harvester efficiency)
  - Near controller (for upgrader efficiency)

### **Container Strategy**
- **Source Containers**: Adjacent to each source for harvester deposits
- **Controller Container**: 2-3 tiles from controller for upgrader access
- **Smart Placement**: Only on plain/swamp terrain, avoiding walls

## ⚡ **Pixel Earning Strategy**

### **CPU Management**
- **Monitor**: CPU bucket levels continuously
- **Threshold**: Generate Pixel when bucket ≥ 10,000
- **Method**: `Game.cpu.generatePixel()` (official Screeps API)
- **Logging**: Track CPU usage, bucket levels, and Pixel count

### **Efficiency Cycle**
1. **Build Phase**: Normal operations while bucket fills
2. **Pixel Phase**: Generate Pixel when bucket is full
3. **Repeat**: Continuous cycle for maximum Pixel production

## 🚀 **Getting Started**

### **Deployment**
1. Copy `main.js` to your Screeps script directory
2. The bot will automatically:
   - Plan base layout
   - Spawn essential creeps
   - Build infrastructure
   - Start earning Pixels

### **No Configuration Required**
- Bot operates completely autonomously
- No user input needed
- Self-adapting to room conditions

## 📊 **Performance Monitoring**

### **Console Output**
- **Preparation**: `⚡ Preparing for Pixel: Bucket XXXX/10000`
- **Success**: `🎯 PIXEL GENERATED! Bucket: XXXX → XXXX, Pixels: X`
- **Status**: `CPU: XX.XX/XX, Bucket: XXXX, Pixels: X` (every 100 ticks)

### **Key Metrics**
- CPU usage efficiency
- Pixel generation rate
- Base construction progress
- Creep population balance

## 🎮 **Features**

### **✅ What It Does**
- Earns Pixels efficiently
- Maintains room controller
- Builds essential infrastructure
- Manages energy distribution
- Self-contained operation

### **❌ What It Doesn't Do**
- No room expansion
- No remote harvesting
- No Labs or Factories
- No complex resource processing
- No user interaction

## 🔧 **Technical Details**

### **Memory Management**
- Automatic cleanup of dead creep memory
- Room memory for base planning
- Efficient creep role assignment

### **Pathfinding**
- Optimized movement with visual path indicators
- Closest-by-path target selection
- Efficient container positioning

### **Spawn Logic**
- Adaptive creep spawning based on needs
- Priority: Harvester → Upgrader → Builder
- Dynamic population management

## 📈 **Optimization Focus**

### **CPU Efficiency**
- Minimal memory usage
- Efficient algorithms
- Direct API calls
- No unnecessary operations

### **Energy Efficiency**
- Container-based distribution
- Reduced travel distances
- Optimized creep roles
- Smart fallback systems

## 🎯 **Success Metrics**

- **Primary**: Pixels earned per hour
- **Secondary**: Controller level maintenance
- **Tertiary**: Base construction completion
- **Efficiency**: CPU usage optimization

---

*This bot is designed for players who want a simple, effective Pixel-earning machine that requires minimal maintenance and operates completely autonomously.*
