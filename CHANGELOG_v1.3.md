# Mini-Screeps v1.3 - Tactical Aggression & Expansion

## Overview
Version 1.3 transforms mini-screeps from a passive pixel-farming bot into an aggressive, tactical expansion bot that can survive, dominate, and conquer neighboring rooms while maintaining CPU efficiency.

## Strategic Goals
1. **PRIMARY**: Survive & Dominate - speed run to RCL 5 in home rooms
2. **SECONDARY**: Aggressive expansion - scout, conquer, extract resources
3. **TERTIARY**: Maintain CPU efficiency for pixel generation (>150 bucket/tick recovery)

## Major Features Added

### 1. CPU Monitoring System ✅
- **Bucket Recovery Tracking**: Monitors bucket recovery rate every 10 ticks
- **Efficiency Alerts**: Warns when recovery drops below 150 bucket/tick threshold
- **Military Gate**: Prevents military operations when bucket < 8000
- **Performance Dashboard**: Real-time CPU stats in status display

**Key Functions:**
- `initializeStrategicMemory()` - Initialize v1.3 memory structures
- `monitorCPUPerformance()` - Track bucket recovery rate
- `getCPUEfficiency()` - Get current CPU status

### 2. Room Intelligence System ✅
- **Automatic Analysis**: Analyzes all visible rooms for strategic value
- **Threat Assessment**: Calculates threat level (0-10) based on towers, spawns, RCL
- **Conquest Evaluation**: Determines if rooms are worth conquering
- **Strategic Scoring**: Evaluates rooms based on sources, distance, difficulty

**Room Intelligence Includes:**
- Status (neutral/hostile/owned)
- Source count
- Tower/spawn count
- RCL level
- Distance from home
- Threat level (0-10)
- Difficulty rating (0-10)
- Strategic value (0-100)
- Conquerable flag

**Key Functions:**
- `updateRoomIntelligence()` - Update intel for all visible rooms
- `analyzeRoom()` - Deep analysis of room capabilities

### 3. Aggressive Reconnaissance ✅
- **Extended Scouting**: Scouts 3 rooms out in all directions
- **Continuous Updates**: Re-scouts rooms every 1000 ticks
- **Target Queue**: Maintains list of rooms needing exploration
- **Military Intelligence**: Gathers data for tactical decisions

**Key Functions:**
- `aggressiveReconnaissance()` - Queue rooms for scouting
- `getRoomsInRange()` - Generate room names within range

### 4. Room Conquest System ✅
- **Target Selection**: Automatically selects best conquest targets
- **Tactical Evaluation**: Won't attack rooms we can't defeat
- **Phased Assaults**: Prepare → Assault → Raid → Complete
- **Resource Extraction**: Raiders collect resources from conquered rooms

**Conquest Logic:**
- Minimum 1 source required
- Maximum 2 hostile towers allowed
- Strategic value must exceed 20
- Cooldown of 1000 ticks between conquests

**Key Functions:**
- `planMilitaryOperations()` - Initiate new conquests
- `selectConquestTarget()` - Find best target room
- `coordinateAssaultWaves()` - Manage active assaults

### 5. Military Creep Roles ✅

#### Warrior
- **Body**: `[TOUGH×2, MOVE×6, ATTACK×4]` (cost: ~1300 energy)
- **Role**: Front-line combat, destroys hostile creeps and structures
- **Priority**: Targets threatening creeps first, then spawns/towers
- **Tactics**: Moves to target room and engages all hostiles

#### Healer
- **Body**: `[MOVE×4, HEAL×4]` (cost: ~1000 energy)
- **Role**: Support unit, heals warriors and self
- **Behavior**: Stays within 2 tiles of warriors, prioritizes healing wounded
- **Tactics**: Uses ranged heal at range 3, melee heal at range 1

#### Dismantler
- **Body**: `[MOVE, WORK×N]` (scalable)
- **Role**: Structure destruction, wall clearing
- **Priority**: Spawns, towers, storage, terminal, then walls
- **Tactics**: Systematic demolition of hostile infrastructure

#### Raider
- **Body**: `[CARRY×6, MOVE×6]` (cost: ~600 energy)
- **Role**: Resource extraction from conquered rooms
- **Collection**: Picks up dropped resources, loots ruins/tombstones, extracts from storage
- **Transport**: Brings all resources back to home room storage/spawn

**Key Functions:**
- `runWarrior()` - Combat behavior
- `runHealer()` - Support behavior
- `runDismantler()` - Structure destruction
- `runRaider()` - Resource collection

### 6. Assault Wave Coordination ✅
- **Wave Composition**: 2 warriors + 1 healer per assault
- **Phase Management**: Automatically transitions between phases
- **Adaptive Spawning**: Spawns raiders when assault phase completes
- **Cleanup**: Removes completed assaults from active list

**Assault Phases:**
1. **Prepare**: Spawn military creeps
2. **Assault**: Clear all hostile creeps and structures
3. **Raid**: Extract resources
4. **Complete**: Mission accomplished

### 7. Room Abandonment Logic ✅
- **Quality Evaluation**: Scores rooms based on sources, distance, energy
- **Minimum Threshold**: Abandons rooms scoring below 500
- **Safety Check**: Won't abandon if only 1-2 rooms remain
- **Resource Extraction**: Waits for resource evacuation before abandoning

**Evaluation Factors:**
- Source count × 300
- Energy capacity / 50
- Controller level × 50
- Distance penalty × 100
- Storage energy / 100

**Key Functions:**
- `evaluateRoomAbandonment()` - Check all rooms periodically
- `evaluateRoomQuality()` - Calculate room score
- `executeRoomAbandonment()` - Perform unclaim

### 8. RCL 5 Speed Run Optimization ✅
- **Upgrader Boost**: Increases upgraders when below RCL 5
- **Energy Threshold**: Activates when storage > 50k or spawn > 70%
- **Builder Reduction**: Reduces builders slightly when < 10 construction sites
- **Progressive Scaling**: Up to 15 upgraders for rapid progression

**Speed Run Conditions:**
- Storage energy > 50,000 OR
- Energy available > 70% capacity AND capacity >= 800

**Console Output:**
```
🚀 SPEEDRUN MODE: Boosting upgraders to 12 (Target: RCL 5)
```

### 9. Military Spawning Integration ✅
- **Automatic Spawning**: Spawns military creeps for active assaults
- **Phase-Aware**: Spawns appropriate creeps based on assault phase
- **CPU Gated**: Only spawns when bucket >= 8000
- **Priority System**: Military spawns after core infrastructure creeps

**Spawn Priority:**
1. Core creeps (miners, haulers, upgraders, builders)
2. Remote harvesting creeps
3. Military creeps (warriors, healers, raiders)

### 10. Enhanced Status Dashboard ✅
New "v1.3 TACTICAL STATUS" section shows:
- **CPU Efficiency**: Bucket level and recovery rate with visual indicators
- **Military Population**: Count of each military creep type
- **Active Assaults**: Shows target rooms and current phase
- **Intelligence Summary**: Rooms scouted and conquerable targets
- **Speedrun Progress**: Shows progress when below RCL 5

**Example Output:**
```
--- v1.3 TACTICAL STATUS ---
✅ CPU: Bucket 9500/10000, Recovery: 245.3/tick (target: 150+)
⚔️ Military: 2 warriors, 1 healers, 0 raiders
🎯 Active Assaults: 1
  - W1N1: assault phase (wave 1)
🔍 Intel: 15 rooms scouted, 3 conquerable
🚀 SPEEDRUN to RCL 5: 67.3% complete
```

## Configuration Constants

### Tactical Settings
```javascript
const VERSION = '1.3';
const MIN_BUCKET_RECOVERY_RATE = 150;  // Target CPU efficiency
const MAX_CONTROLLED_ROOMS = 3;        // Maximum concurrent rooms
const SPEEDRUN_TARGET_RCL = 5;         // Speed run target level
const AGGRESSIVE_SCOUT_RANGE = 3;      // Scout distance
const CONQUEST_COOLDOWN = 1000;        // Ticks between conquests
const ROOM_ABANDON_CHECK_INTERVAL = 5000; // Abandonment check frequency
```

### Military Settings
```javascript
const ENABLE_MILITARY = true;              // Master military switch
const MIN_RCL_FOR_MILITARY = 4;            // Minimum RCL for military ops
const ASSAULT_WAVE_SIZE = 3;               // Creeps per assault wave
const CRITICAL_BUCKET_THRESHOLD = 1000;    // Only stop military when bucket THIS low
const BUCKET_RECOVERY_FLOOR = 100;         // Warn if recovery below this, but don't stop
```

### Evaluation Thresholds
```javascript
const MIN_SOURCES_FOR_CONQUEST = 1;              // Minimum sources worth conquering
const MAX_HOSTILE_TOWERS_FOR_ASSAULT = 2;        // Maximum towers we'll assault
const MIN_ENERGY_SCORE_FOR_KEEP = 500;           // Minimum score to keep room
```

## Strategic Behavior

### Early Game (RCL 1-3)
- Focus on economy and infrastructure
- Scout nearby rooms for intelligence
- Build defensive structures
- No military operations yet

### Mid Game (RCL 4)
- Military operations become available
- Begins aggressive scouting
- Identifies conquest targets
- Maintains speedrun focus to RCL 5

### Late Game (RCL 5+)
- Full military capabilities
- Active conquest campaigns
- Resource raiding operations
- Room abandonment for optimization

## Operational Philosophy

### Tactical Approach
- **Strike Hard and Fast**: Launches coordinated assaults after safe mode expires
- **Hit and Run**: Raiders extract resources and return home
- **Minimize Exposure**: Keeps room count low (max 3 controlled)
- **Continuous Scouting**: Always searching for new opportunities

### Resource Management
- **Efficiency First**: Maintains >150 bucket/tick recovery
- **Quality Over Quantity**: Prefers fewer, better rooms
- **Dynamic Abandonment**: Drops sub-optimal rooms without hesitation
- **Aggressive Extraction**: Raids conquered rooms for quick resource recovery

### Combat Strategy
- **Threat Assessment**: Only attacks winnable targets
- **Balanced Waves**: 2 warriors + 1 healer for sustainability
- **Phase-Based**: Systematic approach (prepare → assault → raid → complete)
- **Resource Recovery**: Always extracts value from conquered rooms

### CPU Management Philosophy (AGGRESSIVE)
- **Target Recovery**: Aim for >150 bucket/tick recovery rate
- **Warning Thresholds**: Warn at <150/tick (target) and <100/tick (floor) but continue operations
- **Critical Only**: Only pause military when bucket drops below 1000 (near emergency)
- **No Conservative Gates**: Removed the 8000 bucket requirement - be aggressive!
- **Monitor, Don't Block**: Focus on recovery rate monitoring rather than hard stops
- **Accept the Cost**: Understand that more rooms = more CPU, but worth it for expansion

**Philosophy**: The bot will warn you when CPU efficiency drops, but won't stop military operations unless the bucket is critically low (< 1000). This allows for aggressive expansion while keeping you informed. If recovery rate stays above 150/tick, you're golden. Below 100/tick you'll see warnings but operations continue. Only below 1000 bucket does the bot pause new military operations.

## Memory Structure

### Memory.strategic
```javascript
{
  version: "1.3",
  cpuStats: {
    samples: [],                    // Last 100 CPU samples
    averageBucketRecovery: 0,      // Average bucket/tick
    lastCheck: 0,                   // Last check time
    lastBucket: 0                   // Previous bucket value
  },
  roomIntelligence: {
    "W1N1": {                       // Room-by-room intel
      firstSeen: 0,
      lastUpdated: 0,
      status: "hostile",
      owner: "PlayerName",
      rcl: 3,
      sources: 2,
      distance: 2,
      threatLevel: 4.5,
      difficulty: 5,
      strategicValue: 65,
      energyValue: 2000,
      isConquerable: true,
      hostileCount: 2,
      towerCount: 1,
      spawnCount: 1,
      hasWalls: true
    }
  },
  militaryOperations: {
    activeAssaults: {
      "W1N1": {                     // Active assault data
        startTick: 0,
        targetRoom: "W1N1",
        homeRoom: "W2N2",
        phase: "assault",
        wavesSent: 1,
        creepsLost: 0
      }
    },
    conquestHistory: [],            // Past conquests
    lastConquest: 0                 // Last conquest timestamp
  },
  controlledRooms: [],              // Our controlled rooms
  abandonmentQueue: []              // Rooms marked for abandonment
}
```

## Performance Considerations

### CPU Optimization
- Intelligence updates every 10 ticks
- Abandonment checks every 5000 ticks
- Military planning every 50 ticks
- Efficient creep filtering and counting

### Memory Management
- Automatic cleanup of old intelligence (10k ticks)
- Limited sample history (100 samples)
- Compact conquest history
- No memory leaks

### Scaling
- Works efficiently from RCL 1-8
- Adapts military presence to CPU availability
- Scales operations based on bucket level
- Maintains pixel farming as tertiary goal

## Usage Tips

### Getting Started
1. Bot automatically initializes v1.3 systems on first run
2. Focus on reaching RCL 4 to unlock military
3. Let the bot scout and gather intelligence
4. Military operations will auto-start when ready

### Monitoring
- Check status dashboard every 20 ticks for tactical updates
- Watch CPU efficiency warnings
- Monitor active assaults in console
- Track speedrun progress to RCL 5

### Tuning
- Adjust `MIN_BUCKET_RECOVERY_RATE` for your CPU needs
- Modify `AGGRESSIVE_SCOUT_RANGE` for exploration speed
- Change `MAX_CONTROLLED_ROOMS` for empire size
- Toggle `ENABLE_MILITARY` to disable combat

### Troubleshooting
- **Low CPU efficiency**: Reduce military operations or scouting range
- **No assaults starting**: Check RCL >= 4 and bucket >= 8000
- **Raiders not spawning**: Ensure assault phase is "raid"
- **Rooms not abandoning**: Check scores are below 500 threshold

## Future Enhancements (Not Implemented)
- Claimer creeps for actual room claiming
- Observer integration for remote intelligence
- Nuke support for high-level warfare
- Alliance/NAP protocols
- Market integration for resource trading
- Power creep support

## Compatibility
- Compatible with v1.0-1.2 features
- Backward compatible with existing memory
- Remote harvesting still functional
- All pixel farming logic intact

## Credits
Developed for tactical domination in Screeps MMO. Version 1.3 focuses on aggressive expansion while maintaining the efficiency and pixel-farming capabilities of previous versions.

---

**Remember**: This is a tactical bot. It's designed to be aggressive but smart. It won't suicide into impossible fights, but it WILL take advantage of vulnerable neighbors. Keep your CPU efficiency high and your rooms lean for maximum effectiveness! [[memory:7052456]]

