/**
 * Mini-Screeps Bot - Pixel Focused with Throughput Optimization
 * 
 * Goals:
 * 1. Primary: Earn Pixels (10,000 CPU = 1 Pixel)
 * 2. Secondary: Maintain base and upgrade controller
 * 3. Tertiary: Maximize room energy efficiency through throughput math
 * 
 * Features:
 * - Single room operation only
 * - No expansion or remote harvesting
 * - Optimized creep roles: miner, hauler, upgrader, builder
 * - Centralized base around controller
 * - No Labs or Factories
 * - Throughput-based spawn logic with distance calculations
 * - Road planning for improved hauler efficiency
 * - Dynamic energy allocation between builders and upgraders
 * 
 * Throughput Math Implementation:
 * - 2 sources × 10 energy/tick = 20 energy/tick total
 * - Miners: 5W 1M parked on containers (continuous mining)
 * - Haulers: CARRY/MOVE ratio calculated based on round-trip distance
 * - Energy flow: Sources → Containers → Haulers → Spawn/Extensions → Upgraders
 */

module.exports.loop = function () {
    // Clean up memory
    for (const name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }

    // Get the spawn and room
    const spawn = Game.spawns[Object.keys(Game.spawns)[0]];
    if (!spawn) return;
    
    const room = spawn.room;
    
    // Count creeps by role
    const creeps = {
        miner: _.filter(Game.creeps, creep => creep.memory.role === 'miner'),
        hauler: _.filter(Game.creeps, creep => creep.memory.role === 'hauler'),
        upgrader: _.filter(Game.creeps, creep => creep.memory.role === 'upgrader'),
        builder: _.filter(Game.creeps, creep => creep.memory.role === 'builder')
    };

    // Plan base layout once
    if (!room.memory.basePlanned) {
        planBase(room);
        room.memory.basePlanned = true;
    }

    // Create construction sites
    if (Game.time % 10 === 0) {
        createMissingConstructionSites(room);
    }

    // Spawn creeps based on needs
    spawnCreeps(spawn, creeps);

    // Debug creep status every 20 ticks
    if (Game.time % 20 === 0) {
        console.log(`RCL ${room.controller.level}: Miners: ${creeps.miner.length}, Haulers: ${creeps.hauler.length}, Upgraders: ${creeps.upgrader.length}, Builders: ${creeps.builder.length}`);
        
        // Show what each creep is doing
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            const energy = creep.store[RESOURCE_ENERGY];
            const capacity = creep.store.getCapacity();
            console.log(`${creep.name} (${creep.memory.role}): ${energy}/${capacity} energy at ${creep.pos.x},${creep.pos.y}`);
        }
    }

    // Run creep logic
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        runCreep(creep);
    }

    // CPU management for Pixel earning
    manageCPUForPixels();
}

function planBase(room) {
    const controller = room.controller;
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const sources = room.find(FIND_SOURCES);
    
    // Initialize base planning storage
    room.memory.plannedStructures = [];
    room.memory.baseCenter = null;
    
    // Find best anchor position using distance transform
    const anchor = findOptimalAnchor(room, controller, spawn);
    if (!anchor) {
        console.log(`Failed to find suitable anchor position in room ${room.name}`);
        return;
    }
    
    room.memory.baseCenter = { x: anchor.x, y: anchor.y };
    console.log(`Base anchor positioned at ${anchor.x},${anchor.y}`);
    
    // Place core stamp (spawn area + extensions)
    placeCoreStamp(room, anchor);
    
    // Place source stamps (containers + roads)
    for (const source of sources) {
        placeSourceStamp(room, source);
    }
    
    // Place controller stamp (container + roads)
    placeControllerStamp(room, controller, anchor);
    
    // Place extension field stamps around core
    placeExtensionFields(room, anchor);
    
    // Place defense stamps (towers)
    placeDefenseStamps(room, anchor);
    
    // Place economy stamps (storage, terminal, links)
    placeEconomyStamps(room, anchor);
    
    // Connect everything with roads
    planRoadNetwork(room, anchor, sources, controller);
    
    console.log(`Base planned with ${room.memory.plannedStructures.length} structures`);
}

// Distance transform to find best anchor position
function findOptimalAnchor(room, controller, spawn) {
    const terrain = new Room.Terrain(room.name);
    const distanceMatrix = new PathFinder.CostMatrix();
    
    // Calculate distance from walls for each position
    for (let x = 5; x < 45; x++) {
        for (let y = 5; y < 45; y++) {
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                distanceMatrix.set(x, y, 0);
                continue;
            }
            
            // Find distance to nearest wall
            let minDist = 50;
            for (let dx = -4; dx <= 4; dx++) {
                for (let dy = -4; dy <= 4; dy++) {
                    const checkX = x + dx;
                    const checkY = y + dy;
                    if (checkX < 0 || checkX > 49 || checkY < 0 || checkY > 49) continue;
                    if (terrain.get(checkX, checkY) === TERRAIN_MASK_WALL) {
                        const dist = Math.max(Math.abs(dx), Math.abs(dy));
                        minDist = Math.min(minDist, dist);
                    }
                }
            }
            distanceMatrix.set(x, y, minDist);
        }
    }
    
    // Find position with good wall distance and reasonable access to controller/spawn
    let bestPos = null;
    let bestScore = 0;
    
    for (let x = 10; x < 40; x++) {
        for (let y = 10; y < 40; y++) {
            const wallDist = distanceMatrix.get(x, y);
            if (wallDist < 3) continue; // Need space for base
            
            const controllerDist = Math.max(Math.abs(x - controller.pos.x), Math.abs(y - controller.pos.y));
            const spawnDist = Math.max(Math.abs(x - spawn.pos.x), Math.abs(y - spawn.pos.y));
            
            // Score: prefer wall distance, penalize excessive distance from controller/spawn
            const score = wallDist * 2 - Math.min(controllerDist, 15) * 0.5 - Math.min(spawnDist, 10) * 0.3;
            
            if (score > bestScore) {
                bestScore = score;
                bestPos = { x, y };
            }
        }
    }
    
    return bestPos;
}

// Core stamp: Central area with key structures
function placeCoreStamp(room, anchor) {
    const coreStamp = [
        // Format: [dx, dy, structureType]
        [0, 0, STRUCTURE_STORAGE],     // Center
        [-1, -1, STRUCTURE_EXTENSION], [0, -1, STRUCTURE_EXTENSION], [1, -1, STRUCTURE_EXTENSION],
        [-1, 0, STRUCTURE_EXTENSION],                                    [1, 0, STRUCTURE_EXTENSION],
        [-1, 1, STRUCTURE_EXTENSION],  [0, 1, STRUCTURE_EXTENSION],  [1, 1, STRUCTURE_EXTENSION],
        // Secondary ring
        [-2, 0, STRUCTURE_TOWER],      [2, 0, STRUCTURE_TOWER],
        [0, -2, STRUCTURE_LINK],       [0, 2, STRUCTURE_TERMINAL]
    ];
    
    addStampToPlannedStructures(room, anchor, coreStamp);
}

// Extension field stamps: Groups of extensions with filler access
function placeExtensionFields(room, anchor) {
    const extensionStamp = [
        // 3x3 extension cluster
        [-1, -1, STRUCTURE_EXTENSION], [0, -1, STRUCTURE_EXTENSION], [1, -1, STRUCTURE_EXTENSION],
        [-1, 0, STRUCTURE_EXTENSION],  [0, 0, STRUCTURE_ROAD],       [1, 0, STRUCTURE_EXTENSION],
        [-1, 1, STRUCTURE_EXTENSION],  [0, 1, STRUCTURE_EXTENSION],  [1, 1, STRUCTURE_EXTENSION]
    ];
    
    // Place multiple extension fields around core
    const fieldPositions = [
        { x: anchor.x - 5, y: anchor.y - 5 },
        { x: anchor.x + 5, y: anchor.y - 5 },
        { x: anchor.x - 5, y: anchor.y + 5 },
        { x: anchor.x + 5, y: anchor.y + 5 }
    ];
    
    for (const fieldPos of fieldPositions) {
        if (isValidStampPosition(room, fieldPos, extensionStamp)) {
            addStampToPlannedStructures(room, fieldPos, extensionStamp);
        }
    }
}

// Source stamps: Container + access roads
function placeSourceStamp(room, source) {
    const sourceStamp = [
        [0, 0, STRUCTURE_CONTAINER]
    ];
    
    // Find best position adjacent to source
    const positions = [
        { x: source.pos.x - 1, y: source.pos.y },
        { x: source.pos.x + 1, y: source.pos.y },
        { x: source.pos.x, y: source.pos.y - 1 },
        { x: source.pos.x, y: source.pos.y + 1 }
    ];
    
    for (const pos of positions) {
        if (isValidStampPosition(room, pos, sourceStamp)) {
            addStampToPlannedStructures(room, pos, sourceStamp);
            break;
        }
    }
}

// Controller stamp: Container for upgraders
function placeControllerStamp(room, controller, anchor) {
    const controllerStamp = [
        [0, 0, STRUCTURE_CONTAINER]
    ];
    
    // Find position 2-3 tiles from controller, towards base
    const direction = {
        x: anchor.x > controller.pos.x ? 1 : -1,
        y: anchor.y > controller.pos.y ? 1 : -1
    };
    
    const containerPos = {
        x: controller.pos.x + direction.x * 2,
        y: controller.pos.y + direction.y * 2
    };
    
    if (isValidStampPosition(room, containerPos, controllerStamp)) {
        addStampToPlannedStructures(room, containerPos, controllerStamp);
    }
}

// Defense stamps: Towers with optimal coverage
function placeDefenseStamps(room, anchor) {
    const towerStamp = [
        [0, 0, STRUCTURE_TOWER]
    ];
    
    // Place towers at strategic positions around base
    const towerPositions = [
        { x: anchor.x - 3, y: anchor.y },
        { x: anchor.x + 3, y: anchor.y },
        { x: anchor.x, y: anchor.y - 3 },
        { x: anchor.x, y: anchor.y + 3 }
    ];
    
    for (const pos of towerPositions) {
        if (isValidStampPosition(room, pos, towerStamp)) {
            addStampToPlannedStructures(room, pos, towerStamp);
        }
    }
}

// Economy stamps: Storage, terminal, links
function placeEconomyStamps(room, anchor) {
    const economyStamp = [
        [0, 0, STRUCTURE_TERMINAL],
        [2, 0, STRUCTURE_LINK]
    ];
    
    const economyPos = { x: anchor.x + 4, y: anchor.y };
    if (isValidStampPosition(room, economyPos, economyStamp)) {
        addStampToPlannedStructures(room, economyPos, economyStamp);
    }
}

// Helper function: Check if stamp can be placed at position
function isValidStampPosition(room, anchor, stamp) {
    const terrain = new Room.Terrain(room.name);
    
    for (const [dx, dy, structureType] of stamp) {
        const x = anchor.x + dx;
        const y = anchor.y + dy;
        
        if (x < 2 || x > 47 || y < 2 || y > 47) return false;
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) return false;
        
        // Check for existing structures (except roads can overlap)
        const existing = room.lookForAt(LOOK_STRUCTURES, x, y);
        if (existing.length > 0 && structureType !== STRUCTURE_ROAD) return false;
    }
    
    return true;
}

// Helper function: Add stamp structures to planned list
function addStampToPlannedStructures(room, anchor, stamp) {
    for (const [dx, dy, structureType] of stamp) {
        room.memory.plannedStructures.push({
            x: anchor.x + dx,
            y: anchor.y + dy,
            type: structureType
        });
    }
}

// Smart road network planning
function planRoadNetwork(room, anchor, sources, controller) {
    // Connect sources to base
    for (const source of sources) {
        const path = PathFinder.search(source.pos, { pos: new RoomPosition(anchor.x, anchor.y, room.name), range: 2 }).path;
        addPathAsRoads(room, path);
    }
    
    // Connect base to controller
    const controllerPath = PathFinder.search(
        new RoomPosition(anchor.x, anchor.y, room.name),
        { pos: controller.pos, range: 3 }
    ).path;
    addPathAsRoads(room, controllerPath);
    
    // Connect extension fields to base
    const fieldPositions = [
        { x: anchor.x - 5, y: anchor.y - 5 },
        { x: anchor.x + 5, y: anchor.y - 5 },
        { x: anchor.x - 5, y: anchor.y + 5 },
        { x: anchor.x + 5, y: anchor.y + 5 }
    ];
    
    for (const fieldPos of fieldPositions) {
        const startPos = new RoomPosition(fieldPos.x, fieldPos.y, room.name);
        const path = PathFinder.search(
            startPos,
            { pos: new RoomPosition(anchor.x, anchor.y, room.name), range: 2 }
        ).path;
        addPathAsRoads(room, path);
    }
}

// Helper function: Add path positions as road structures
function addPathAsRoads(room, path) {
    for (let i = 1; i < path.length - 1; i += 2) { // Skip every other tile for efficiency
        const pos = path[i];
        const existing = room.memory.plannedStructures.find(s => s.x === pos.x && s.y === pos.y);
        if (!existing) {
            room.memory.plannedStructures.push({
                x: pos.x,
                y: pos.y,
                type: STRUCTURE_ROAD
            });
        }
    }
}

function generateHexId() {
    return Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
}

// Simplified population control based on room controller level
function spawnCreeps(spawn, creeps) {
    const room = spawn.room;
    const rcl = room.controller.level;
    const energyCapacity = room.energyCapacityAvailable;
    const energyAvailable = room.energyAvailable;
    
    // Hard-coded population targets based on RCL
    const populationTargets = getPopulationByRCL(rcl);
    const bodies = getBodiesByEnergyCapacity(energyCapacity);
    
    // Calculate body costs for debugging
    const bodyCosts = {
        miner: bodies.miner.reduce((cost, part) => cost + (part === WORK ? 100 : part === CARRY ? 50 : 50), 0),
        hauler: bodies.hauler.reduce((cost, part) => cost + (part === WORK ? 100 : part === CARRY ? 50 : 50), 0),
        upgrader: bodies.upgrader.reduce((cost, part) => cost + (part === WORK ? 100 : part === CARRY ? 50 : 50), 0),
        builder: bodies.builder.reduce((cost, part) => cost + (part === WORK ? 100 : part === CARRY ? 50 : 50), 0)
    };
    
    console.log(`RCL ${rcl}: Energy ${energyAvailable}/${energyCapacity}, Costs: M:${bodyCosts.miner} H:${bodyCosts.hauler} U:${bodyCosts.upgrader} B:${bodyCosts.builder}`);
    
    // Simple spawn priority: miner > hauler > upgrader > builder
    if (creeps.miner.length < populationTargets.miner) {
        if (spawn.canCreateCreep(bodies.miner) === OK) {
            const name = 'mine:' + generateHexId();
            spawn.createCreep(bodies.miner, name, { role: 'miner' });
            console.log(`Spawning miner (${creeps.miner.length + 1}/${populationTargets.miner})`);
            return;
        } else {
            console.log(`Cannot spawn miner - need ${bodies.miner.length * 50} energy, have ${spawn.room.energyAvailable}/${energyCapacity}`);
        }
    }
    const popData = room.memory.populationData;
    
    if (creeps.hauler.length < populationTargets.hauler) {
        if (spawn.canCreateCreep(bodies.hauler) === OK) {
            const name = 'haul:' + generateHexId();
            spawn.createCreep(bodies.hauler, name, { role: 'hauler' });
            console.log(`Spawning hauler (${creeps.hauler.length + 1}/${populationTargets.hauler})`);
            return;
        }
    }
    
    if (creeps.upgrader.length < populationTargets.upgrader) {
        if (spawn.canCreateCreep(bodies.upgrader) === OK) {
            const name = 'upgr:' + generateHexId();
            spawn.createCreep(bodies.upgrader, name, { role: 'upgrader' });
            console.log(`Spawning upgrader (${creeps.upgrader.length + 1}/${populationTargets.upgrader})`);
            return;
        }
    }
    
    if (creeps.builder.length < populationTargets.builder) {
        if (spawn.canCreateCreep(bodies.builder) === OK) {
            const name = 'bldr:' + generateHexId();
            spawn.createCreep(bodies.builder, name, { role: 'builder' });
            console.log(`Spawning builder (${creeps.builder.length + 1}/${populationTargets.builder})`);
            return;
        }
    }
}

// Hard-coded population targets by RCL
function getPopulationByRCL(rcl) {
    switch (rcl) {
        case 1:
            return { miner: 1, hauler: 1, upgrader: 1, builder: 2 };
        case 2:
            return { miner: 2, hauler: 3, upgrader: 2, builder: 4 };
        case 3:
            return { miner: 2, hauler: 4, upgrader: 2, builder: 4 };
        case 4:
            return { miner: 2, hauler: 4, upgrader: 3, builder: 3 };
        case 5:
            return { miner: 2, hauler: 4, upgrader: 4, builder: 3 };
        case 6:
            return { miner: 2, hauler: 4, upgrader: 4, builder: 2 };
        case 7:
            return { miner: 2, hauler: 4, upgrader: 5, builder: 2 };
        case 8:
            return { miner: 2, hauler: 3, upgrader: 6, builder: 2 };
        default:
            return { miner: 2, hauler: 1, upgrader: 1, builder: 1 };
    }
}

// Hard-coded body configurations by energy capacity
function getBodiesByEnergyCapacity(energyCapacity) {
    if (energyCapacity >= 1800) { // RCL 6+
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE], // 8C4M
            upgrader: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], // 3W2C3M
            builder: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE] // 3W2C3M
        };
    } else if (energyCapacity >= 1300) { // RCL 5
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], // 6C3M
            upgrader: [WORK, WORK, CARRY, CARRY, MOVE, MOVE], // 2W2C2M
            builder: [WORK, WORK, CARRY, CARRY, MOVE, MOVE] // 2W2C2M
        };
    } else if (energyCapacity >= 800) { // RCL 4
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE], // 4C2M
            upgrader: [WORK, WORK, CARRY, MOVE], // 2W1C1M
            builder: [WORK, WORK, CARRY, MOVE] // 2W1C1M
        };
    } else if (energyCapacity >= 550) { // RCL 3
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: [CARRY, CARRY, CARRY, CARRY, MOVE], // 4C1M
            upgrader: [WORK, CARRY, MOVE], // 1W1C1M
            builder: [WORK, CARRY, MOVE] // 1W1C1M
        };
    } else { // RCL 1-2
        return {
            miner: [WORK, WORK, MOVE], // 2W1M - only 250 energy
            hauler: [CARRY, CARRY, MOVE], // 2C1M
            upgrader: [WORK, CARRY, MOVE], // 1W1C1M
            builder: [WORK, CARRY, MOVE] // 1W1C1M
        };
    }
}

// Create construction sites for planned structures that don't exist
function createMissingConstructionSites(room) {
    if (!room.memory.plannedStructures) return;
    
    // Limit construction sites to avoid spam
    const existingConstructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
    if (existingConstructionSites >= 5) return; // Max 5 construction sites at once
    
    let created = 0;
    for (const planned of room.memory.plannedStructures) {
        if (created >= 3) break; // Create max 3 per tick to avoid CPU spike
        
        const pos = new RoomPosition(planned.x, planned.y, room.name);
        const structures = pos.lookFor(LOOK_STRUCTURES);
        const constructionSites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
        
        // Check if structure or construction site already exists
        const hasStructure = structures.some(s => s.structureType === planned.type);
        const hasConstructionSite = constructionSites.some(c => c.structureType === planned.type);
        
        if (!hasStructure && !hasConstructionSite) {
            const result = room.createConstructionSite(pos.x, pos.y, planned.type);
            if (result === OK) {
                console.log(`Created construction site for ${planned.type} at ${pos.x},${pos.y}`);
                created++;
            } else if (result !== ERR_FULL && result !== ERR_INVALID_TARGET) {
                console.log(`Failed to create construction site for ${planned.type}: ${result}`);
            }
        }
    }
}

function runCreep(creep) {
    switch (creep.memory.role) {
        case 'miner':
            runMiner(creep);
            break;
        case 'hauler':
            runHauler(creep);
            break;
        case 'upgrader':
            runUpgrader(creep);
            break;
        case 'builder':
            runBuilder(creep);
            break;
    }
}

function runMiner(creep) {
    // Miners are parked on containers and just harvest continuously
    // Find assigned source or assign a new one
    let source = null;
    if (creep.memory.sourceId) {
        source = Game.getObjectById(creep.memory.sourceId);
    }
    
    if (!source) {
        // Assign to a source that doesn't have a dedicated miner
        const sources = creep.room.find(FIND_SOURCES);
        const miners = _.filter(Game.creeps, c => c.memory.role === 'miner' && c.name !== creep.name);
        const assignedSources = miners.map(m => m.memory.sourceId).filter(id => id);
        
        // Find an unassigned source
        for (const s of sources) {
            if (!assignedSources.includes(s.id)) {
                source = s;
                creep.memory.sourceId = s.id;
                console.log(`${creep.name} assigned to source ${s.id}`);
                break;
            }
        }
        
        // If all sources are assigned, this shouldn't happen with proper population control
        if (!source && sources.length > 0) {
            // Assign to closest source as fallback, but log warning
            source = creep.pos.findClosestByPath(sources);
            creep.memory.sourceId = source.id;
            console.log(`WARNING: ${creep.name} forced to share source ${source.id} - check population targets`);
        }
    }
  
    if (!source) return;
    
    // Find container near this source
    const container = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            return structure.structureType === STRUCTURE_CONTAINER &&
                   structure.pos.getRangeTo(source) <= 2;
        }
    })[0];
}

function countMissingStructures(room) {
    if (!room.memory.plannedStructures) return 0;
    
    if (container) {
        // Move to container position and stay there
        if (creep.pos.isEqualTo(container.pos)) {
            // We're on the container, just harvest
            const harvestResult = creep.harvest(source);
            if (harvestResult === ERR_NOT_IN_RANGE) {
                // Container is not adjacent to source, this shouldn't happen
                console.log(`Container not adjacent to source ${source.id}`);
            }
        } else {
            // Move to container
            creep.moveTo(container.pos, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
    } else {
        // No container yet, move to source and harvest normally
        // If creep is full, move away from source to drop energy for haulers
        if (creep.store.getFreeCapacity() === 0) {
            // Move one step away from source so haulers can pick up dropped energy
            const adjacentPos = creep.room.lookForAtArea(LOOK_TERRAIN, 
                source.pos.y - 1, source.pos.x - 1, 
                source.pos.y + 1, source.pos.x + 1, true)
                .filter(pos => pos.terrain !== 'wall' && 
                       (pos.x !== source.pos.x || pos.y !== source.pos.y))
                .sort((a, b) => creep.pos.getRangeTo(a.x, a.y) - creep.pos.getRangeTo(b.x, b.y))[0];
            
            if (adjacentPos && !creep.pos.isEqualTo(adjacentPos.x, adjacentPos.y)) {
                creep.moveTo(adjacentPos.x, adjacentPos.y, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        } else {
            // Harvest normally
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    }
}

function runHauler(creep) {
    // Haulers move energy from source containers to spawn/extensions/storage
    
    // If carrying energy, find a sink to deliver to
    if (creep.store[RESOURCE_ENERGY] > 0) {
        const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
        
        // Find all potential targets
        const spawnTargets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_SPAWN ||
                        structure.structureType === STRUCTURE_TOWER) &&
                       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        
        // Find source positions to identify source containers
        const sources = creep.room.find(FIND_SOURCES);
        
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                if (structure.structureType !== STRUCTURE_CONTAINER || structure.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
                    return false;
                }
                // Don't deliver to source containers (they are for pickup only)
                for (const source of sources) {
                    if (structure.pos.getRangeTo(source) <= 2) {
                        return false; // This is a source container, skip it
                    }
                }
                return true; // This is a non-source container (like near spawn)
            }
        });
        
        const storage = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return structure.structureType === STRUCTURE_STORAGE &&
                       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });

        let target = null;
        
        // Priority 1: Spawn/Extensions/Towers
        if (spawnTargets.length > 0) {
            target = creep.pos.findClosestByPath(spawnTargets);
        }
        // Priority 2: Non-source containers (like near spawn for upgraders/builders)
        else if (containers.length > 0) {
            target = creep.pos.findClosestByPath(containers);
        }
        // Priority 3: Storage
        else if (storage.length > 0) {
            target = creep.pos.findClosestByPath(storage);
        }
        
        if (target) {
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    } else {
        // Pick up energy from source containers or dropped energy
        const sources = creep.room.find(FIND_SOURCES);
        
        // First try to find source containers with energy
        const sourceContainers = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                if (structure.structureType !== STRUCTURE_CONTAINER || structure.store[RESOURCE_ENERGY] <= 0) {
                    return false;
                }
                // Only pick up from source containers
                for (const source of sources) {
                    if (structure.pos.getRangeTo(source) <= 2) {
                        return true; // This is a source container
                    }
                }
                return false; // This is not a source container
            }
        });

        if (sourceContainers.length > 0) {
            // Distribute haulers evenly across source containers instead of all going to closest
            let target = null;
            
            // Check if hauler has an assigned source
            if (creep.memory.assignedSource) {
                const assignedContainer = sourceContainers.find(container => {
                    const assignedSource = Game.getObjectById(creep.memory.assignedSource);
                    return assignedSource && container.pos.getRangeTo(assignedSource) <= 2;
                });
                
                if (assignedContainer && assignedContainer.store[RESOURCE_ENERGY] > 0) {
                    target = assignedContainer;
                } else {
                    // Assigned source container is empty, clear assignment to find a new one
                    delete creep.memory.assignedSource;
                }
            }
            
            // If no assignment or assigned container is empty, find best source to assign
            if (!target) {
                // Count haulers assigned to each source
                const haulers = _.filter(Game.creeps, c => c.memory.role === 'hauler' && c.name !== creep.name);
                const sourceAssignments = {};
                
                for (const source of sources) {
                    sourceAssignments[source.id] = haulers.filter(h => h.memory.assignedSource === source.id).length;
                }
                
                // Find source with least haulers assigned and available energy
                let bestSource = null;
                let leastAssigned = 999;
                
                for (const container of sourceContainers) {
                    for (const source of sources) {
                        if (container.pos.getRangeTo(source) <= 2) {
                            const assignedCount = sourceAssignments[source.id] || 0;
                            if (assignedCount < leastAssigned) {
                                leastAssigned = assignedCount;
                                bestSource = source;
                                target = container;
                            }
                        }
                    }
                }
                
                if (bestSource) {
                    creep.memory.assignedSource = bestSource.id;
                    console.log(`${creep.name} assigned to source ${bestSource.id} (${leastAssigned + 1} haulers on this source)`);
                }
            }
            
            if (target) {
                if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            }
        } else {
            // No source containers yet, look for dropped energy near sources
            const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
                filter: (resource) => {
                    return resource.resourceType === RESOURCE_ENERGY && resource.amount >= 50;
                }
            });
            
            if (droppedEnergy.length > 0) {
                // Distribute haulers across dropped energy sources too
                let target = null;
                
                if (creep.memory.assignedSource) {
                    const assignedSource = Game.getObjectById(creep.memory.assignedSource);
                    if (assignedSource) {
                        // Look for dropped energy near assigned source
                        target = droppedEnergy.find(drop => drop.pos.getRangeTo(assignedSource) <= 3);
                    }
                }
                
                if (!target) {
                    target = creep.pos.findClosestByPath(droppedEnergy);
                }
                
                if (target && creep.pickup(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            } else {
                // No energy available, move to assigned source or closest source to wait
                let waitTarget = null;
                
                if (creep.memory.assignedSource) {
                    waitTarget = Game.getObjectById(creep.memory.assignedSource);
                }
                
                if (!waitTarget) {
                    waitTarget = creep.pos.findClosestByPath(sources);
                }
                
                if (waitTarget && creep.pos.getRangeTo(waitTarget) > 3) {
                    creep.moveTo(waitTarget, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            }
        }
    }
}

// Helper function: Get distributed container for energy pickup
function getDistributedEnergyContainer(creep, targets) {
    if (targets.length === 0) return null;
    
    const sources = creep.room.find(FIND_SOURCES);
    const sourceContainers = targets.filter(container => {
        return sources.some(source => container.pos.getRangeTo(source) <= 2);
    });
    const nonSourceContainers = targets.filter(container => {
        return !sources.some(source => container.pos.getRangeTo(source) <= 2);
    });
    
    // Prefer non-source containers (storage, spawn area containers) first
    if (nonSourceContainers.length > 0) {
        return creep.pos.findClosestByPath(nonSourceContainers);
    }
    
    // If only source containers available, use distribution logic
    if (sourceContainers.length > 0) {
        // Check if creep has an assigned source
        if (creep.memory.assignedSource) {
            const assignedContainer = sourceContainers.find(container => {
                const assignedSource = Game.getObjectById(creep.memory.assignedSource);
                return assignedSource && container.pos.getRangeTo(assignedSource) <= 2;
            });
            
            if (assignedContainer && assignedContainer.store[RESOURCE_ENERGY] > 0) {
                return assignedContainer;
            } else {
                // Assigned source container is empty, clear assignment
                delete creep.memory.assignedSource;
            }
        }
        
        // Find source with least assigned creeps of this role
        const sameRoleCreeps = _.filter(Game.creeps, c => c.memory.role === creep.memory.role && c.name !== creep.name);
        const sourceAssignments = {};
        
        for (const source of sources) {
            sourceAssignments[source.id] = sameRoleCreeps.filter(c => c.memory.assignedSource === source.id).length;
        }
        
        let bestSource = null;
        let leastAssigned = 999;
        let bestContainer = null;
        
        for (const container of sourceContainers) {
            for (const source of sources) {
                if (container.pos.getRangeTo(source) <= 2) {
                    const assignedCount = sourceAssignments[source.id] || 0;
                    if (assignedCount < leastAssigned) {
                        leastAssigned = assignedCount;
                        bestSource = source;
                        bestContainer = container;
                    }
                }
            }
        }
        
        if (bestSource) {
            creep.memory.assignedSource = bestSource.id;
            console.log(`${creep.name} (${creep.memory.role}) assigned to source ${bestSource.id}`);
        }
        
        return bestContainer;
    }
    
    return null;
}

function runUpgrader(creep) {
    // Always prioritize upgrading the controller
    if (creep.store[RESOURCE_ENERGY] > 0) {
        const controller = creep.room.controller;
        if (!controller) {
            console.log(`No controller found in room ${creep.room.name}`);
            return;
        }
        const upgradeResult = creep.upgradeController(controller);
        if (upgradeResult === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller.pos, { visualizePathStyle: { stroke: '#ffffff' } });
        } else if (upgradeResult !== OK) {
            console.log(`Upgrade error: ${upgradeResult} for creep ${creep.name}`);
        }
    } else {
        // Get energy from containers or storage only (spawn/extensions reserved for spawning)
        const targets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_CONTAINER ||
                        structure.structureType === STRUCTURE_STORAGE) &&
                       structure.store[RESOURCE_ENERGY] > 0;
            }
        });
        
        if (targets.length > 0) {
            // Use distributed container selection for balanced source usage
            const target = getDistributedEnergyContainer(creep, targets);
            
            if (target) {
                const withdrawResult = creep.withdraw(target, RESOURCE_ENERGY);
                if (withdrawResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                } else if (withdrawResult !== OK && withdrawResult !== ERR_NOT_ENOUGH_RESOURCES) {
                    console.log(`Upgrader withdraw error: ${withdrawResult}`);
                }
            }
        } else {
            // No energy sources available, look for dropped energy as fallback
            const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
                filter: (resource) => {
                    return resource.resourceType === RESOURCE_ENERGY && resource.amount >= 50;
                }
            });
            
            if (droppedEnergy.length > 0) {
                const target = creep.pos.findClosestByPath(droppedEnergy);
                if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            } else {
                // No energy sources available, wait near controller
                const controller = creep.room.controller;
                if (controller && creep.pos.getRangeTo(controller) > 3) {
                    creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            }
        }
    }
}

function runBuilder(creep) {
    // If creep has energy, build things
    if (creep.store[RESOURCE_ENERGY] > 0) {
        let target = null;
        
        // Check if we have an assigned construction site
        if (creep.memory.buildTarget) {
            target = Game.getObjectById(creep.memory.buildTarget);
            // If the target no longer exists (completed or destroyed), clear assignment
            if (!target) {
                delete creep.memory.buildTarget;
            }
        }
        
        // If no assigned target, find a new one
        if (!target) {
            const targets = creep.room.find(FIND_CONSTRUCTION_SITES);
            if (targets.length > 0) {
                target = creep.pos.findClosestByPath(targets);
                if (target) {
                    creep.memory.buildTarget = target.id;
                    console.log(`${creep.name} assigned to build ${target.structureType} at ${target.pos.x},${target.pos.y}`);
                }
            }
        }
        
        if (target) {
            const buildResult = creep.build(target);
            if (buildResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            } else if (buildResult === OK) {
                // Log progress occasionally
                if (Game.time % 10 === 0) {
                    console.log(`${creep.name} building ${target.structureType} - ${target.progress}/${target.progressTotal}`);
                }
            } else if (buildResult !== OK) {
                console.log(`Build error: ${buildResult} for creep ${creep.name}`);
                // Clear assignment on error to try a different site
                delete creep.memory.buildTarget;
            }
        } else {
            // No construction sites, help upgrade controller
            const controller = creep.room.controller;
            if (controller) {
                const upgradeResult = creep.upgradeController(controller);
                if (upgradeResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller.pos, { visualizePathStyle: { stroke: '#ffffff' } });
                } else if (upgradeResult !== OK && upgradeResult !== ERR_NOT_ENOUGH_RESOURCES) {
                    console.log(`Builder upgrade error: ${upgradeResult} for creep ${creep.name}`);
                }
            }
        }
    } else {
        // Get energy from containers or storage only (spawn/extensions reserved for spawning)
        const targets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_CONTAINER ||
                        structure.structureType === STRUCTURE_STORAGE) &&
                       structure.store[RESOURCE_ENERGY] > 0;
            }
        });
        
        if (targets.length > 0) {
            // Use distributed container selection for balanced source usage
            const target = getDistributedEnergyContainer(creep, targets);
            
            if (target) {
                const withdrawResult = creep.withdraw(target, RESOURCE_ENERGY);
                if (withdrawResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                } else if (withdrawResult !== OK && withdrawResult !== ERR_NOT_ENOUGH_RESOURCES) {
                    console.log(`Builder withdraw error: ${withdrawResult}`);
                }
            }
        } else {
            // No energy sources available, look for dropped energy as fallback
            const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
                filter: (resource) => {
                    return resource.resourceType === RESOURCE_ENERGY && resource.amount >= 50;
                }
            });
            
            if (droppedEnergy.length > 0) {
                const target = creep.pos.findClosestByPath(droppedEnergy);
                if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            } else {
                // No energy sources available, wait near construction sites or controller
                const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
                if (constructionSites.length > 0) {
                    const target = creep.pos.findClosestByPath(constructionSites);
                    if (target && creep.pos.getRangeTo(target) > 3) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                } else {
                    const controller = creep.room.controller;
                    if (controller && creep.pos.getRangeTo(controller) > 3) {
                        creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                }
            }
        }
    }
}

function manageCPUForPixels() {
    const cpuUsed = Game.cpu.getUsed();
    const cpuLimit = Game.cpu.limit;
    const cpuBucket = Game.cpu.bucket;
    
    // Check if generatePixel function is available (not available on local servers)
    if (typeof Game.cpu.generatePixel === 'function') {
        // Direct Pixel generation strategy
        if (cpuBucket >= 10000) {
            // We have enough CPU in bucket to generate a Pixel
            const result = Game.cpu.generatePixel();
            if (result === OK) {
                console.log(`🎯 PIXEL GENERATED! Bucket: ${cpuBucket} → ${Game.cpu.bucket}, Pixels: ${Game.resources['pixel'] || 0}`);
            } else {
                console.log(`❌ Failed to generate Pixel: ${result}`);
            }
        } else if (cpuBucket >= 8000) {
            // Close to earning a Pixel, start preparing
            console.log(`⚡ Preparing for Pixel: Bucket ${cpuBucket}/10000`);
        }
        
        // Log Pixel status every 100 ticks
        if (Game.time % 100 === 0) {
            console.log(`CPU: ${cpuUsed.toFixed(2)}/${cpuLimit}, Bucket: ${cpuBucket}, Pixels: ${Game.resources['pixel'] || 0}`);
        }
    } else {
        // Local server mode - just log CPU usage without Pixel generation
        if (Game.time % 100 === 0) {
            console.log(`CPU: ${cpuUsed.toFixed(2)}/${cpuLimit}, Bucket: ${cpuBucket} (Local Server - No Pixel Generation)`);
        }
    }
}
