
# Mini-Screeps Bot - Tactical Aggression & Expansion

A minimal, self-contained Screeps bot focused on **aggressive expansion and pixel earning** with advanced throughput optimization and military conquest capabilities. This bot operates autonomously with **remote harvesting** (v1.2), **military operations** (v1.3), and multi-room control, implementing mathematical throughput calculations for optimal energy flow and tactical domination.

**Version**: 1.3.0 | **File**: `main.js` (~6000 lines) | **Dependencies**: None

## 🎯 **Primary Goals**

1. **Survive & Dominate**: Speed run to RCL 5 in home rooms for rapid development
2. **Aggressive Expansion**: Scout, conquer, and extract resources from neighboring rooms
3. **Pixel Generation**: Earn Pixels efficiently while maintaining tactical operations
4. **CPU Efficiency**: Target >150 bucket/tick recovery rate for sustainable expansion
5. **Multi-Room Control**: Manage up to 3 controlled rooms with intelligent abandonment

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
- **Purpose**: Construct planned structures and maintain infrastructure
- **Behavior**:
  - Gets energy from spawn/extensions/storage
  - Priority repair for critical infrastructure (containers <50% HP, roads <50% HP)
  - Builds construction sites when available
  - Helps upgrade controller when no construction or repair work exists
  - Count: 1-3 builders based on construction backlog

### **Reserver** (v1.2, RCL 4+)
- **Purpose**: Keep remote room controllers reserved for maximum energy production
- **Body**: `2 CLAIM, 2 MOVE` (1300 energy)
- **Behavior**:
  - Travels to assigned remote room
  - Continuously reserves the controller
  - Respawns when < 1000 ticks remaining
  - Count: 1 per active remote room

### **Remote Miner** (v1.2, RCL 4+)
- **Purpose**: Mine energy from remote room sources
- **Body**: `5 WORK, 1 MOVE` (550 energy, same as local miners)
- **Behavior**:
  - Travels to assigned remote room source
  - Parks on container (or adjacent if no container)
  - Continuous mining like local miners
  - Count: 1 per remote source (2-6 depending on remote rooms)

### **Scout** (v1.2, RCL 4+)
- **Purpose**: Explore adjacent rooms to discover remote harvesting opportunities
- **Body**: `3 MOVE` (fast, 150 energy)
- **Behavior**:
  - Travels to adjacent rooms one by one
  - Explores each room for 50 ticks to gather intelligence
  - Marks rooms as "scouted" for evaluation
  - Auto-recycles when all 8 adjacent rooms explored
  - Count: 1 scout (spawns when needed, recycles when done)

### **Remote Builder** (v1.2, RCL 4+)
- **Purpose**: Build and maintain infrastructure in remote rooms
- **Body**: `3 WORK, 3 CARRY, 6 MOVE` (mobile, 900 energy)
- **Behavior**:
  - Gets energy from home room storage/containers
  - Travels to remote room
  - Builds containers and roads
  - Repairs containers and roads (< 80% HP)
  - Returns home when no work available
  - Count: 1 per active remote room

### **Remote Hauler** (v1.2, RCL 4+)
- **Purpose**: Dedicated energy transport for remote rooms
- **Body**: Same as regular haulers (scales with RCL: 1C1M at RCL 1-2, 2C2M at RCL 3-4, etc.)
- **Behavior**:
  - Shuttles between assigned remote room and home room
  - Collects energy from remote source containers and dropped energy
  - Delivers to spawn/extensions/storage/controller containers in home room
  - Optimized for remote room energy transport
  - Count: 1 per remote room with 2+ sources (only high-value rooms)

### **Warrior** (v1.3, RCL 4+)
- **Purpose**: Front-line combat unit for room conquest
- **Body**: `2 TOUGH, 6 MOVE, 4 ATTACK` (~1300 energy)
- **Behavior**:
  - Travels to target assault room
  - Engages hostile creeps first (prioritizes threats)
  - Destroys hostile spawns and towers
  - Works with healers for sustained combat
  - Count: 2 per active assault wave

### **Healer** (v1.3, RCL 4+)
- **Purpose**: Support unit for warriors during combat
- **Body**: `4 MOVE, 4 HEAL` (~1000 energy)
- **Behavior**:
  - Follows warriors into combat
  - Heals wounded warriors (prioritizes lowest HP)
  - Self-heals when damaged
  - Uses ranged heal at distance, melee heal up close
  - Count: 1 per active assault wave

### **Dismantler** (v1.3, RCL 4+)
- **Purpose**: Structure destruction for clearing fortified rooms
- **Body**: `1 MOVE, N WORK` (scalable based on energy)
- **Behavior**:
  - Dismantles hostile structures systematically
  - Priority: Spawns → Towers → Storage → Walls
  - Used for heavily fortified targets
  - Count: 0-2 depending on target difficulty

### **Raider** (v1.3, RCL 4+)
- **Purpose**: Resource extraction from conquered rooms
- **Body**: `6 CARRY, 6 MOVE` (~600 energy)
- **Behavior**:
  - Spawns after assault phase completes
  - Collects dropped resources, loots ruins/tombstones
  - Extracts from hostile storage/containers
  - Returns all resources to home room
  - Count: 1-3 per conquered room (raid phase)

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
- **RCL-Scaled Hit Points**: Walls maintained to level-appropriate targets (1K @ RCL1 → 10M @ RCL8)
- **Priority Repair**: Builders prioritize defense structures below target HP
- **Entrance Sealing**: Edge book-ends and an interior curtain are placed automatically across room entrances
  - Curtain depth: 2 tiles into the room
  - Curtain width: 2 tiles beyond each entrance end (overhang on both sides)
  - Gate: the curtain's center tile is a rampart (friendly passage)
  - Terrain-aware: never plans walls/ramparts on terrain walls
  - Book-ends: placed at the curtain's overhang endpoints with fallback depths (1 → 2)

### **Tower Defense**
- **Hostile Detection**: Automatic activation when enemies detected
- **Healing Priority**: Injured creeps healed before attacking
- **Repair Mode**: Prioritized repair system for critical structures
  - **Priority 1**: Spawn, Towers (survival critical)
  - **Priority 2**: Storage, Terminal (resource management)
  - **Priority 3**: Source/Controller Containers, Extensions
  - **Priority 4**: Roads, Ramparts, Other structures
- **Coordinated Attack**: Multiple towers target closest threats

## 💻 **CPU & Pixel Management**

### **CPU Optimization Systems**
- **Structure Caching**: Caches frequently-used structure lookups every 10 ticks (~5-10 CPU/tick savings)
- **Distance Metrics Caching**: Caches pathfinding calculations for 1500 ticks (~15-20 CPU/spawn cycle)
- **Spawn Assignment**: Pre-assigns sources during spawn (eliminates reassignment loop, ~2-3 CPU/tick)
- **Memory Cleanup**: Automatic cleanup of built structures every 100 ticks
- **Total Savings**: ~8-15 CPU per tick through combined optimizations

### **Pixel Generation**
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
1. Copy `main.js` to your Screeps script directory (or use `upload-to-screeps.sh`)
2. The bot will automatically:
   - Calculate source-to-sink distances
   - Plan optimal base layout with roads and defenses
   - Spawn efficiency-optimized creeps
   - Build infrastructure
   - Scout adjacent rooms for intelligence
   - Start earning Pixels

### **Progression Path**
- **RCL 1-3**: Focus on economy, infrastructure, and defense
- **RCL 4**: Military operations unlock, remote harvesting begins
- **RCL 4-5**: Aggressive scouting, conquest campaigns, speedrun to RCL 5
- **RCL 5+**: Full tactical capabilities, multi-room control, resource extraction
- **RCL 7-8**: Multi-spawn support for rapid creep production

### **No Configuration Required**
- Bot operates completely autonomously
- No user input needed
- Self-adapting to room conditions and threats
- Mathematical optimization based on room layout
- Tactical decisions made automatically
- Configurable constants available for fine-tuning (optional)


## 📊 **Performance Monitoring**

### **Console Output (v1.3)**

**Every 20 ticks** - Comprehensive status dashboard:
```
=== BASE STATUS RCL 4 ===
Controller: 12500/45000 (27.8%) - 32500 to next RCL
Energy: 800/800 (100%)

--- POPULATION ---
Miners: 2/2 | Haulers: 3/3 (2 busy, 1 idle)
Upgraders: 8/8 | Builders: 2/2
Remote: 2 miners, 1 haulers, 1 reservers, 1 scouts, 1 builders

--- v1.3 TACTICAL STATUS ---
✅ CPU: Bucket 9245/10000, Recovery: 245.3/tick (target: 150+)
⚔️ Military: 2 warriors, 1 healers, 0 raiders
🎯 Active Assaults: 1
  - W1N1: assault phase (wave 1)
🔍 Intel: 15 rooms scouted, 3 conquerable
🚀 SPEEDRUN to RCL 5: 27.8% complete
========================
```

**Occasional Events:**
- **Distance Calculation**: `Distance calculation complete: avg=XX, Trtt=XX, carryNeeded=XX`
- **Pixel Generation**: `🎯 PIXEL GENERATED! Bucket: 10000 → 0, Pixels: X`
- **Military Operations**: `🎯 Assault started on W1N1 (threat: 4.5, value: 65)`
- **Room Abandonment**: `🗑️ Abandoning W2S1 (quality score: 425 < 500)`
- **Speedrun Activation**: `🚀 SPEEDRUN MODE: Boosting upgraders to 12 (Target: RCL 5)`

### **Key Metrics**
- **CPU efficiency**: Bucket recovery rate (target: 150+/tick)
- **Pixel generation rate**: Typically 1 pixel every 40-60 ticks
- **Energy throughput**: 20-80 e/t (base + remotes + conquered rooms)
- **Creep population balance**: Core + remote + military
- **Construction progress**: Tracked per room
- **Military effectiveness**: Conquests per 1000 ticks
- **Room quality**: Scoring for abandonment decisions
- **Intelligence coverage**: Rooms scouted and analyzed

## 🎮 **Features**

### **✅ What It Does**

**Core Economy & Infrastructure:**
- Earns Pixels efficiently with optimized CPU usage
- Maintains room controller with mathematical precision and adaptive scaling
- Builds essential infrastructure with smart placement
- Manages energy distribution using throughput calculations
- Implements advanced throughput mathematics
- Automatically plans roads for efficiency
- Dynamic energy allocation based on room needs
- **Link energy transfer system** (automated at RCL5+)
- **Creep recycling** for energy recovery (~50-70% cost recovery)
- **Emergency mode detection** (controller downgrade, energy crisis, spawn damage)
- **Dynamic upgrader scaling** based on storage levels (2-15 upgraders)
- **Structure caching** for CPU optimization
- **Priority-based tower repairs** for critical infrastructure
- **Road maintenance system** to preserve movement efficiency
- **Multi-spawn support** (v1.2): 2 spawns at RCL 7, 3 spawns at RCL 8

**Remote Operations (v1.2):**
- **Remote harvesting**: Automatic scouting, reservation, and mining of adjacent rooms (RCL 4+)
- **Spawn area detection**: Automatically detects and skips blocked rooms
- **Smart room selection**: Activates best rooms based on RCL (1-3 remote rooms)
- **Infrastructure planning**: Containers and roads in remote rooms
- **Throughput calculations**: Spawns haulers based on remote distance

**Military & Expansion (v1.3):**
- **Room intelligence system**: Automatic threat assessment and strategic scoring
- **Aggressive reconnaissance**: Scouts 3 rooms out in all directions
- **Tactical conquest**: Phased assault system (Prepare → Assault → Raid → Complete)
- **Military creeps**: Warriors, Healers, Dismantlers, Raiders
- **Resource extraction**: Raiders collect loot from conquered rooms
- **Room abandonment**: Quality-based evaluation and automatic unclaiming
- **RCL 5 speedrun**: Boosts upgraders for rapid progression
- **Multi-room control**: Manages up to 3 controlled rooms simultaneously
- **CPU monitoring**: Recovery rate tracking with aggressive expansion stance

**Automation & Intelligence:**
- Self-contained operation with no user interaction required
- Comprehensive status dashboard with tactical indicators
- Continuous intelligence gathering and room evaluation
- Adaptive spawning based on CPU efficiency and room needs

### **❌ What It Doesn't Do**
- No Labs or Factories (yet)
- No complex resource processing or minerals
- No manual user interaction required
- No market trading (yet)
- No power creeps (yet)

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
- Cached calculations for performance (1500 tick cache duration)

### **Advanced Automation Features (v1.1.0+)**
- **Link Energy Transfer**: Automated energy transfer from source links to spawn/controller links (every 5 ticks when 2+ links exist)
- **Creep Recycling**: Old creeps (≤50 TTL) return to spawn for energy recovery
- **Emergency Detection**: Monitors controller downgrade, energy crisis, spawn damage, missing miners
- **Dynamic Upgrader Scaling**: 
  - >80% storage full: 15 upgraders (burn excess energy)
  - 50-80% full: 5-7 upgraders (moderate)
  - 25-50% full: 3-4 upgraders (conservative)
  - <25% full: 2 upgraders (minimal)
  - RCL8 + stable: 1 upgrader (maintenance mode)
- **Road Repair System**: Builders maintain roads at >50% HP for optimal movement
- **Priority Tower Repairs**: Critical structures (spawn, towers, storage) repaired first

### **Configuration Constants**

**v1.3 Tactical Settings:**
- `VERSION` (default: '1.3'): Bot version identifier
- `MIN_BUCKET_RECOVERY_RATE` (default: 150): Target CPU efficiency (bucket/tick)
- `MAX_CONTROLLED_ROOMS` (default: 3): Maximum concurrent rooms
- `SPEEDRUN_TARGET_RCL` (default: 5): Speed run target level
- `AGGRESSIVE_SCOUT_RANGE` (default: 3): Scout distance in rooms
- `CONQUEST_COOLDOWN` (default: 1000): Ticks between conquests
- `ROOM_ABANDON_CHECK_INTERVAL` (default: 5000): Abandonment check frequency

**v1.3 Military Settings:**
- `ENABLE_MILITARY` (default: true): Master military switch
- `MIN_RCL_FOR_MILITARY` (default: 4): Minimum RCL for military ops
- `ASSAULT_WAVE_SIZE` (default: 3): Creeps per assault wave
- `CRITICAL_BUCKET_THRESHOLD` (default: 1000): Stop military at this bucket level
- `BUCKET_RECOVERY_FLOOR` (default: 100): Warning threshold for recovery rate

**v1.3 Evaluation Thresholds:**
- `MIN_SOURCES_FOR_CONQUEST` (default: 1): Minimum sources worth conquering
- `MAX_HOSTILE_TOWERS_FOR_ASSAULT` (default: 2): Maximum towers we'll assault
- `MIN_ENERGY_SCORE_FOR_KEEP` (default: 500): Minimum score to keep room

**Defense Configuration:**
- `ENTRANCE_CURTAIN_DEPTH` (default: 2): Depth in tiles from the room edge for the interior curtain
- `ENTRANCE_OVERHANG_TILES` (default: 2): Overhang in tiles beyond the entrance ends for both the curtain and the book-ends
- `WALL_TARGET_HITS`: RCL-scaled wall hit points (1K @ RCL1 → 10M @ RCL8)
- `RAMPART_TARGET_HITS`: RCL-scaled rampart hit points
- `TOWER_REFILL_THRESHOLD` (default: 0.5): 50% energy threshold for tower refills

**Optimization Configuration (v1.1.0+):**
- `CREEP_RECYCLE_TTL` (default: 50): When to start recycling creeps
- `EMERGENCY_ENERGY_THRESHOLD` (default: 300): Low energy emergency level
- `CONTROLLER_DOWNGRADE_EMERGENCY` (default: 5000): Controller emergency threshold
- `CONTAINER_REPAIR_THRESHOLD` (default: 20000): Absolute hits threshold for container repair
- `CONTAINER_REPAIR_PERCENT` (default: 0.5): Repair containers below 50% HP

All constants are defined near the top of `main.js` and can be adjusted for different strategies. See `V1.3_QUICK_REFERENCE.md` for tuning examples.

## 📈 **Optimization Focus**

### **CPU Efficiency**
- **Structure Caching**: ~5-10 CPU/tick saved via cached lookups (refreshed every 10 ticks)
- **Distance Metrics Caching**: ~15-20 CPU/spawn cycle saved (cached for 1500 ticks)
- **Source Pre-Assignment**: ~2-3 CPU/tick saved (eliminates reassignment loops)
- **Memory Cleanup**: Automatic removal of built structures (every 100 ticks)
- **Total CPU Savings**: ~8-15 CPU per tick through combined optimizations
- Efficient algorithms with mathematical foundations
- Direct API calls with no unnecessary operations

### **Energy Efficiency**
- Mathematical throughput optimization
- Container-based distribution system
- Reduced travel distances with road planning
- Optimized creep roles with specialized functions
- Dynamic energy allocation based on room state
- **Link Transfer System**: Reduces hauler load by 10-15% at RCL5+ 
- **Creep Recycling**: +15-20% energy recovery from dying creeps
- **Storage-Based Scaling**: +25-30% upgrader efficiency when storage is full

### **Throughput Optimization**
- Continuous mining with dedicated miners
- Optimized hauling with calculated CARRY/MOVE ratios
- Road planning for improved travel efficiency
- Road maintenance system keeps roads at >50% HP
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

## 🌍 **Remote Harvesting System (v1.2)**

### **Overview**
The bot automatically scouts, evaluates, and harvests energy from adjacent rooms starting at RCL 4. This significantly increases energy throughput without claiming additional rooms.

### **Features**
- **Automatic Room Scouting**: Evaluates all 8 adjacent rooms based on:
  - Number of sources (2 sources preferred over 1)
  - Distance from home room
  - Absence of hostile structures
  - Terrain quality (plains preferred over swamps)
  - **Spawn Area Detection**: Automatically detects and skips rooms blocked by spawn area boundaries
  - **Timeout Handling**: Marks unreachable rooms as temporarily blocked (100 tick timeout)
  - **Retry Logic**: Blocked rooms can be retried after 1000 ticks when spawn areas expire
- **Smart Room Selection**: Activates best rooms based on RCL:
  - RCL 4-5: 1 remote room
  - RCL 6-7: 2 remote rooms
  - RCL 8: 3 remote rooms
- **New Creep Roles**:
  - **Scout**: Explores adjacent rooms to discover remote harvesting opportunities
  - **Reserver**: Keeps remote controllers reserved (2 CLAIM parts), smart spawning based on reservation status
  - **Remote Miner**: Harvests energy in remote rooms (5 WORK parts, parks on containers)
  - **Remote Builder**: Builds and maintains containers/roads in remote rooms
  - **Remote Hauler**: Dedicated energy transport for high-value remote rooms (2+ sources)
- **Infrastructure Planning**: Automatically plans containers at sources and roads back to home
- **Smart Energy Flow**: 
  - Haulers wait for containers to reach 400+ energy before collecting (efficient trips)
  - Prioritizes controller containers over storage to keep upgraders supplied
  - Remote energy collected when local containers are low
  - Regular haulers return to home room before delivering energy
- **Throughput Calculations**: Spawns additional haulers based on remote source count and distance

### **Energy Boost**
- Each reserved remote source produces 10 energy/tick (same as local sources)
- 1 remote room with 2 sources = +20 energy/tick
- 3 remote rooms = up to +60 energy/tick total (3x home room production!)

### **CPU Cost**
- Minimal additional CPU (~5-10 CPU/tick)
- Scouting runs every 100 ticks
- Remote infrastructure planning every 50 ticks
- Worth the investment for 3x energy income

## ⚔️ **Military Operations System (v1.3)**

### **Overview**
Version 1.3 adds aggressive tactical capabilities, enabling the bot to scout, evaluate, conquer, and extract resources from neighboring rooms. Military operations unlock at RCL 4 and operate alongside the existing economic systems.

### **Room Intelligence System**
- **Automatic Analysis**: All visible rooms analyzed for strategic value
- **Threat Assessment**: Calculates threat level (0-10) based on:
  - Towers: +2 per tower
  - Spawns: +1.5 per spawn
  - Hostile creeps: +0.5 each
  - RCL: +0.5 per level
- **Strategic Scoring**: Evaluates rooms based on:
  - Sources: +20 points each
  - Distance: +30 base, -5 per room away
  - Difficulty: -5 per difficulty point
  - Threat: -3 per threat point
- **Conquest Evaluation**: Determines conquerable targets

### **Aggressive Reconnaissance**
- **Extended Scouting**: Scouts 3 rooms out in all directions
- **Continuous Updates**: Re-scouts rooms every 1000 ticks
- **Target Queue**: Maintains list of rooms needing exploration
- **Military Intelligence**: Gathers data for tactical decisions

### **Room Conquest System**
Automatically selects and conquers the best target rooms based on:
- **Minimum Requirements**:
  - At least 1 source
  - Maximum 2 hostile towers
  - Strategic value > 20
  - Cooldown elapsed (1000 ticks between conquests)
  - CPU bucket ≥ 1000 (only stops at critical levels!)

### **Assault Phases**
```
1. PREPARE → Spawn warriors and healers
2. ASSAULT → Clear all hostiles and structures
3. RAID    → Extract resources with raiders
4. COMPLETE → Mission accomplished
```

### **Room Abandonment Logic**
- **Quality Evaluation**: Scores rooms based on:
  - Sources × 300
  - Energy capacity / 50
  - Controller level × 50
  - Distance penalty × 100
  - Storage energy / 100
- **Abandonment Threshold**: Rooms scoring < 500 are abandoned
- **Safety Check**: Won't abandon if ≤ 2 rooms remain
- **Resource Extraction**: Waits for resource evacuation before abandoning

### **RCL 5 Speedrun Optimization**
- **Upgrader Boost**: Increases to 15 upgraders when below RCL 5
- **Activation Conditions**: Storage > 50k energy OR spawn > 70% full
- **Builder Reduction**: Reduces builders when < 10 construction sites
- **Console Indicator**: Shows `🚀 SPEEDRUN MODE` when active

## 💻 **CPU Management Philosophy (v1.3)**

### **Recovery Rate Focus**
Unlike traditional Screeps bots, v1.3 focuses on **bucket recovery rate** rather than absolute bucket level. This is critical for pixel generation, as the bucket is frequently drained to 0 when generating pixels.

### **Key Concept**
```
Recovery Rate = (current bucket - previous bucket) / ticks elapsed
```

**This is the ONLY metric that matters for sustainable operation!**

### **CPU Thresholds**

| Recovery Rate | Status | Action |
|---------------|--------|--------|
| ≥ 150/tick | ✅ OPTIMAL | Full operations |
| 100-149/tick | ⚠️ Below target | Continue with warning |
| 50-99/tick | ⚠️ LOW | Continue with warning |
| < 50/tick | 🚨 SLOW | Warn more but continue |
| Bucket < 1000 | 🚨 CRITICAL | Pause new military ops |

### **Aggressive Philosophy**
v1.3 adopts an **aggressive stance** on CPU management:
- **Monitor, Don't Block**: Warns about low recovery but continues operations
- **Only Critical Pauses**: Military only stops when bucket < 1000
- **Recovery-Focused**: Ignores bucket level, tracks recovery rate
- **Pixel Compatible**: Works perfectly when bucket = 0 after pixel generation

### **Why This Works**
With 245 bucket/tick recovery (typical), you can:
- Generate a pixel every ~41 ticks
- Run full military operations
- Control 3+ rooms
- Stay in positive CPU balance
- All while bucket fluctuates between 0 and 10,000!

See `CPU_MANAGEMENT.md` for detailed explanation.

## 📊 **Enhanced Status Dashboard (v1.3)**

Every 20 ticks, the console displays comprehensive tactical status:

```
=== BASE STATUS RCL 4 ===
Controller: 12500/45000 (27.8%) - 32500 to next RCL
Energy: 800/800 (100%)

--- POPULATION ---
Miners: 2/2 | Haulers: 3/3 (2 busy, 1 idle)
Upgraders: 8/8 | Builders: 2/2

--- v1.3 TACTICAL STATUS ---
✅ CPU: Bucket 9245/10000, Recovery: 245.3/tick (target: 150+)
⚔️ Military: 2 warriors, 1 healers, 0 raiders
🎯 Active Assaults: 1
  - W1N1: assault phase (wave 1)
🔍 Intel: 15 rooms scouted, 3 conquerable
🚀 SPEEDRUN to RCL 5: 27.8% complete
========================
```

### **Status Icons**
- 🚀 Speedrun mode active
- ⚔️ Military units deployed
- 🎯 Active assault in progress
- 🔍 Intelligence gathered
- ✅ CPU efficiency good
- ⚠️ CPU efficiency warning
- 💰 Raider collecting resources
- 💚 Healer supporting warriors

## 📤 **Code Deployment**

### **MCP Server (Recommended)** 🤖
The repository includes a **Model Context Protocol (MCP) server** for AI-assisted bot development! Use it with Claude Desktop or any MCP-compatible client.

**Features:**
- 🚀 Upload code to Screeps
- 🔍 Monitor console logs and errors
- 🐛 Automatic troubleshooting with recommendations
- 💾 Memory access and management
- 📊 Performance analysis (CPU, bucket, GCL)
- 🗺️ Room information and terrain data
- ⚡ Execute console commands

**Quick Setup:**
```bash
cd screeps-mcp
npm install
cp .env.example .env
# Edit .env and add your SCREEPS_TOKEN
```

**See `screeps-mcp/README.md` and `screeps-mcp/QUICK_START.md` for full documentation.**

### **Upload Script**
The repository also includes `upload-to-screeps.sh` for easy code deployment to your Screeps account. See `UPLOAD_README.md` for full instructions.

**Quick Start:**
```bash
# Set your auth token
export SCREEPS_TOKEN='your_token_here'

# Upload to default branch
./upload-to-screeps.sh

# Or upload to specific branch
SCREEPS_BRANCH='experimental' ./upload-to-screeps.sh
```

**Prerequisites:**
- `curl` (pre-installed on most systems)
- `jq` for JSON processing: `sudo apt-get install jq`

**Token Setup:**
1. Go to https://screeps.com/a/#!/account/auth-tokens
2. Generate a token with "Full Access"
3. Set as environment variable or in `~/.screeps-config`

## 🔧 **Troubleshooting & Tips (v1.3)**

### **Common Issues**

**"⚠️ CPU EFFICIENCY WARNING"**
- **Cause**: Bucket recovery rate < 150/tick
- **Solution**: 
  - Reduce scout range: `AGGRESSIVE_SCOUT_RANGE = 2`
  - Disable military temporarily: `ENABLE_MILITARY = false`
  - Reduce max controlled rooms: `MAX_CONTROLLED_ROOMS = 2`
  - Let bucket recover naturally

**No Military Operations Starting**
- **Check**:
  1. RCL ≥ 4? (`Game.rooms['W1N1'].controller.level`)
  2. Bucket ≥ 1000? (`Game.cpu.bucket`)
  3. Military enabled? (`ENABLE_MILITARY = true`)
  4. Conquerable rooms scouted? (Check console dashboard)
  5. Cooldown elapsed? (1000 ticks between conquests)

**Raiders Not Spawning**
- **Cause**: Assault must be in 'raid' phase
- **Solution**: Wait for warriors to clear all hostiles first
- **Check**: Active assaults display shows current phase

**Bot Too Aggressive (Bucket Dropping)**
- **Solutions**:
  - Increase critical threshold: `CRITICAL_BUCKET_THRESHOLD = 3000`
  - Increase conquest cooldown: `CONQUEST_COOLDOWN = 2000`
  - Reduce max towers: `MAX_HOSTILE_TOWERS_FOR_ASSAULT = 1`
  - Reduce controlled rooms: `MAX_CONTROLLED_ROOMS = 2`

**Bot Not Aggressive Enough**
- **Solutions**:
  - Decrease critical threshold: `CRITICAL_BUCKET_THRESHOLD = 500`
  - Decrease conquest cooldown: `CONQUEST_COOLDOWN = 500`
  - Increase scout range: `AGGRESSIVE_SCOUT_RANGE = 4`
  - Increase max towers: `MAX_HOSTILE_TOWERS_FOR_ASSAULT = 3`

### **Best Practices**

**Early Game (RCL 1-3):**
1. Focus on economy first
2. Build defensive walls and towers
3. Let the bot scout passively
4. Don't worry about military yet

**Mid Game (RCL 4):**
1. Military unlocks - let it scout aggressively
2. Monitor CPU efficiency warnings
3. First conquest should be easy target (0-1 towers)
4. Keep bucket above 5000 for safety

**Late Game (RCL 5+):**
1. Speedrun optimization completes at RCL 5
2. Full military capabilities available
3. Control 2-3 high-quality rooms
4. Abandon poor rooms automatically
5. Extract resources from conquered rooms

### **Performance Tips**

**For Maximum Expansion:**
- Set `CRITICAL_BUCKET_THRESHOLD = 500` (very aggressive)
- Set `MAX_CONTROLLED_ROOMS = 3` (claim more rooms)
- Set `AGGRESSIVE_SCOUT_RANGE = 4` (scout further)

**For Maximum Efficiency:**
- Set `MIN_BUCKET_RECOVERY_RATE = 200` (higher standard)
- Set `CRITICAL_BUCKET_THRESHOLD = 3000` (more conservative)
- Set `MAX_CONTROLLED_ROOMS = 2` (fewer rooms)

**For Pixel Farming:**
- Focus on high recovery rate (200+/tick)
- Control 1-2 high-quality rooms
- Monitor pixel generation rate in console
- Bucket will fluctuate 0-10000 (normal!)

### **Memory Inspection**

Check tactical status in console:
```javascript
// CPU stats
Memory.strategic.cpuStats.averageBucketRecovery

// Room intelligence
Memory.strategic.roomIntelligence

// Active assaults
Memory.strategic.militaryOperations.activeAssaults

// Conquest history
Memory.strategic.militaryOperations.conquestHistory

// Controlled rooms
Memory.strategic.controlledRooms
```

## 📝 **Version History**

### **v1.3.0** (October 10, 2025) - Tactical Aggression & Expansion
- **Military Operations System**: Complete tactical warfare capabilities
  - New creep roles: Warrior, Healer, Dismantler, Raider
  - Phased assault system: Prepare → Assault → Raid → Complete
  - Automatic target selection and conquest coordination
  - Resource extraction from conquered rooms
- **Room Intelligence System**: Automatic analysis of all visible rooms
  - Threat assessment (0-10 scale) based on towers, spawns, creeps, RCL
  - Strategic value scoring for conquest prioritization
  - Continuous intelligence updates every 10 ticks
- **Aggressive Reconnaissance**: Scout 3 rooms out in all directions
  - Automatic target queue management
  - Re-scouting every 1000 ticks for fresh intelligence
  - Military intelligence gathering
- **CPU Management Philosophy**: Recovery rate-focused approach
  - Monitors bucket/tick recovery rate (target: 150+/tick)
  - Pixel generation compatible (works at bucket = 0)
  - Aggressive stance: only stops military when bucket < 1000
  - Three warning levels with detailed console output
- **Room Abandonment Logic**: Quality-based room evaluation
  - Automatic abandonment of rooms scoring < 500
  - Safety checks prevent over-abandonment
  - Resource extraction before abandoning
- **RCL 5 Speedrun Optimization**: Rapid progression system
  - Boosts upgraders to 15 when below RCL 5
  - Activates with storage > 50k or spawn > 70% full
  - Builder reduction when construction backlog low
- **Multi-Room Control**: Manages up to 3 controlled rooms simultaneously
- **Enhanced Status Dashboard**: Comprehensive tactical status display
  - CPU efficiency indicators (✅⚠️🚨)
  - Military population counts
  - Active assault tracking
  - Intelligence summary
  - Speedrun progress indicator
- **Configuration Constants**: 15+ tunable settings for tactical behavior
  - Military switches (enable/disable, RCL requirements)
  - CPU thresholds (recovery rates, bucket levels)
  - Conquest parameters (cooldowns, requirements)
  - Abandonment criteria

### **v1.2.1** (October 4, 2025) - Hauler Efficiency & Scout Improvements
- **Hauler Efficiency Improvements**:
  - Increased container energy thresholds from 100 to 400 energy for collection
  - Haulers now wait for containers to build up meaningful amounts before collecting
  - Remote dropped energy threshold increased from 50/100 to 200 energy
  - Better utilization of remote room energy sources
  - Reduced number of hauler trips with fuller cargo loads
- **Energy Delivery Priority Updates**:
  - Controller containers now prioritized over storage (keeps upgraders supplied)
  - Delivery order: Spawn/Extensions/Towers → Controller Containers → Storage → Other Containers
  - Prevents upgraders from running out of energy when storage is present
- **Scout Spawn Area Handling**:
  - Added timeout detection for scouts stuck trying to reach blocked rooms (100 tick timeout)
  - Temporarily blocked rooms tracked in memory and retried after 1000 ticks
  - Better handling of spawn area boundaries in respawn zones
  - Scouts now efficiently skip unreachable rooms and focus on accessible ones
- **Reserver Spawning Optimization**:
  - Only spawns new reserver when reservation < 1000 ticks remaining
  - Checks actual room reservation status before spawning
  - Reduces unnecessary reserver spawning and energy waste
- **Bug Fixes**:
  - Fixed haulers sitting in remote rooms with full cargo (now return home to deliver)
  - Fixed optional chaining syntax errors (not supported by Screeps server)
  - Fixed syntax error in file header comment block
  - Fixed indentation issues in creep role tracking

### **v1.2.0** (October 4, 2025) - Remote Harvesting & Multi-Spawn
- **Remote Harvesting System**: Automatic scouting, evaluation, and harvesting of adjacent rooms
  - Activates at RCL 4 (when CLAIM parts become available)
  - Scouts and ranks all 8 adjacent rooms by score (sources, distance, terrain)
  - Automatically selects 1-3 best rooms based on RCL
  - New creep roles: Scout, Reserver, Remote Miner, Remote Builder, Remote Hauler
  - Plans and builds containers + roads in remote rooms
  - Haulers automatically collect from remote rooms
  - Energy throughput calculations include remote sources
- **Multi-Spawn Support**: Added 2nd spawn at RCL 7, 3rd spawn at RCL 8
  - Faster creep production for remote operations
  - Better redundancy if spawn is damaged
- **Energy Boost**: Up to 3x energy income with 3 remote rooms (60 additional energy/tick)
- **Infrastructure Planning**: Automatic container and road planning for remote rooms

### **v1.1.0** (October 2, 2025) - Competitive Optimizations
- **CPU Optimizations**: Structure caching, distance metrics caching, spawn pre-assignment (~8-15 CPU/tick savings)
- **Link Energy Transfer**: Automated energy transfer system for RCL5+ (every 5 ticks)
- **Creep Recycling**: Automatic energy recovery from dying creeps (50-70% cost recovery)
- **Emergency Detection**: Monitors controller downgrade, energy crisis, spawn damage
- **Dynamic Upgrader Scaling**: Storage-based scaling (2-15 upgraders based on fill level)
- **Priority Tower Repairs**: Critical structure prioritization (spawn, towers, storage first)
- **Road Maintenance**: Builders maintain roads at >50% HP
- **Memory Cleanup**: Automatic removal of built structures from planning memory

### **v1.0.0** - Initial Release
- Core throughput optimization with mathematical calculations
- Miner/Hauler/Upgrader/Builder roles
- Container-based energy distribution
- Automated base planning and construction
- Entrance sealing with curtain + book-ends defense
- RCL-scaled wall/rampart maintenance
- Pixel generation system

---

## 📚 **Additional Documentation**

- **`V1.3_QUICK_REFERENCE.md`**: Quick reference guide with commands, troubleshooting, and configuration
- **`CHANGELOG_v1.3.md`**: Detailed v1.3 feature documentation and technical details
- **`CPU_MANAGEMENT.md`**: In-depth explanation of the recovery-rate focused CPU philosophy
- **`UPLOAD_README.md`**: Complete guide for uploading code to Screeps using the included script
- **`screeps-mcp/README.md`**: Full MCP server documentation with all 13 tools
- **`screeps-mcp/QUICK_START.md`**: 5-minute MCP setup guide
- **`screeps-mcp/API_REFERENCE.md`**: Complete Screeps API reference

---

*This bot implements advanced throughput mathematics, aggressive tactical expansion, and competitive optimizations for players who want an autonomous, multi-room empire that conquers neighbors, extracts resources, and earns pixels efficiently with minimal maintenance.*
