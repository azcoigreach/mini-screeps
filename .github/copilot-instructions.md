# Mini-Screeps Bot - AI Coding Instructions

## Project Overview
This is a **single-file Screeps bot** focused on pixel earning through optimal energy throughput calculations. The entire bot logic exists in `main.js` (~2600 lines) with mathematical precision for room efficiency.

## Architecture Patterns

### Single-File Design Philosophy
- **Everything in `main.js`**: Complete bot implementation, no modules or dependencies
- **Self-contained**: Zero external dependencies, pure Screeps API usage
- **Mathematical Foundation**: All creep spawning and energy flow based on calculated throughput formulas

### Core Energy Flow System
```
Sources (2x 10 e/tick) → Miners (parked on containers) → Haulers (optimized CARRY/MOVE) → Spawn/Extensions → Upgraders/Builders
```

Key pattern: **Miners never move** - they park on source containers for 100% uptime. Haulers do all transport with calculated body ratios.

### Distance-Based Optimization
The bot calculates optimal creep configurations using:
- `Trtt = 2d + 4` (round-trip time formula)
- `CARRY = Math.ceil((2/5) * Trtt)` for hauler sizing
- Road planning reduces movement costs from 5→2 (swamp) to 1 (road)

## Code Organization Patterns

### Memory Structure
- `room.memory.plannedStructures[]`: Array of {x, y, type} for base planning
- `room.memory.baseCenter`: Anchor point for stamps and road planning
- `creep.memory.assignedSource`: Source ID for distributed energy gathering
- `room.memory.sharedConstructionTarget`: Single target for all builders

Additional builder energy rules:
- Builders prefer picking up dropped energy first and will prioritize drops near their current `buildTarget` or `assignedSource` before selecting room-wide drops.
- After picking up ground energy, builders will attempt to top up from a nearby source container (<=2 tiles) if they still have free capacity.

### Function Naming Conventions
- `runRole(creep)`: Main creep behavior functions (e.g., `runMiner`, `runHauler`)
- `placeComponentStamp()`: Base planning functions that add structures to planned array
- `getResourceDistribution()`: Helper functions for balanced resource assignment
- Configuration constants in UPPER_CASE at file top

### Stamp-Based Base Planning
Buildings placed using "stamps" - predefined relative coordinate arrays:
```javascript
const coreStamp = [
    [0, 0, STRUCTURE_SPAWN],      // Anchor point
    [-3, -1, STRUCTURE_EXTENSION], // Relative positions
    // Roads only where no other structures exist
];
```

## Critical Development Workflows

### Testing & Debugging
- **No automated tests** - verification happens in Screeps simulator/server
- **Console logging patterns**: Status dashboard every 20 ticks, construction progress with emojis
- **Visual debugging**: Toggle `VISUALIZE_BASE = true` for structure placement overlay
- **Performance monitoring**: CPU usage logged every 100 ticks

### Deployment Process
1. Copy `main.js` to Screeps script directory
2. Bot auto-calculates room layout and spawns optimal creeps
3. Monitor console for distance calculations and population status
4. Adjust population targets in `getPopulationByRCL()` if needed

### Common Debugging Patterns
```javascript
// Distance calculation logging
console.log(`Distance calculation complete: avg=${avgDist}, Trtt=${roundTripTime}, carryNeeded=${carryNeeded}`);

// Population status dashboard
console.log(`Miners: ${creeps.miner.length}/${targets.miner} | Haulers: ${creeps.hauler.length}/${targets.hauler}`);

// Priority construction logging
console.log(`✅ PRIORITY: Created extension construction site at (${pos.x},${pos.y}) - distance ${distance} from spawn`);
```

## Key Integration Points

### Creep Role Distribution System
All energy-gathering creeps (haulers, builders, upgraders) use `getDistributedEnergyContainer()` to balance source usage. **Never assign sources manually** - the distribution system prevents overcrowding.

### Construction Priority System
1. **Extensions first** (closest to spawn prioritized)
2. Core structures (spawn, storage, towers)
3. **Roads only after** 5+ extensions and 1+ container built
4. All builders work on shared target via `room.memory.sharedConstructionTarget`

### Defense Hit Point Management
Walls and ramparts auto-repair to RCL-based targets:
```javascript
const WALL_TARGET_HITS = {
    1: 1000, 2: 10000, 3: 30000, 4: 100000, // ... scales with RCL
};
```

## Project-Specific Conventions

### Error Handling
- **Graceful degradation**: Functions return null/false instead of throwing
- **Automatic reassignment**: Creeps lose targets/sources, system redistributes
- **Console warnings**: Logged with emojis for visibility (🚧, ⚠️, ✅)

### Performance Optimizations
- **Conditional frequency**: Heavy operations run every N ticks (base planning: once, construction: every 5 ticks)
- **Early returns**: Check `if (!spawn) return;` patterns throughout
- **Memory cleanup**: Dead creeps auto-removed from Memory.creeps

### Mathematical Precision
Unlike typical Screeps bots, this code calculates exact energy throughput requirements:
- Source output: 2 sources × 10 energy/tick = 20 energy/tick total
- Miner bodies: 5 WORK parts = 10 energy/tick harvest (caps source)
- Hauler sizing based on distance calculations, not guesswork

## Modification Guidelines

- **Maintain mathematical foundation**: Don't modify energy flow calculations without recalculating throughput
- **Test population changes**: Adjust `getPopulationByRCL()` and `getBodiesByEnergyCapacity()` together
- **Preserve single-file architecture**: Don't split into modules - deployment simplicity is key
- **Keep stamp-based planning**: Use existing stamp pattern for new structure types
- **Maintain distribution system**: Energy-gathering roles must use `getDistributedEnergyContainer()`

Population & throughput notes:
- Hauler counts are computed using throughput math (Trtt → carry per hauler → energy per trip → haulersNeeded). The spawn logic now enforces that the hauler spawn target respects the throughput-calculated minimum.
- Builders will scale with construction backlog (1 base, up to 3 builders depending on number of construction sites).

## Common Tasks

### Adding New Creep Role
1. Add to `getPopulationByRCL()` and `getBodiesByEnergyCapacity()`
2. Create `runNewRole(creep)` function
3. Add to spawn priority in `spawnCreeps()`
4. Use energy distribution system if gathering resources

### Modifying Base Layout
1. Create new stamp array with relative coordinates
2. Add `placeComponentStamp()` function
3. Call from `planBase()` function
4. Ensure roads connect via `planRoadNetwork()`

## Entrance Sealing (Book-ends + Curtain)

The bot seals natural room entrances with a minimal pattern that still allows friendly passage:

- Book-ends: two constructed walls placed inside the room at the overhang endpoints of each entrance span
- Curtain: a continuous line of walls `ENTRANCE_CURTAIN_DEPTH` tiles inside the room across the entrance
- Overhang: curtain extends `ENTRANCE_OVERHANG_TILES` tiles beyond both entrance ends (default 2)
- Gate: the curtain’s center tile is a rampart (friendly passage)
- Terrain-aware: never plans walls/ramparts on terrain wall tiles

Config constants (top of `main.js`):

```js
const ENTRANCE_CURTAIN_DEPTH = 2;
const ENTRANCE_OVERHANG_TILES = 2;
```

When modifying defense planning, preserve these invariants (overhang width, depth, and center rampart gate) unless deliberately changing the design.