
# Mini-Screeps Bot - Throughput Optimized

A minimal, self-contained Screeps bot focused on **Pixel earning** with advanced throughput optimization for maximum room efficiency. This bot operates autonomously in a single room with no expansion or remote operations, implementing mathematical throughput calculations for optimal energy flow.

**Version**: 1.0.0 | **File**: `main.js` (~2600 lines) | **Dependencies**: None

## 🎯 **Primary Goals**

1. **Pixel Generation**: Earn Pixels by using 10,000 CPU per tick (1 Pixel per 10,000 CPU)
2. **Base Maintenance**: Keep the room controller upgraded and maintain essential infrastructure
3. **Room Efficiency**: Maximize energy throughput using mathematical calculations
4. **CPU Optimization**: Minimize CPU usage during bucket refill phases

## 🧮 **Throughput Mathematics**

### **Energy Production**
- **2 sources × 10 energy/tick = 20 energy/tick total**
- Each source produces 3000 energy over 300 ticks (regeneration cycle)
- Continuous harvesting with dedicated miners

### **Mining Optimization**
- **Miners**: `5W 1M` body (550 energy cost)
- **Harvest Rate**: 1 WORK = 2 energy/tick
- **Per-source Target**: 10 energy/tick (fully caps source)
- **Behavior**: Parked on source containers for continuous operation

### **Hauling Calculations**
 - **Dynamic Sizing**: Hauler counts are calculated from throughput math (carry parts per hauler → energy/trip → haulersNeeded). The spawning logic now ensures the hauler target respects the throughput-calculated minimum (prevents undersizing hauler population).

### **Energy Flow Control**
 - Gets energy from dropped energy first (prefers drops near the current build target or assigned source), then withdraws from nearby source containers to top up when near a source.
 - Builds construction sites when available
 - Helps upgrade controller when no construction sites
 - Spawn count: builders scale with construction backlog (1 base, up to 3 builders depending on number of construction sites)
- **Purpose**: Finds positions with good wall distance and controller/spawn access
- **Benefits**: Minimizes creep travel distances and maximizes base efficiency


## 🏗️ **Architecture**

### **Single File Design**
- **`main.js`**: Complete bot implementation in one file
- **No external dependencies**: Pure JavaScript using Screeps API
- **Self-contained**: No user interaction required
- **Mathematical**: Implements throughput calculations for optimal efficiency

### **Optimized Energy Distribution System**
```
Sources → Containers (near sources) → Miners (parked, continuous)
Containers → Haulers (optimized CARRY/MOVE) → Spawn/Extensions
Spawn/Extensions → Upgraders/Builders → Controller/Construction
```

## 👥 **Optimized Creep Roles**

### **Miner** (Replaces Harvester)
- **Purpose**: Continuous energy extraction from sources
- **Body**: `5W 1M` for maximum harvest rate
- **Behavior**: 
  - Assigned to specific sources
  - Parked on source containers
  - Continuous harvesting (no travel time)
  - Count: Fixed at 2 (one per source)

### **Hauler** (New Role)
- **Purpose**: Transport energy from source containers to base
- **Body**: Dynamically calculated based on distance and energy capacity
- **Behavior**:
  - Moves energy from source containers to spawn/extensions/storage
  - Prioritizes extensions/spawn over storage
  - Optimized CARRY/MOVE ratio for maximum throughput
- **Count**: 2-3 haulers (based on energy capacity and distance)


### **Upgrader**
- **Purpose**: Upgrade room controller (prevents downgrading)
- **Behavior**:
  - Gets energy from spawn/extensions/storage (haulers deliver here)
  - Prioritizes extensions/spawn over storage
  - Dynamic count based on available energy after builder needs


### **Builder**
- **Purpose**: Construct planned structures
- **Behavior**:
  - Gets energy from spawn/extensions/storage
  - Builds construction sites when available
  - Helps upgrade controller when no construction sites
  - Only spawned when construction work exists

## 🏘️ **Enhanced Base Layout**

### **Centralized Design**
- Base positioned between spawn and controller
- Structures arranged in a 3-tile radius grid pattern
- Optimized for shortest travel distances


### **Planned Structures**
- **Extensions**: 10x (for more creep spawning capacity)
- **Towers**: 2x (for defense)
- **Storage**: Central energy storage
- **Terminal**: Resource trading
- **Link**: Energy transfer
- **Containers**: 
  - Near each source (for miner efficiency)
  - Near controller (for upgrader efficiency)
- **Roads**: 
  - From sources to base (hauler efficiency)
  - From base to controller (upgrader efficiency)

### **Smart Infrastructure**
- **Source Containers**: Adjacent to each source for miner deposits
- **Controller Container**: 2-3 tiles from controller for upgrader access
- **Road Planning**: Automatic road placement for improved travel efficiency
- **Entrance Sealing (Book-ends + Curtain)**: For each natural entrance, places book-end walls and an interior curtain two tiles inside the room; the curtain extends two tiles beyond both entrance ends and has a single center rampart gate
- **Defense Hit Points**: RCL-scaled maintenance targets (RCL 1: 1K hits → RCL 8: 10M hits for walls)

### **Construction Priority System**
1. **Extensions** (closest to spawn prioritized)
2. Core structures (spawn, storage, towers)
3. **Roads** (only after 5+ extensions and 1+ container built)
4. All builders work on shared target via `room.memory.sharedConstructionTarget`

## 🛡️ **Defense System**

### **Automated Wall Maintenance**
- **RCL-Scaled Hit Points**: Walls maintained to level-appropriate targets
- **Priority Repair**: Builders prioritize defense structures below target HP
- **Entrance Sealing**: Edge book-ends and an interior curtain are placed automatically across room entrances
  - Curtain depth: 2 tiles into the room
  - Curtain width: 2 tiles beyond each entrance end (overhang on both sides)
  - Gate: the curtain's center tile is a rampart (friendly passage)
  - Terrain-aware: never plans walls/ramparts on terrain walls
  - Book-ends: placed at the curtain’s overhang endpoints with fallback depths (1 → 2)

### **Tower Defense**
- **Hostile Detection**: Automatic activation when enemies detected
- **Healing Priority**: Injured creeps healed before attacking
- **Repair Mode**: Damaged structures repaired when no threats present
- **Coordinated Attack**: Multiple towers target closest threats

### **CPU Management**
- **Monitor**: CPU bucket levels continuously
- **Threshold**: Generate Pixel when bucket ≥ 10,000
- **Method**: `Game.cpu.generatePixel()` (official Screeps API)
- **Logging**: Track CPU usage, bucket levels, and Pixel count

### **Advanced Pixel Tracking**
- **Generation History**: Tracks last 10 pixel generations for rate calculation
- **Bucket Fill Rate**: Monitors CPU bucket growth over time
- **Time Estimation**: Calculates ticks until next pixel generation
- **Performance Stats**: Pixels per tick, ticks per pixel metrics

### **Efficiency Cycle**
1. **Build Phase**: Normal operations while bucket fills
2. **Pixel Phase**: Generate Pixel when bucket is full
3. **Repeat**: Continuous cycle for maximum Pixel production

## 🚀 **Getting Started**

### **Deployment**
1. Copy `main.js` to your Screeps script directory
2. The bot will automatically:
   - Calculate source-to-sink distances
   - Plan optimal base layout with roads
   - Spawn efficiency-optimized creeps
   - Build infrastructure
   - Start earning Pixels

### **No Configuration Required**
- Bot operates completely autonomously
- No user input needed
- Self-adapting to room conditions
- Mathematical optimization based on room layout


## 📊 **Performance Monitoring**

### **Console Output**
- **Distance Calculation**: `Distance calculation complete: avg=XX, Trtt=XX, carryNeeded=XX`
- **Creep Status**: `Creeps: M:2/2, H:2/2, U:3/4, B:1/1`
- **Energy Flow**: `Energy Flow: 20 e/t → Builders:10, Upgraders:10, Missing:5`
- **Pixel Generation**: `🎯 PIXEL GENERATED! Bucket: XXXX → XXXX, Pixels: X`
- **CPU Status**: `CPU: XX.XX/XX, Bucket: XXXX, Pixels: X` (every 100 ticks)

### **Key Metrics**
- CPU usage efficiency
- Pixel generation rate
- Energy throughput (20 e/t target)
- Creep population balance
- Construction progress
- Distance-based optimizations

## 🎮 **Features**

### **✅ What It Does**
- Earns Pixels efficiently with optimized CPU usage
- Maintains room controller with mathematical precision
- Builds essential infrastructure with smart placement
- Manages energy distribution using throughput calculations
- Self-contained operation with no user interaction
- Implements advanced throughput mathematics
- Automatically plans roads for efficiency
- Dynamic energy allocation based on room needs

### **❌ What It Doesn't Do**
- No room expansion
- No remote harvesting
- No Labs or Factories
- No complex resource processing
- No user interaction
- No manual configuration

## 🔧 **Technical Details**

### **Advanced Algorithms**
- **Distance Transform**: Multi-pass algorithm for optimal base layout
- **Pathfinding Optimization**: Cost matrices avoid walls and prioritize roads
- **Source Distribution**: Balanced energy gathering across all sources
- **Construction Prioritization**: Extensions before roads, closest structures first
 - **Entrance Analysis**: Edge scanning finds passable spans and generates book-ends plus a curtain with a centered rampart gate

### **Memory Management**
- Automatic cleanup of dead creep memory
- Room memory for base planning and distance calculations
- Efficient creep role assignment with source tracking
- Cached throughput calculations for performance

### **Pathfinding & Movement**
- Optimized movement with visual path indicators
- Closest-by-path target selection
- Efficient container positioning
- Road-based pathfinding for improved speed

### **Advanced Spawn Logic**
- Throughput-based creep spawning with mathematical calculations
- Priority: Miner → Hauler → Upgrader → Builder
- Dynamic population management based on room needs
- Energy capacity-aware body part optimization

### **Distance Calculations**
- Automatic source-to-sink distance measurement
- Round-trip time calculations for hauler optimization
- CARRY/MOVE ratio optimization based on distance
- Cached calculations for performance

### **Defense Configuration**

- `ENTRANCE_CURTAIN_DEPTH` (default: 2): Depth in tiles from the room edge for the interior curtain
- `ENTRANCE_OVERHANG_TILES` (default: 2): Overhang in tiles beyond the entrance ends for both the curtain and the book-ends

These constants are defined near the top of `main.js` and control entrance sealing behavior.

## 📈 **Optimization Focus**

### **CPU Efficiency**
- Minimal memory usage with smart caching
- Efficient algorithms with mathematical foundations
- Direct API calls with no unnecessary operations
- Optimized creep behavior for reduced CPU usage

### **Energy Efficiency**
- Mathematical throughput optimization
- Container-based distribution system
- Reduced travel distances with road planning
- Optimized creep roles with specialized functions
- Dynamic energy allocation based on room state

### **Throughput Optimization**
- Continuous mining with dedicated miners
- Optimized hauling with calculated CARRY/MOVE ratios
- Road planning for improved travel efficiency
- Dynamic energy flow control
- Mathematical precision in all calculations

## 🎯 **Success Metrics**

- **Primary**: Pixels earned per hour
- **Secondary**: Controller level maintenance
- **Tertiary**: Base construction completion
- **Efficiency**: CPU usage optimization
- **Throughput**: Energy flow efficiency (target: 20 e/t)
- **Mathematical**: Distance-based optimization accuracy

## 📋 **Example Calculations**

### **Typical Room Setup**
- **Average Distance**: 15 tiles
- **Round-trip Time**: 34 ticks
- **Total CARRY Needed**: 14 parts
- **Hauler Configuration**: 2 haulers with 7C 4M each
- **Energy Production**: 20 e/t (2 sources × 10 e/t each)
- **Energy Allocation**: 10 e/t builders + 10 e/t upgraders (when building)

### **Performance Benefits**
- **Mining Efficiency**: 100% uptime (no travel time)
- **Hauling Efficiency**: Optimized CARRY/MOVE ratios
- **Energy Flow**: Mathematical precision in allocation
- **Pixel Generation**: More CPU available due to efficiency

---

*This bot implements advanced throughput mathematics for players who want maximum efficiency in a single-room Pixel-earning machine that requires minimal maintenance and operates completely autonomously.*
