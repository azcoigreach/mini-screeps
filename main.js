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

// Configuration Constants
const VISUALIZE_BASE = true; // Set to false to disable base plan visualization

// Edge defense configuration
// Depth (tiles into the room) for the curtain line; overhang tiles each side beyond the entrance span
const ENTRANCE_CURTAIN_DEPTH = 2;
const ENTRANCE_OVERHANG_TILES = 2; // curtain and book-ends extend this many tiles beyond the entrance ends

// Wall and rampart maintenance configuration - hit points by RCL
const WALL_TARGET_HITS = {
    1: 1000,        // RCL 1: Basic protection (1K hits)
    2: 10000,       // RCL 2: Light fortification (10K hits)
    3: 30000,       // RCL 3: Medium fortification (30K hits)
    4: 100000,      // RCL 4: Strong fortification (100K hits)
    5: 300000,      // RCL 5: Strong fortification (300K hits)
    6: 1000000,     // RCL 6: Strong fortification (1M hits)
    7: 3000000,     // RCL 7: Strong fortification (3M hits)
    8: 10000000     // RCL 8: Strong fortification (10M hits)
};

// Ramparts use the same hit point targets as walls
// Rampart targets: separate mapping so ramparts can be tuned independently from walls.
// By default we mirror wall targets for higher RCLs but keep lower targets for early levels
// to avoid over-investing into ramparts (especially at RCL 3 where walls jump to 30k).
const RAMPART_TARGET_HITS = {
    1: 1000,
    2: 10000,
    3: 30000,
    4: 100000,
    5: 300000,
    6: 1000000,
    7: 3000000,
    8: 10000000
};

// Container repair configuration: builders will prioritize repairing containers
// if their hits are below this absolute threshold OR below this percentage of max hits
const CONTAINER_REPAIR_THRESHOLD = 20000; // absolute hits threshold
const CONTAINER_REPAIR_PERCENT = 0.5; // repair if below 50% of hitsMax

// Tower refill threshold: haulers will only refill towers when their energy
// is below this fraction of capacity, or when hostiles are present.
const TOWER_REFILL_THRESHOLD = 0.5; // 50%

// Creep recycling configuration
const CREEP_RECYCLE_TTL = 50; // Recycle creeps when they have this many ticks left

// Emergency mode thresholds
const EMERGENCY_ENERGY_THRESHOLD = 300; // Spawn emergency creeps if energy is this low
const CONTROLLER_DOWNGRADE_EMERGENCY = 5000; // Emergency if controller downgrade is this close

/**
 * Initialize remote room memory structure
 */
function initializeRemoteMemory() {
    if (!Memory.remote) {
        Memory.remote = {
            rooms: {},          // Tracked remote rooms
            scoutQueue: [],     // Rooms to scout
            lastScout: 0        // Last scout tick
        };
    }
}

/**
 * Get adjacent room names from a given room name
 * E.g., "E5N5" returns ["E4N4", "E4N5", "E4N6", "E5N4", "E5N6", "E6N4", "E6N5", "E6N6"]
 */
function getAdjacentRoomNames(roomName) {
    const parsed = /^([WE])(\d+)([NS])(\d+)$/.exec(roomName);
    if (!parsed) return [];
    
    const [, ew, x, ns, y] = parsed;
    const xNum = parseInt(x);
    const yNum = parseInt(y);
    
    const adjacentRooms = [];
    
    // Generate all 8 adjacent room names
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue; // Skip current room
            
            let newX = xNum + (ew === 'E' ? dx : -dx);
            let newY = yNum + (ns === 'N' ? dy : -dy);
            let newEW = ew;
            let newNS = ns;
            
            // Handle coordinate wraparound at 0
            if (newX < 0) {
                newX = Math.abs(newX) - 1;
                newEW = (ew === 'E') ? 'W' : 'E';
            }
            if (newY < 0) {
                newY = Math.abs(newY) - 1;
                newNS = (ns === 'N') ? 'S' : 'N';
            }
            
            adjacentRooms.push(`${newEW}${newX}${newNS}${newY}`);
        }
    }
    
    return adjacentRooms;
}

/**
 * Get list of active remote rooms
 */
function getActiveRemoteRooms() {
    initializeRemoteMemory();
    
    return Object.keys(Memory.remote.rooms)
        .filter(roomName => Memory.remote.rooms[roomName].active)
        .map(roomName => ({
            name: roomName,
            ...Memory.remote.rooms[roomName]
        }));
}

/**
 * Scout adjacent rooms and evaluate them for remote harvesting
 */
function scoutAdjacentRooms(homeRoom) {
    initializeRemoteMemory();
    
    const rcl = homeRoom.controller.level;
    
    // Only start scouting at RCL 4 (when we can make reservers)
    if (rcl < 4) return;
    
    // Scout every 100 ticks
    if (Game.time - Memory.remote.lastScout < 100) return;
    
    Memory.remote.lastScout = Game.time;
    
    console.log(`🔍 Remote harvesting scouting system active (RCL ${rcl})`);
    
    // TODO: Full implementation will be moved from later in the file
    // For now, just ensure the function exists to prevent ReferenceError
}

/**
 * Update remote room information (reservation status, threats, etc.)
 */
function updateRemoteRoomInfo(roomName) {
    const room = Game.rooms[roomName];
    if (!room || !Memory.remote.rooms[roomName]) return;
    
    const remoteData = Memory.remote.rooms[roomName];
    
    // Update reservation status
    if (room.controller && room.controller.reservation) {
        remoteData.reservation = {
            username: room.controller.reservation.username,
            ticksToEnd: room.controller.reservation.ticksToEnd
        };
    } else {
        remoteData.reservation = null;
    }
    
    // Check for threats
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    const invaderCores = room.find(FIND_HOSTILE_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_INVADER_CORE
    });
    
    remoteData.threats = hostiles.length + invaderCores.length;
    remoteData.lastUpdate = Game.time;
    
    // Update source info if not already set
    if (!remoteData.sourceIds) {
        const sources = room.find(FIND_SOURCES);
        remoteData.sourceIds = sources.map(s => s.id);
    }
}

module.exports.loop = function () {
    // Clean up memory
    for (const name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }

    // Store our username for remote room tracking
    if (!Memory.username && Object.keys(Game.spawns).length > 0) {
        const spawn = Game.spawns[Object.keys(Game.spawns)[0]];
        if (spawn && spawn.owner) {
            Memory.username = spawn.owner.username;
        }
    }

    // Get the spawn and room
    const spawn = Game.spawns[Object.keys(Game.spawns)[0]];
    if (!spawn) return;
    
    const room = spawn.room;
    const sources = room.find(FIND_SOURCES);
    
    // Cache structure lookups every 10 ticks for CPU optimization
    if (!room._structureCache || Game.time % 10 === 0) {
        room._structureCache = {
            containers: room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            }),
            storage: room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_STORAGE
            })[0],
            terminal: room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TERMINAL
            })[0],
            towers: room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER
            }),
            links: room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_LINK
            }),
            roads: room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_ROAD
            })
        };
    }
    
    // Count creeps by role
    const creeps = {
        miner: _.filter(Game.creeps, creep => creep.memory.role === 'miner'),
        hauler: _.filter(Game.creeps, creep => creep.memory.role === 'hauler'),
        upgrader: _.filter(Game.creeps, creep => creep.memory.role === 'upgrader'),
        builder: _.filter(Game.creeps, creep => creep.memory.role === 'builder'),
        scout: _.filter(Game.creeps, creep => creep.memory.role === 'scout'),
        reserver: _.filter(Game.creeps, creep => creep.memory.role === 'reserver'),
        remoteMiner: _.filter(Game.creeps, creep => creep.memory.role === 'remoteMiner'),
        remoteBuilder: _.filter(Game.creeps, creep => creep.memory.role === 'remoteBuilder')
    };

    // Check for emergency situations
    const emergency = detectEmergency(room, creeps);
    if (emergency.isEmergency && Game.time % 10 === 0) {
        console.log(`🚨 EMERGENCY MODE: ${emergency.reason}`);
    }

    // Plan base layout once
    if (!room.memory.basePlanned) {
        // Set flag immediately to prevent multiple executions
        room.memory.basePlanned = true;
        planBase(room);
        
        // Create initial defensive structures immediately to ensure they get built
        // (other structures can wait for regular construction cycle)
        createInitialDefensiveStructures(room);
    }

    // Create construction sites less frequently - only every 20 ticks instead of 5
    if (Game.time % 20 === 0) {
        createMissingConstructionSites(room);
    }

    // Manage wall hit points less frequently
    if (Game.time % 50 === 0) {
        manageDefenseHitPoints(room);
    }

    // Clean up shared construction target less frequently
    if (Game.time % 20 === 0) {
        cleanupSharedConstructionTarget(room);
    }
    
    // Clean up memory for built structures every 100 ticks
    if (Game.time % 100 === 0) {
        cleanupBuiltStructures(room);
    }

    // Spawn creeps based on needs
    spawnCreeps(spawn, creeps, sources, emergency);

    // Display clean status dashboard every 20 ticks
    if (Game.time % 20 === 0) {
        displayStatusDashboard(room, creeps);
    }

    // Scout and manage remote rooms (v1.2)
    scoutAdjacentRooms(room);
    
    // Update remote room info and plan infrastructure if we have vision
    const activeRemoteRooms = getActiveRemoteRooms();
    for (const remoteRoom of activeRemoteRooms) {
        if (Game.rooms[remoteRoom.name]) {
            updateRemoteRoomInfo(remoteRoom.name);
            
            // Plan infrastructure every 50 ticks
            if (Game.time % 50 === 0) {
                planRemoteRoomInfrastructure(remoteRoom.name, room.name);
            }
        }
    }

    // Run creep logic
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        
        // Check if creep should be recycled
        if (shouldRecycleCreep(creep, room)) {
            recycleCreep(creep, spawn);
            continue; // Skip normal behavior
        }
        
        runCreep(creep);
    }

    // Run link transfer logic
    if (room._structureCache.links.length > 0 && Game.time % 5 === 0) {
        runLinks(room);
    }

    // Run tower defense and repair
    runTowers(room);

    // Visualize base plan every tick for debugging (toggle with VISUALIZE_BASE constant)
    if (room.memory.basePlanned && VISUALIZE_BASE) {
        visualizeBasePlan(room);
    }
    
    // REMOVED: Force redistribution of unassigned creeps
    // This is now handled during spawn with source assignment

    // CPU management for Pixel earning
    manageCPUForPixels();
}

function planBase(room) {
    const controller = room.controller;
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const sources = room.find(FIND_SOURCES);
    
    // Initialize base planning storage - only if not already initialized
    if (!room.memory.plannedStructures) {
        room.memory.plannedStructures = [];
    }
    if (!room.memory.baseCenter) {
        room.memory.baseCenter = null;
    }
    
    // Find best anchor position using distance transform
    const anchor = findOptimalAnchor(room, controller, spawn);
    if (!anchor) {
        console.log(`Failed to find suitable anchor position in room ${room.name}`);
        return;
    }
    
    room.memory.baseCenter = { x: anchor.x, y: anchor.y };
    console.log(`Base anchor positioned at ${anchor.x},${anchor.y}`);
    
    // Place core stamp (spawn area + extensions)
    placeCoreStamp(room, spawn);
    console.log(`🟡 Core stamp placed. Planned structures: ${room.memory.plannedStructures.length}`);
    
    // Place source stamps (containers + roads)
    for (const source of sources) {
        placeSourceStamp(room, source);
        console.log(`🟢 Source stamp placed for source ${source.id}. Planned structures: ${room.memory.plannedStructures.length}`);
    }
    
    // Place controller stamp (container + roads)
    placeControllerStamp(room, controller, anchor);
    console.log(`🔵 Controller stamp placed. Planned structures: ${room.memory.plannedStructures.length}`);
    
    // Always plan extension fields near spawn, regardless of RCL
    console.log(`🟦 Planning extensions near spawn (future-proof, not gated by RCL)...`);
    placeExtensionFieldsOptimal(room, spawn);
    console.log(`🟣 Extension fields placed. Planned structures: ${room.memory.plannedStructures.length}`);
    
    // Always plan tower clusters for better defense coverage, regardless of RCL
    placeDefenseStampsOptimal(room, spawn);
    console.log(`🧡 Defense stamps placed. Planned structures: ${room.memory.plannedStructures.length}`);
        
    // Connect everything with roads
    planRoadNetwork(room, anchor, sources, controller);
    console.log(`🛣️ Road network planned. Planned structures: ${room.memory.plannedStructures.length}`);
    
    // Place minimal bookend walls - just 2 walls per entrance at the endpoints
    // This strategy places walls only at the ends of each passable span, allowing
    // enemies to enter but significantly restricting their movement options
    const edgeSealPlan = planMinimalEdgeSeal(room);
    buildPlannedEdgeSeal(room, edgeSealPlan);
    console.log(`🧱 Bookend walls planned. Planned structures: ${room.memory.plannedStructures.length}`);

    // Add an interior "curtain" line 2 tiles inside the room across each entrance
    // with a single center rampart as a friendly gate.
    const entranceCurtainPlan = planEntranceCurtains(room);
    buildEntranceCurtains(room, entranceCurtainPlan);
    console.log(`🟤 Entrance curtains planned. Planned structures: ${room.memory.plannedStructures.length}`);
    
    console.log(`Base planned with ${room.memory.plannedStructures.length} structures`);
    
    // Debug: Count planned defensive structures
    const wallsPlanned = room.memory.plannedStructures.filter(s => s.type === STRUCTURE_WALL).length;
    const rampartsPlanned = room.memory.plannedStructures.filter(s => s.type === STRUCTURE_RAMPART).length;
    if (wallsPlanned > 0 || rampartsPlanned > 0) {
        console.log(`🛡️ Planned defenses: ${wallsPlanned} walls, ${rampartsPlanned} ramparts`);
    }
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
function placeCoreStamp(room, spawn) {
    // Place core structures around spawn
    const anchor = { x: spawn.pos.x, y: spawn.pos.y }; // Anchor to the spawn position
    const coreStamp = [
        // === NON-ROAD STRUCTURES FIRST (to prevent roads underneath) ===
        
        // CENTER: SPAWN (anchor point)
        [0, 0, STRUCTURE_SPAWN],       // Spawn at center (anchor)
        
        // ADDITIONAL SPAWNS (RCL 7 and 8)
        [-1, -2, STRUCTURE_SPAWN],     // 2nd spawn at RCL 7 (northwest)
        [1, 2, STRUCTURE_SPAWN],       // 3rd spawn at RCL 8 (southeast)
        
        // 5 Extensions in plus pattern - moved left to utilize expanded space
        [-3, -1, STRUCTURE_EXTENSION], // Top extension
        [-4, 0, STRUCTURE_EXTENSION],  // Left extension  
        [-3, 0, STRUCTURE_EXTENSION],  // Center extension
        [-2, 0, STRUCTURE_EXTENSION],  // Right extension
        [-3, 1, STRUCTURE_EXTENSION],  // Bottom extension
        
        // Storage to the right of spawn
        [2, 0, STRUCTURE_STORAGE],
        
        // Link to the right of storage  
        [4, 0, STRUCTURE_LINK],
        
        // Terminal left of the link
        [3, 0, STRUCTURE_TERMINAL],

        // 2 Towers spread out in the expanded right area
        [4, -1, STRUCTURE_TOWER],
        [4, 1, STRUCTURE_TOWER]
    ];
    
    addStampToPlannedStructures(room, anchor, coreStamp);
}



// Optimal extension field placement
function placeExtensionFieldsOptimal(room, spawn) {
    const extensionStamp = [
        // Extensions first to prevent roads underneath
        [0, -1, STRUCTURE_EXTENSION], // Top
        [-1, 0, STRUCTURE_EXTENSION], // Left
        [0, 0, STRUCTURE_EXTENSION],  // Center
        [1, 0, STRUCTURE_EXTENSION],  // Right
        [0, 1, STRUCTURE_EXTENSION]   // Bottom
    ];
    
    const spawnPos = spawn.pos;
    const candidatePositions = [];
    const terrain = new Room.Terrain(room.name);
    
    // Find candidate positions within reasonable distance of spawn
    for (let x = Math.max(5, spawnPos.x - 15); x <= Math.min(44, spawnPos.x + 15); x++) {
        for (let y = Math.max(5, spawnPos.y - 15); y <= Math.min(44, spawnPos.y + 15); y++) {
            const distanceFromSpawn = Math.max(Math.abs(x - spawnPos.x), Math.abs(y - spawnPos.y));
            
            // Check distance to walls - simple validation
            let wallDistance = 5; // Default safe distance
            for (let dx = -3; dx <= 3; dx++) {
                for (let dy = -3; dy <= 3; dy++) {
                    const checkX = x + dx;
                    const checkY = y + dy;
                    if (checkX >= 0 && checkX < 50 && checkY >= 0 && checkY < 50) {
                        if (terrain.get(checkX, checkY) === TERRAIN_MASK_WALL) {
                            const dist = Math.max(Math.abs(dx), Math.abs(dy));
                            if (dist < wallDistance) {
                                wallDistance = dist;
                            }
                        }
                    }
                }
            }
            
            // Good positions: close to spawn, far from walls, can fit stamp
            if (distanceFromSpawn >= 3 && distanceFromSpawn <= 12 && wallDistance >= 3) {
                if (isValidStampPosition(room, { x, y }, extensionStamp)) {
                    candidatePositions.push({
                        x, y,
                        score: wallDistance * 2 - distanceFromSpawn * 0.5
                    });
                }
            }
        }
    }
    
    // Sort by score and place best positions
    candidatePositions.sort((a, b) => b.score - a.score);
    
    let placed = 0;
    const maxExtensionFields = 8; // Limit number of extension fields
    
    for (const pos of candidatePositions) {
        if (placed >= maxExtensionFields) break;
        
        // Check if too close to already placed fields (center to center distance)
        let tooClose = false;
        for (let i = 0; i < placed; i++) {
            const prev = candidatePositions[i];
            const distance = Math.max(Math.abs(pos.x - prev.x), Math.abs(pos.y - prev.y));
            if (distance < 7) { // Minimum spacing between field perimeters
                tooClose = true;
                break;
            }
        }
        
        // Check distance from center of extension stamp to any non-road planned structures
        if (!tooClose) {
            const centerX = pos.x;
            const centerY = pos.y;
            
            for (const planned of room.memory.plannedStructures) {
                if (planned.type !== STRUCTURE_ROAD) {
                    const distToPlanned = Math.max(Math.abs(centerX - planned.x), Math.abs(centerY - planned.y));
                    if (distToPlanned < 3) { // Minimum 3 tiles from extension center to any non-road structure
                        tooClose = true;
                        break;
                    }
                }
            }
        }
        
        // Additional check: ensure extension centers are at least 3 tiles apart from each other
        if (!tooClose) {
            for (let i = 0; i < placed; i++) {
                const prev = candidatePositions[i];
                const centerDistance = Math.max(Math.abs(pos.x - prev.x), Math.abs(pos.y - prev.y));
                if (centerDistance < 3) { // Minimum center-to-center distance
                    tooClose = true;
                    break;
                }
            }
        }
        
        if (!tooClose && isValidStampPosition(room, pos, extensionStamp)) {
            addStampToPlannedStructures(room, pos, extensionStamp);
            placed++;
        }
    }
}


// Optimal turret cluster placement using distance transform
function placeDefenseStampsOptimal(room, spawn) {
    // Define a condensed 2x2 turret cluster with a surrounding road border
    const turretClusterStamp = [
        // 4 Turrets first to prevent roads underneath
        [0, 0, STRUCTURE_TOWER], [1, 0, STRUCTURE_TOWER],
        [0, 1, STRUCTURE_TOWER], [1, 1, STRUCTURE_TOWER]
    ];
    
    const spawnPos = spawn.pos;
    const terrain = new Room.Terrain(room.name);
    let bestPosition = null;
    let bestScore = 0;
    
    // Look for an optimal position for the turret cluster
    for (let x = Math.max(5, spawnPos.x - 10); x <= Math.min(44, spawnPos.x + 10); x++) {
        for (let y = Math.max(5, spawnPos.y - 10); y <= Math.min(44, spawnPos.y + 10); y++) {
            const distanceFromSpawn = Math.max(Math.abs(x - spawnPos.x), Math.abs(y - spawnPos.y));
            
            // Check distance to walls - simple validation
            let wallDistance = 5; // Default safe distance
            for (let dx = -3; dx <= 3; dx++) {
                for (let dy = -3; dy <= 3; dy++) {
                    const checkX = x + dx;
                    const checkY = y + dy;
                    if (checkX >= 0 && checkX < 50 && checkY >= 0 && checkY < 50) {
                        if (terrain.get(checkX, checkY) === TERRAIN_MASK_WALL) {
                            const dist = Math.max(Math.abs(dx), Math.abs(dy));
                            if (dist < wallDistance) {
                                wallDistance = dist;
                            }
                        }
                    }
                }
            }
            
            // Favor positions with a medium distance from spawn and far from walls
            if (distanceFromSpawn >= 4 && distanceFromSpawn <= 8 && wallDistance >= 3) {
                if (isValidStampPosition(room, { x, y }, turretClusterStamp)) {
                    // Additional check: ensure turrets are at least 1 tile away from non-road buildings
                    if (isTurretClusterValidDistance(room, { x, y }, turretClusterStamp)) {
                        const score = wallDistance * 1.5 - distanceFromSpawn * 0.3;
                        if (score > bestScore) {
                            bestScore = score;
                            bestPosition = { x, y };
                        }
                    }
                }
            }
        }
    }
    
    if (bestPosition) {
        addStampToPlannedStructures(room, bestPosition, turretClusterStamp);
    }
}

// Helper function: Check if turret cluster maintains minimum distance from non-road buildings
function isTurretClusterValidDistance(room, anchor, stamp) {
    // Extract turret positions from the stamp
    const turretPositions = [];
    for (const [dx, dy, structureType] of stamp) {
        if (structureType === STRUCTURE_TOWER) {
            turretPositions.push({
                x: anchor.x + dx,
                y: anchor.y + dy
            });
        }
    }
    
    // Check distance from each turret to all existing non-road planned structures
    for (const turretPos of turretPositions) {
        for (const planned of room.memory.plannedStructures) {
            if (planned.type !== STRUCTURE_ROAD) {
                const distance = Math.max(Math.abs(turretPos.x - planned.x), Math.abs(turretPos.y - planned.y));
                if (distance < 2) { // Minimum 2 tiles separation for creep pathfinding
                    return false;
                }
            }
        }
        
        // Check distance from existing built non-road structures in a 5x5 area around each turret
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                if (dx === 0 && dy === 0) continue; // Skip the turret position itself
                
                const checkX = turretPos.x + dx;
                const checkY = turretPos.y + dy;
                
                if (checkX >= 0 && checkX <= 49 && checkY >= 0 && checkY <= 49) {
                    const structuresAt = room.lookForAt(LOOK_STRUCTURES, checkX, checkY);
                    for (const structure of structuresAt) {
                        if (structure.structureType !== STRUCTURE_ROAD) {
                            // Calculate distance from turret to this structure
                            const structDistance = Math.max(Math.abs(dx), Math.abs(dy));
                            if (structDistance < 2) { // Minimum 2 tiles for creep movement
                                return false;
                            }
                        }
                    }
                }
            }
        }
    }
    
    return true; // All turrets maintain proper distance for creep pathfinding
}
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









// Helper function: Check if stamp can be placed at position
function isValidStampPosition(room, anchor, stamp) {
    const terrain = new Room.Terrain(room.name);
    
    for (const [dx, dy, structureType] of stamp) {
        const x = anchor.x + dx;
        const y = anchor.y + dy;
        
        if (x < 2 || x > 47 || y < 2 || y > 47) return false;
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) return false;
        
        // Check for existing planned structures - only roads can overlap
        const plannedAtPos = (room.memory.plannedStructures && room.memory.plannedStructures.filter(s => s.x === x && s.y === y)) || [];
        if (plannedAtPos.length > 0) {
            // If we're placing a road, it can overlap anything
            if (structureType === STRUCTURE_ROAD) continue;
            // If existing structure is a road, we can place over it
            if (plannedAtPos.every(s => s.type === STRUCTURE_ROAD)) continue;
            // Otherwise, no overlap allowed
            return false;
        }
        
        // Check for existing built structures - only roads can overlap
        const existing = room.lookForAt(LOOK_STRUCTURES, x, y);
        if (existing.length > 0) {
            // If we're placing a road, it can overlap anything
            if (structureType === STRUCTURE_ROAD) continue;
            // If existing structure is a road, we can place over it
            if (existing.every(s => s.structureType === STRUCTURE_ROAD)) continue;
            // Otherwise, no overlap allowed
            return false;
        }
    }
    
    return true;
}

// Helper function: Add stamp structures to planned list
function addStampToPlannedStructures(room, anchor, stamp) {
    let structuresAdded = 0;
    let duplicatesSkipped = 0;
    let conflictsAvoided = 0;
    
    for (const [dx, dy, structureType] of stamp) {
        const x = anchor.x + dx;
        const y = anchor.y + dy;
        
        // Check if there's already a structure planned at this position
        const existingPlanned = room.memory.plannedStructures.filter(s => s.x === x && s.y === y);
        
        // Check if there's already a built structure at this position
        const existingBuilt = room.lookForAt(LOOK_STRUCTURES, x, y);
        
        // Skip if same structure type already exists (planned or built)
        const hasSameTypePlanned = existingPlanned.some(s => s.type === structureType);
        const hasSameTypeBuilt = existingBuilt.some(s => s.structureType === structureType);
        
        if (hasSameTypePlanned || hasSameTypeBuilt) {
            duplicatesSkipped++;
            continue; // Same structure already exists, don't add duplicate
        }
        
        // For roads: skip if non-road structure exists (planned or built)
        if (structureType === STRUCTURE_ROAD) {
            const hasNonRoadPlanned = existingPlanned.some(s => s.type !== STRUCTURE_ROAD);
            const hasNonRoadBuilt = existingBuilt.some(s => s.structureType !== STRUCTURE_ROAD);
            
            if (hasNonRoadPlanned || hasNonRoadBuilt) {
                conflictsAvoided++;
                continue; // Don't place road under other buildings
            }
        }
        
        // For non-roads: skip if any other structure exists (planned or built), except roads can be overwritten
        if (structureType !== STRUCTURE_ROAD) {
            const hasConflictingPlanned = existingPlanned.some(s => s.type !== STRUCTURE_ROAD);
            const hasConflictingBuilt = existingBuilt.some(s => s.structureType !== STRUCTURE_ROAD);
            
            if (hasConflictingPlanned || hasConflictingBuilt) {
                conflictsAvoided++;
                continue; // Don't place non-road over other non-road structures
            }
        }
        
        // Safe to place structure - no conflicts
        room.memory.plannedStructures.push({
            x: x,
            y: y,
            type: structureType
        });
        structuresAdded++;
    }
    
    // Log stamp placement summary if there were any conflicts
    if (duplicatesSkipped > 0 || conflictsAvoided > 0) {
        console.log(`📐 Stamp: ${structuresAdded} structures added, ${duplicatesSkipped} duplicates skipped, ${conflictsAvoided} conflicts avoided`);
    }
}

// Create cost matrix for pathfinding that avoids walls and expensive structures
function createRoadPlanningCostMatrix(room) {
    const costs = new PathFinder.CostMatrix();
    const terrain = new Room.Terrain(room.name);
    
    // Set costs for terrain
    for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
            const terrainType = terrain.get(x, y);
            if (terrainType === TERRAIN_MASK_WALL) {
                costs.set(x, y, 255); // Impassable walls
            } else if (terrainType === TERRAIN_MASK_SWAMP) {
                costs.set(x, y, 5); // Prefer not to use swamps but allow if needed
            } else {
                costs.set(x, y, 1); // Plain terrain
            }
        }
    }
    
    // Avoid existing walls (very expensive to go through)
    const walls = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_WALL
    });
    walls.forEach(wall => {
        costs.set(wall.pos.x, wall.pos.y, 255); // Make walls impassable
    });
    
    // Avoid planned walls
    if (room.memory.plannedStructures) {
        room.memory.plannedStructures.forEach(planned => {
            if (planned.type === STRUCTURE_WALL) {
                costs.set(planned.x, planned.y, 255); // Make planned walls impassable
            } else if (planned.type !== STRUCTURE_ROAD) {
                costs.set(planned.x, planned.y, 10); // Avoid other planned structures but allow if needed
            }
        });
    }
    
    // Prefer existing roads
    const roads = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_ROAD
    });
    roads.forEach(road => {
        costs.set(road.pos.x, road.pos.y, 1); // Roads are good
    });
    
    return costs;
}

// Simple road network planning - only essential paths from spawn
function planRoadNetwork(room, anchor, sources, controller) {
    console.log('Planning minimal road network...');

    // Create cost matrix for pathfinding that avoids walls and expensive structures
    const costMatrix = createRoadPlanningCostMatrix(room);

    // Key positions for road planning
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const spawnPos = spawn.pos;

    console.log(`Core at (${anchor.x},${anchor.y}), planning roads to ${sources.length} sources and controller`);

    // 1. Connect spawn to all sources (single-tile-wide paths)
    sources.forEach((source, index) => {
        const path = PathFinder.search(spawnPos, { pos: source.pos, range: 2 }, {
            roomCallback: () => costMatrix,
            maxRooms: 1
        }).path;
        addPathAsRoads(room, path, `Spawn → Source ${index + 1}`);
    });

    // 2. Connect spawn to controller (single-tile-wide path)
    const controllerPath = PathFinder.search(spawnPos, { pos: controller.pos, range: 3 }, {
        roomCallback: () => costMatrix,
        maxRooms: 1
    }).path;
    addPathAsRoads(room, controllerPath, 'Spawn → Controller');

    console.log('Minimal road network planning complete');
}

// Enhanced helper function: Add path positions as road structures with logging
function addPathAsRoads(room, path, routeName = 'Unknown Route') {
    let roadsAdded = 0;
    let roadsSkipped = 0;
    let structureConflicts = 0;
    let wallConflicts = 0;
    
    const terrain = new Room.Terrain(room.name);
    
    // Place roads on every tile of the path except start and end positions for continuous connections
    for (let i = 1; i < path.length - 1; i++) {
        const pos = path[i];
        
        // Skip if position is a wall
        if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) {
            wallConflicts++;
            continue; // Cannot place road on wall terrain
        }
        
        // Check if there's already a structure planned at this position
        const existingPlanned = room.memory.plannedStructures.filter(s => s.x === pos.x && s.y === pos.y);
        
        // Check if there's already a built structure at this position
        const existingBuilt = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
        
        // Skip if road already exists (planned or built)
        const hasRoadPlanned = existingPlanned.some(s => s.type === STRUCTURE_ROAD);
        const hasRoadBuilt = existingBuilt.some(s => s.structureType === STRUCTURE_ROAD);
        
        if (hasRoadPlanned || hasRoadBuilt) {
            roadsSkipped++;
            continue; // Road already exists, don't add duplicate
        }
        
        // Skip if wall exists (planned or built) - these are impassable or expensive
        const hasWallPlanned = existingPlanned.some(s => s.type === STRUCTURE_WALL);
        const hasWallBuilt = existingBuilt.some(s => s.structureType === STRUCTURE_WALL);
        
        if (hasWallPlanned || hasWallBuilt) {
            wallConflicts++;
            continue; // Don't place road through walls - extremely expensive
        }
        
        // Skip if non-road structure exists (planned or built)
        const hasNonRoadPlanned = existingPlanned.some(s => s.type !== STRUCTURE_ROAD);
        const hasNonRoadBuilt = existingBuilt.some(s => s.structureType !== STRUCTURE_ROAD);
        
        if (hasNonRoadPlanned || hasNonRoadBuilt) {
            structureConflicts++;
            continue; // Don't place road under other buildings
        }
        
        // Safe to place road - no conflicts
        room.memory.plannedStructures.push({
            x: pos.x,
            y: pos.y,
            type: STRUCTURE_ROAD
        });
        roadsAdded++;
    }
    
    // Log road placement summary
    if (roadsAdded > 0 || roadsSkipped > 0 || structureConflicts > 0 || wallConflicts > 0) {
        console.log(`🛣️ ${routeName}: ${roadsAdded} roads added, ${roadsSkipped} duplicates skipped, ${structureConflicts} structure conflicts avoided, ${wallConflicts} wall conflicts avoided`);
    }
}

/**
 * Plan "bookend walls" - minimal defense strategy that places exactly 2 walls per entrance
 * at the endpoints of each passable span. This approach:
 * - Blocks enemy creeps from easily slipping through entrance corners
 * - Leaves the middle open (assuming natural terrain blocks or that gaps are acceptable)
 * - Minimizes wall count while providing basic entrance control
 * - Prefers distance 1 from edge, falls back to distance 2 if needed
 */
function planMinimalEdgeSeal(room) {
    const terrain = room.getTerrain();

    function isPassable(x, y) {
        return terrain.get(x, y) !== TERRAIN_MASK_WALL;
    }
    
    function inInnerBounds(x, y) {
        return x >= 1 && x <= 48 && y >= 1 && y <= 48;
    }
    
    function isUnbuildable(x, y) {
        if (!inInnerBounds(x, y)) return true;
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) return true;
        
        const look = room.lookAt(x, y);
        for (const o of look) {
            if (o.type === LOOK_STRUCTURES ||
                o.type === LOOK_CONSTRUCTION_SITES ||
                o.type === LOOK_SOURCES ||
                o.type === LOOK_MINERALS) {
                return true;
            }
            // Check for controller specifically
            if (o.type === LOOK_STRUCTURES && o.structure && o.structure.structureType === STRUCTURE_CONTROLLER) {
                return true;
            }
        }
        return false;
    }

    function scanEdge(edge) {
        const out = [];
        if (edge === "TOP") {
            for (let x = 0; x < 50; x++) {
                if (isPassable(x, 0)) out.push({x, y: 0});
            }
        } else if (edge === "BOTTOM") {
            for (let x = 0; x < 50; x++) {
                if (isPassable(x, 49)) out.push({x, y: 49});
            }
        } else if (edge === "LEFT") {
            for (let y = 0; y < 50; y++) {
                if (isPassable(0, y)) out.push({x: 0, y});
            }
        } else if (edge === "RIGHT") {
            for (let y = 0; y < 50; y++) {
                if (isPassable(49, y)) out.push({x: 49, y});
            }
        }
        return out;
    }

    function segments(tiles, edge) {
        const segs = [];
        let cur = [];
        const sorted = tiles.slice().sort((a, b) =>
            (edge === "TOP" || edge === "BOTTOM") ? a.x - b.x : a.y - b.y
        );
        
        for (const t of sorted) {
            if (cur.length === 0) { 
                cur.push(t); 
                continue; 
            }
            
            const prev = cur[cur.length - 1];
            const cont = (edge === "TOP" || edge === "BOTTOM")
                ? (t.x === prev.x + 1)
                : (t.y === prev.y + 1);
                
            if (cont) {
                cur.push(t);
            } else {
                segs.push(cur);
                cur = [t];
            }
        }
        if (cur.length) segs.push(cur);
        return segs;
    }

    function project(p, edge, d) {
        if (edge === "TOP")    return { x: p.x,     y: p.y + d };
        if (edge === "BOTTOM") return { x: p.x,     y: p.y - d };
        if (edge === "LEFT")   return { x: p.x + d, y: p.y     };
        // RIGHT
        return { x: p.x - d, y: p.y };
    }

    const walls = [];
    let totalEntrances = 0;
    let totalBookends = 0;

    function handleEdge(edge) {
        const pass = scanEdge(edge);
        const segs = segments(pass, edge);
        
        totalEntrances += segs.length;
        
        for (const seg of segs) {
            // endpoints of this entrance - bookend wall placement
            const a0 = seg[0];
            const b0 = seg[seg.length - 1];

            // Skip single-tile entrances (already minimal)
            if (seg.length === 1) continue;

            // Extend to match curtain width (overhang each side)
            const aExt = (edge === 'TOP' || edge === 'BOTTOM')
                ? { x: Math.max(0, a0.x - ENTRANCE_OVERHANG_TILES), y: a0.y }
                : { x: a0.x, y: Math.max(0, a0.y - ENTRANCE_OVERHANG_TILES) };
            const bExt = (edge === 'TOP' || edge === 'BOTTOM')
                ? { x: Math.min(49, b0.x + ENTRANCE_OVERHANG_TILES), y: b0.y }
                : { x: b0.x, y: Math.min(49, b0.y + ENTRANCE_OVERHANG_TILES) };

            // Try to place each bookend independently with fallback depths 1 then 2
            const sides = [aExt, bExt];
            for (const base of sides) {
                for (const d of [1, 2]) {
                    const p = project(base, edge, d);
                    if (!isUnbuildable(p.x, p.y)) {
                        walls.push(p);
                        totalBookends += 1;
                        break; // done with this side
                    }
                }
            }
        }
    }

    handleEdge("TOP");
    handleEdge("BOTTOM");
    handleEdge("LEFT");
    handleEdge("RIGHT");

    // Deduplicate walls
    const seen = new Set();
    const out = [];
    for (const w of walls) {
        const key = w.x + ',' + w.y;
        if (!seen.has(key)) {
            seen.add(key);
            out.push(w);
        }
    }
    
    console.log(`🛡️ Bookend wall planning: Found ${totalEntrances} entrances, planned ${totalBookends} bookend walls (${out.length} after deduplication)`);
    
    return out;
}

function buildPlannedEdgeSeal(room, precomputedPlan) {
    const plan = precomputedPlan || planMinimalEdgeSeal(room);
    const stamp = [[0, 0, STRUCTURE_WALL]];
    const seen = new Set();
    
    let newWallsPlanned = 0;

    for (const pos of plan) {
        const key = pos.x + ':' + pos.y;
        if (seen.has(key)) continue;
        seen.add(key);

        // Only add to planned structures - let createMissingConstructionSites handle actual construction
        addStampToPlannedStructures(room, { x: pos.x, y: pos.y }, stamp);
        newWallsPlanned++;
    }
    
    if (newWallsPlanned > 0) {
        console.log(`🛡️ BOOKEND WALLS: Planned ${newWallsPlanned} bookend walls (${plan.length} total positions)`);
    }
}

/**
 * Plan interior curtains across each entrance with a center rampart gate.
 * Pattern per entrance (top edge example):
 * - Bookends already at y=1 (handled elsewhere)
 * - Curtain of walls at y=2 from first to last entrance x
 * - Single center tile is a RAMPART (friendly passage)
 */
function planEntranceCurtains(room) {
    const terrain = room.getTerrain();

    function passable(x, y) { return terrain.get(x, y) !== TERRAIN_MASK_WALL; }
    function inBounds(x, y) { return x >= 1 && x <= 48 && y >= 1 && y <= 48; }

    function scanEdge(edge) {
        const tiles = [];
        if (edge === 'TOP') {
            for (let x = 0; x < 50; x++) if (passable(x, 0)) tiles.push({ x, y: 0 });
        } else if (edge === 'BOTTOM') {
            for (let x = 0; x < 50; x++) if (passable(x, 49)) tiles.push({ x, y: 49 });
        } else if (edge === 'LEFT') {
            for (let y = 0; y < 50; y++) if (passable(0, y)) tiles.push({ x: 0, y });
        } else if (edge === 'RIGHT') {
            for (let y = 0; y < 50; y++) if (passable(49, y)) tiles.push({ x: 49, y });
        }
        return tiles;
    }

    function segments(tiles, edge) {
        const segs = [];
        let cur = [];
        const sorted = tiles.slice().sort((a, b) => (edge === 'TOP' || edge === 'BOTTOM') ? a.x - b.x : a.y - b.y);
        for (const t of sorted) {
            if (cur.length === 0) { cur.push(t); continue; }
            const p = cur[cur.length - 1];
            const cont = (edge === 'TOP' || edge === 'BOTTOM') ? (t.x === p.x + 1) : (t.y === p.y + 1);
            if (cont) cur.push(t); else { segs.push(cur); cur = [t]; }
        }
        if (cur.length) segs.push(cur);
        return segs;
    }

    function project(p, edge, d) {
        if (edge === 'TOP') return { x: p.x, y: p.y + d };
        if (edge === 'BOTTOM') return { x: p.x, y: p.y - d };
        if (edge === 'LEFT') return { x: p.x + d, y: p.y };
        return { x: p.x - d, y: p.y }; // RIGHT
    }

    const placements = [];

    function addCurtains(edge) {
        const segs = segments(scanEdge(edge), edge);
        for (const seg of segs) {
            if (seg.length < 2) continue; // ignore 1-tile entrances

            // Center of original entrance for rampart gate
            const centerIdx = Math.floor(seg.length / 2);
            const centerBase = seg[centerIdx];

            if (edge === 'TOP' || edge === 'BOTTOM') {
                const yEdge = edge === 'TOP' ? 0 : 49;
                const startX = Math.max(0, seg[0].x - ENTRANCE_OVERHANG_TILES); // extend before
                const endX = Math.min(49, seg[seg.length - 1].x + ENTRANCE_OVERHANG_TILES); // extend after
                for (let x = startX; x <= endX; x++) {
                    const base = { x, y: yEdge };
                    const pos = project(base, edge, ENTRANCE_CURTAIN_DEPTH);
                    if (!inBounds(pos.x, pos.y)) continue;
                    // Skip if projected tile is terrain wall
                    if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) continue;
                    const isRampart = (x === centerBase.x);
                    placements.push({ x: pos.x, y: pos.y, type: isRampart ? STRUCTURE_RAMPART : STRUCTURE_WALL });
                }
            } else {
                const xEdge = edge === 'LEFT' ? 0 : 49;
                const startY = Math.max(0, seg[0].y - ENTRANCE_OVERHANG_TILES);
                const endY = Math.min(49, seg[seg.length - 1].y + ENTRANCE_OVERHANG_TILES);
                for (let y = startY; y <= endY; y++) {
                    const base = { x: xEdge, y };
                    const pos = project(base, edge, ENTRANCE_CURTAIN_DEPTH);
                    if (!inBounds(pos.x, pos.y)) continue;
                    if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) continue;
                    const isRampart = (y === centerBase.y);
                    placements.push({ x: pos.x, y: pos.y, type: isRampart ? STRUCTURE_RAMPART : STRUCTURE_WALL });
                }
            }
        }
    }

    addCurtains('TOP');
    addCurtains('BOTTOM');
    addCurtains('LEFT');
    addCurtains('RIGHT');

    console.log(`🧱 Curtain planning: ${placements.length} tiles (walls + ramparts) across entrances`);
    return placements;
}

function buildEntranceCurtains(room, plan) {
    if (!plan || plan.length === 0) return;
    let wallsPlanned = 0, rampartsPlanned = 0;

    const seen = new Set();
    const terrain = new Room.Terrain(room.name);
    for (const item of plan) {
        const key = item.x + ':' + item.y + ':' + item.type;
        if (seen.has(key)) continue;
        seen.add(key);

        // Avoid planning on terrain walls entirely
        if (terrain.get(item.x, item.y) === TERRAIN_MASK_WALL) continue;

        // Only add to planned structures - let createMissingConstructionSites handle actual construction
        addStampToPlannedStructures(room, { x: item.x, y: item.y }, [[0, 0, item.type]]);
        
        if (item.type === STRUCTURE_WALL) {
            wallsPlanned++;
        } else {
            rampartsPlanned++;
        }
    }
    if (wallsPlanned || rampartsPlanned) {
        console.log(`🧱 Curtains: planned ${wallsPlanned} walls and ${rampartsPlanned} ramparts`);
    }
}

// Create initial defensive structures immediately after base planning
function createInitialDefensiveStructures(room) {
    if (!room.memory.plannedStructures) return;
    
    let wallsCreated = 0;
    let rampartsCreated = 0;
    
    // Only create walls and ramparts from planned structures
    const defensiveStructures = room.memory.plannedStructures.filter(s => 
        s.type === STRUCTURE_WALL || s.type === STRUCTURE_RAMPART
    );
    
    for (const planned of defensiveStructures) {
        const pos = new RoomPosition(planned.x, planned.y, room.name);
        
        // Check if structure or construction site already exists
        const structures = pos.lookFor(LOOK_STRUCTURES);
        const constructionSites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
        
        const hasStructure = structures.some(s => s.structureType === planned.type);
        const hasConstructionSite = constructionSites.some(c => c.structureType === planned.type);
        
        if (!hasStructure && !hasConstructionSite) {
            const result = room.createConstructionSite(pos.x, pos.y, planned.type);
            if (result === OK) {
                if (planned.type === STRUCTURE_WALL) {
                    wallsCreated++;
                } else {
                    rampartsCreated++;
                }
            }
        }
    }
    
    if (wallsCreated > 0 || rampartsCreated > 0) {
        console.log(`🛡️ Initial defenses: Created ${wallsCreated} walls and ${rampartsCreated} ramparts`);
    }
}

function generateHexId() {
    return Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
}

// Helper function to get the source with least assigned energy-gathering creeps
function getLeastUtilizedSource(room) {
    const sources = room.find(FIND_SOURCES);
    const energyGatheringCreeps = _.filter(Game.creeps, c => 
        c.memory.role === 'hauler' || c.memory.role === 'builder' || c.memory.role === 'upgrader'
    );
    
    const sourceAssignments = {};
    for (const source of sources) {
        sourceAssignments[source.id] = energyGatheringCreeps.filter(c => c.memory.assignedSource === source.id).length;
    }
    
    let leastUtilizedSource = null;
    let leastCount = 999;
    
    for (const source of sources) {
        const count = sourceAssignments[source.id] || 0;
        if (count < leastCount) {
            leastCount = count;
            leastUtilizedSource = source;
        }
    }
    
    return leastUtilizedSource;
}

// Get or calculate cached distance metrics for throughput calculations
function getCachedDistanceMetrics(room) {
    // Check if we have cached metrics and they're still valid
    if (room.memory.distanceMetrics && 
        room.memory.distanceMetrics.calculatedAt && 
        Game.time - room.memory.distanceMetrics.calculatedAt < 1500) {
        return room.memory.distanceMetrics;
    }
    
    // Calculate fresh metrics
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) return null;
    
    const sources = room.find(FIND_SOURCES);
    let totalDistance = 0;
    
    sources.forEach(source => {
        const path = PathFinder.search(spawn.pos, { pos: source.pos, range: 1 }, {
            roomCallback: () => createRoadPlanningCostMatrix(room),
            maxRooms: 1
        });
        totalDistance += path.cost;
    });
    
    const avgDistance = totalDistance / sources.length;
    const roundTripTime = 2 * avgDistance + 4;
    const carryPerHauler = Math.ceil((2/5) * roundTripTime);
    
    // Cache the results
    room.memory.distanceMetrics = {
        avgDistance,
        roundTripTime,
        carryPerHauler,
        calculatedAt: Game.time
    };
    
    console.log(`📐 Distance metrics cached: avgDist=${avgDistance.toFixed(1)}, Trtt=${roundTripTime.toFixed(1)}, carry=${carryPerHauler}`);
    
    return room.memory.distanceMetrics;
}

// Detect emergency situations that require immediate response
function detectEmergency(room, creeps) {
    const emergency = {
        isEmergency: false,
        reason: '',
        priority: 'none'
    };
    
    // Check 1: Controller about to downgrade
    if (room.controller.ticksToDowngrade < CONTROLLER_DOWNGRADE_EMERGENCY) {
        emergency.isEmergency = true;
        emergency.reason = `Controller downgrade in ${room.controller.ticksToDowngrade} ticks`;
        emergency.priority = 'critical';
        return emergency;
    }
    
    // Check 2: No miners alive (energy production stopped)
    if (creeps.miner.length === 0) {
        emergency.isEmergency = true;
        emergency.reason = 'No miners alive';
        emergency.priority = 'critical';
        return emergency;
    }
    
    // Check 3: Spawn almost dead
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (spawn && spawn.hits < spawn.hitsMax * 0.3) {
        emergency.isEmergency = true;
        emergency.reason = 'Spawn heavily damaged';
        emergency.priority = 'high';
        return emergency;
    }
    
    // Check 4: Very low energy and no haulers
    if (room.energyAvailable < EMERGENCY_ENERGY_THRESHOLD && creeps.hauler.length === 0) {
        emergency.isEmergency = true;
        emergency.reason = 'Low energy and no haulers';
        emergency.priority = 'high';
        return emergency;
    }
    
    return emergency;
}

// Clean up memory for structures that have been built
function cleanupBuiltStructures(room) {
    if (!room.memory.plannedStructures) return;
    
    const initialCount = room.memory.plannedStructures.length;
    
    room.memory.plannedStructures = room.memory.plannedStructures.filter(planned => {
        // Check if a structure exists at this position
        const structures = room.lookForAt(LOOK_STRUCTURES, planned.x, planned.y);
        const exists = structures.some(s => s.structureType === planned.type);
        
        // Keep if not built yet
        return !exists;
    });
    
    const removed = initialCount - room.memory.plannedStructures.length;
    if (removed > 0) {
        console.log(`🧹 Cleaned up ${removed} built structures from memory`);
    }
}

// Run link energy transfer logic
function runLinks(room) {
    const links = room._structureCache.links;
    if (links.length < 2) return; // Need at least 2 links
    
    // Find source links (near sources) and sink links (near spawn/controller)
    const sources = room.find(FIND_SOURCES);
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const controller = room.controller;
    
    const sourceLinks = [];
    const sinkLinks = [];
    
    links.forEach(link => {
        // Check if near a source
        const nearSource = sources.some(source => link.pos.getRangeTo(source) <= 2);
        if (nearSource) {
            sourceLinks.push(link);
        } else {
            // Check if near spawn or controller
            const nearSpawn = spawn && link.pos.getRangeTo(spawn) <= 3;
            const nearController = controller && link.pos.getRangeTo(controller) <= 3;
            if (nearSpawn || nearController) {
                sinkLinks.push(link);
            }
        }
    });
    
    // Transfer energy from full source links to empty sink links
    sourceLinks.forEach(sourceLink => {
        if (sourceLink.store[RESOURCE_ENERGY] >= 400 && sourceLink.cooldown === 0) {
            // Find sink link with most free space
            const targetLink = _.min(sinkLinks, link => link.store[RESOURCE_ENERGY]);
            if (targetLink && targetLink.store[RESOURCE_ENERGY] < 400) {
                const result = sourceLink.transferEnergy(targetLink);
                if (result === OK) {
                    console.log(`🔗 Link transfer: ${sourceLink.store[RESOURCE_ENERGY]} energy sent`);
                }
            }
        }
    });
}

// Check if a creep should be recycled (old age or replacement ready)
function shouldRecycleCreep(creep, room) {
    // Don't recycle if creep has no TTL (shouldn't happen but be safe)
    if (!creep.ticksToLive) return false;
    
    // Don't recycle during emergency
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn || spawn.spawning) return false;
    
    // Calculate distance to spawn for return trip estimate
    const distanceToSpawn = creep.pos.getRangeTo(spawn);
    
    // Recycle if creep won't make it back to spawn for recycling
    // Add buffer to ensure they make it back with time to spare
    if (creep.ticksToLive < distanceToSpawn + 10) {
        return false; // Too late to recycle, let them die
    }
    
    // Recycle if within recycle window
    return creep.ticksToLive <= CREEP_RECYCLE_TTL;
}

// Recycle a creep at the spawn
function recycleCreep(creep, spawn) {
    // Mark creep as recycling
    if (!creep.memory.recycling) {
        creep.memory.recycling = true;
        creep.say('♻️');
    }
    
    // Move to spawn and recycle
    if (creep.pos.isNearTo(spawn)) {
        spawn.recycleCreep(creep);
    } else {
        creep.moveTo(spawn, { 
            visualizePathStyle: { stroke: '#00ff00', opacity: 0.5 },
            reusePath: 20
        });
    }
}

// Simplified population control based on room controller level
function spawnCreeps(spawn, creeps, sources, emergency) {
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
    
    // Helper function to determine if we should wait for more energy or spawn with what we have
    const shouldWaitForEnergy = (neededEnergy, role) => {
        // Always wait for optimal energy unless it's an emergency
        if (energyAvailable >= neededEnergy) return false; // We have enough, spawn now
        
        // Emergency situations where we spawn suboptimal creeps:
        // 1. No creeps of this role exist and it's critical
        // 2. Energy capacity is very low (early game)
        const currentCount = creeps[role].length;
        const isCriticalRole = (role === 'miner' || role === 'hauler');
        const isEmergency = currentCount === 0 && isCriticalRole;
        const isEarlyGame = energyCapacity <= 300;
        
        return !isEmergency && !isEarlyGame;
    };
    
    // Simple spawn priority: miner > hauler > upgrader > builder
    if (creeps.miner.length < populationTargets.miner) {
        if (!shouldWaitForEnergy(bodyCosts.miner, 'miner')) {
            // Use optimal body if we have enough energy, otherwise fallback to affordable body
            let bodyToUse = bodies.miner;
            let costToUse = bodyCosts.miner;
            
            if (energyAvailable < bodyCosts.miner) {
                // Fallback to smaller body that we can afford
                const fallbackBodies = getBodiesByEnergyCapacity(energyAvailable);
                bodyToUse = fallbackBodies.miner;
                costToUse = bodyToUse.reduce((cost, part) => cost + (part === WORK ? 100 : part === CARRY ? 50 : 50), 0);
            }
            
            if (energyAvailable >= costToUse) {
                // Find unassigned source for this miner
                const assignedSources = creeps.miner.map(m => m.memory.sourceId).filter(id => id);
                const unassignedSource = sources.find(s => !assignedSources.includes(s.id));
                const sourceId = unassignedSource ? unassignedSource.id : sources[creeps.miner.length % sources.length].id;
                
                const name = 'mine:' + generateHexId();
                const result = spawn.spawnCreep(bodyToUse, name, { 
                    memory: { 
                        role: 'miner',
                        sourceId: sourceId
                    } 
                });
                if (result === OK) {
                    console.log(`Spawning miner: ${name} @ source ${sourceId.substr(-4)} (${costToUse}/${bodyCosts.miner} energy)`);
                }
                return;
            }
        } else {
            console.log(`⏳ Waiting for ${bodyCosts.miner} energy to spawn optimal miner (have ${energyAvailable})`);
        }
    }
    
    if (creeps.hauler.length < populationTargets.hauler) {
        if (!shouldWaitForEnergy(bodyCosts.hauler, 'hauler')) {
            let bodyToUse = bodies.hauler;
            let costToUse = bodyCosts.hauler;
            
            if (energyAvailable < bodyCosts.hauler) {
                const fallbackBodies = getBodiesByEnergyCapacity(energyAvailable);
                bodyToUse = fallbackBodies.hauler;
                costToUse = bodyToUse.reduce((cost, part) => cost + (part === WORK ? 100 : part === CARRY ? 50 : 50), 0);
            }
            
            if (energyAvailable >= costToUse) {
                // Assign source in round-robin fashion
                const sourceId = sources[creeps.hauler.length % sources.length].id;
                
                const name = 'haul:' + generateHexId();
                const result = spawn.spawnCreep(bodyToUse, name, { 
                    memory: { 
                        role: 'hauler',
                        assignedSource: sourceId
                    } 
                });
                if (result === OK) {
                    console.log(`Spawning hauler: ${name} @ source ${sourceId.substr(-4)} (${costToUse}/${bodyCosts.hauler} energy)`);
                }
                return;
            }
        } else {
            console.log(`⏳ Waiting for ${bodyCosts.hauler} energy to spawn optimal hauler (have ${energyAvailable})`);
        }
    }
    
    if (creeps.upgrader.length < populationTargets.upgrader) {
        if (!shouldWaitForEnergy(bodyCosts.upgrader, 'upgrader')) {
            let bodyToUse = bodies.upgrader;
            let costToUse = bodyCosts.upgrader;
            
            if (energyAvailable < bodyCosts.upgrader) {
                const fallbackBodies = getBodiesByEnergyCapacity(energyAvailable);
                bodyToUse = fallbackBodies.upgrader;
                costToUse = bodyToUse.reduce((cost, part) => cost + (part === WORK ? 100 : part === CARRY ? 50 : 50), 0);
            }
            
            if (energyAvailable >= costToUse) {
                // Assign source in round-robin fashion
                const sourceId = sources[creeps.upgrader.length % sources.length].id;
                
                const name = 'upgr:' + generateHexId();
                const result = spawn.spawnCreep(bodyToUse, name, { 
                    memory: { 
                        role: 'upgrader',
                        assignedSource: sourceId
                    } 
                });
                if (result === OK) {
                    console.log(`Spawning upgrader: ${name} @ source ${sourceId.substr(-4)} (${costToUse}/${bodyCosts.upgrader} energy)`);
                }
                return;
            }
        } else {
            console.log(`⏳ Waiting for ${bodyCosts.upgrader} energy to spawn optimal upgrader (have ${energyAvailable})`);
        }
    }
    
    if (creeps.builder.length < populationTargets.builder) {
        if (!shouldWaitForEnergy(bodyCosts.builder, 'builder')) {
            let bodyToUse = bodies.builder;
            let costToUse = bodyCosts.builder;
            
            if (energyAvailable < bodyCosts.builder) {
                const fallbackBodies = getBodiesByEnergyCapacity(energyAvailable);
                bodyToUse = fallbackBodies.builder;
                costToUse = bodyToUse.reduce((cost, part) => cost + (part === WORK ? 100 : part === CARRY ? 50 : 50), 0);
            }
            
            if (energyAvailable >= costToUse) {
                // Assign source in round-robin fashion
                const sourceId = sources[creeps.builder.length % sources.length].id;
                
                const name = 'bldr:' + generateHexId();
                const result = spawn.spawnCreep(bodyToUse, name, { 
                    memory: { 
                        role: 'builder',
                        assignedSource: sourceId
                    } 
                });
                if (result === OK) {
                    console.log(`Spawning builder: ${name} @ source ${sourceId.substr(-4)} (${costToUse}/${bodyCosts.builder} energy)`);
                }
                return;
            }
        } else {
            console.log(`⏳ Waiting for ${bodyCosts.builder} energy to spawn optimal builder (have ${energyAvailable})`);
        }
    }
    
    // Scout spawning (RCL 4+)
    if (rcl >= 4 && creeps.scout.length === 0) {
        const scoutCost = bodies.scout ? bodies.scout.reduce((cost, part) => cost + 50, 0) : 150;
        
        if (energyAvailable >= scoutCost) {
            const name = 'scout:' + generateHexId();
            const result = spawn.spawnCreep(bodies.scout, name, {
                memory: {
                    role: 'scout',
                    homeRoom: room.name,
                    targetRoom: null,
                    scoutedRooms: []
                }
            });
            if (result === OK) {
                console.log(`🔍 Spawning scout for remote room exploration (${scoutCost} energy)`);
            }
            return;
        }
    }
    
    // Remote harvesting creeps (RCL 4+)
    if (rcl >= 4) {
        const activeRemoteRooms = getActiveRemoteRooms();
        
        if (activeRemoteRooms.length > 0) {
            // Calculate remote body costs
            const remoteCosts = {
                reserver: bodies.reserver ? bodies.reserver.reduce((cost, part) => cost + (part === CLAIM ? 600 : 50), 0) : 650,
                remoteMiner: bodies.remoteMiner ? bodies.remoteMiner.reduce((cost, part) => cost + (part === WORK ? 100 : 50), 0) : 550,
                remoteBuilder: bodies.remoteBuilder ? bodies.remoteBuilder.reduce((cost, part) => cost + (part === WORK ? 100 : part === CARRY ? 50 : 50), 0) : 400
            };
            
            // Spawn reservers for each active remote room
            for (const remoteRoom of activeRemoteRooms) {
                const reserversForRoom = creeps.reserver.filter(c => c.memory.targetRoom === remoteRoom.name);
                
                // Need 1 reserver per room, but be smarter about timing based on reservation status
                let needReserver = false;
                
                if (reserversForRoom.length === 0) {
                    // No reserver at all
                    needReserver = true;
                } else {
                    // Check the actual room's reservation status
                    const remoteRoomObj = Game.rooms[remoteRoom.name];
                    if (remoteRoomObj && remoteRoomObj.controller) {
                        const reservation = remoteRoomObj.controller.reservation;
                        
                        if (!reservation || reservation.username !== Memory.username) {
                            // No reservation or not ours - need reserver
                            needReserver = true;
                        } else if (reservation.ticksToEnd < 1000) {
                            // Reservation is getting low - need new reserver
                            needReserver = true;
                        }
                        // If reservation has > 1000 ticks left, we're good
                    } else {
                        // No vision of room - assume we need a reserver
                        needReserver = true;
                    }
                }
                
                if (needReserver && energyAvailable >= remoteCosts.reserver) {
                    const name = 'resv:' + generateHexId();
                    const result = spawn.spawnCreep(bodies.reserver, name, {
                        memory: {
                            role: 'reserver',
                            targetRoom: remoteRoom.name,
                            homeRoom: room.name
                        }
                    });
                    if (result === OK) {
                        // Log reservation status for context
                        const remoteRoomObj = Game.rooms[remoteRoom.name];
                        const reservation = (remoteRoomObj && remoteRoomObj.controller && remoteRoomObj.controller.reservation);
                        const ticksLeft = (reservation && reservation.ticksToEnd) || 0;
                        console.log(`🌍 Spawning reserver for ${remoteRoom.name} (${remoteCosts.reserver} energy) - reservation: ${ticksLeft} ticks`);
                    }
                    return;
                }
            }
            
            // Spawn remote miners for each source in active remote rooms
            for (const remoteRoom of activeRemoteRooms) {
                if (!remoteRoom.sourceIds || remoteRoom.sourceIds.length === 0) continue;
                
                for (const sourceId of remoteRoom.sourceIds) {
                    const minersForSource = creeps.remoteMiner.filter(c => c.memory.sourceId === sourceId);
                    
                    if (minersForSource.length === 0 && energyAvailable >= remoteCosts.remoteMiner) {
                        const name = 'rmin:' + generateHexId();
                        const result = spawn.spawnCreep(bodies.remoteMiner, name, {
                            memory: {
                                role: 'remoteMiner',
                                sourceId: sourceId,
                                targetRoom: remoteRoom.name,
                                homeRoom: room.name
                            }
                        });
                        if (result === OK) {
                            console.log(`⛏️ Spawning remote miner for ${remoteRoom.name} source ${sourceId.substr(-4)} (${remoteCosts.remoteMiner} energy)`);
                        }
                        return;
                    }
                }
            }
            
            // Spawn 1 remote builder per active room
            for (const remoteRoom of activeRemoteRooms) {
                const buildersForRoom = creeps.remoteBuilder.filter(c => c.memory.targetRoom === remoteRoom.name);
                
                if (buildersForRoom.length === 0 && energyAvailable >= remoteCosts.remoteBuilder) {
                    const name = 'rbld:' + generateHexId();
                    const result = spawn.spawnCreep(bodies.remoteBuilder, name, {
                        memory: {
                            role: 'remoteBuilder',
                            targetRoom: remoteRoom.name,
                            homeRoom: room.name,
                            working: false
                        }
                    });
                    if (result === OK) {
                        console.log(`🔨 Spawning remote builder for ${remoteRoom.name} (${remoteCosts.remoteBuilder} energy)`);
                    }
                    return;
                }
            }
            
            // Spawn dedicated remote haulers (1 per remote room with 2+ sources)
            for (const remoteRoom of activeRemoteRooms) {
                if (remoteRoom.sourceIds && remoteRoom.sourceIds.length >= 2) {
                    const remoteHaulersForRoom = creeps.hauler.filter(c => c.memory.role === 'hauler' && c.memory.targetRemoteRoom === remoteRoom.name);
                    
                    if (remoteHaulersForRoom.length === 0 && energyAvailable >= bodyCosts.hauler) {
                        const name = 'rhau:' + generateHexId();
                        const result = spawn.spawnCreep(bodies.hauler, name, {
                            memory: {
                                role: 'hauler',
                                targetRemoteRoom: remoteRoom.name,
                                homeRoom: room.name,
                                assignedSource: null // Will be assigned dynamically
                            }
                        });
                        if (result === OK) {
                            console.log(`🚛 Spawning dedicated remote hauler for ${remoteRoom.name} (${bodyCosts.hauler} energy)`);
                        }
                        return;
                    }
                }
            }
        }
    }
}

// Automated population control based on throughput calculations
function getPopulationByRCL(rcl) {
    const spawn = Game.spawns[Object.keys(Game.spawns)[0]];
    if (!spawn) return { miner: 2, hauler: 1, upgrader: 1, builder: 1 };

    const room = spawn.room;
    const sources = room.find(FIND_SOURCES);

    // Use cached distance metrics instead of recalculating every tick
    const metrics = getCachedDistanceMetrics(room);
    if (!metrics) return { miner: 2, hauler: 2, upgrader: 2, builder: 1 };
    
    const avgDistance = metrics.avgDistance;
    const roundTripTime = metrics.roundTripTime;
    const carryPerHauler = metrics.carryPerHauler;

    // Total energy flow: local sources × 10 energy/tick
    let totalEnergyFlow = sources.length * 10;
    
    // Add remote harvesting energy flow
    const activeRemoteRooms = getActiveRemoteRooms();
    let remoteSourceCount = 0;
    let remoteEnergyFlow = 0;
    
    for (const remoteRoom of activeRemoteRooms) {
        if (remoteRoom.sourceIds && remoteRoom.sourceIds.length > 0) {
            // Each reserved remote source produces 10 energy/tick
            const remoteSources = remoteRoom.sourceIds.length;
            remoteSourceCount += remoteSources;
            remoteEnergyFlow += remoteSources * 10;
        }
    }
    
    totalEnergyFlow += remoteEnergyFlow;

    // Calculate hauler capacity per trip (CARRY parts × 50 energy)
    const energyPerTripPerHauler = carryPerHauler * 50;
    const haulerEfficiency = 1 / (1 + roundTripTime / 50); // Rough efficiency factor
    
    // Base haulers for local sources
    let haulersNeeded = Math.ceil((sources.length * 10) / (energyPerTripPerHauler * haulerEfficiency));
    
    // Add extra haulers for remote sources (assume 2x distance penalty)
    if (remoteSourceCount > 0) {
        const remoteHaulerEfficiency = haulerEfficiency * 0.5; // Remote rooms are typically 2x distance
        const remoteHaulers = Math.ceil(remoteEnergyFlow / (energyPerTripPerHauler * remoteHaulerEfficiency));
        haulersNeeded += remoteHaulers;
    }
    
    const minersNeeded = sources.length;

    // Adaptive scaling based on surplus energy and storage/terminal status
    const energyAvailable = room.energyAvailable;
    const energyCapacity = room.energyCapacityAvailable;
    const energyPercent = energyAvailable / energyCapacity;
    const storage = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_STORAGE })[0];
    const terminal = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TERMINAL })[0];

    let upgradersNeeded = 1;
    let buildersNeeded = 1;
    // Ensure we always respect throughput-calculated haulersNeeded as a minimum
    let haulersTarget = Math.max(1, haulersNeeded);

    if (!storage) {
        // No storage: use all energy for upgraders/haulers
        upgradersNeeded = Math.max(2, Math.floor(energyCapacity / 150));
        haulersTarget = Math.max(2, Math.floor(energyCapacity / 300));
    } else {
        // Storage exists: dynamic scaling based on surplus
        const storageEnergyPercent = storage.store[RESOURCE_ENERGY] / storage.storeCapacity;
        
        // Base upgrader count
        let baseUpgraders = 2;
        
        // Scale up upgraders aggressively when storage is filling up
        if (storageEnergyPercent > 0.8) {
            // Storage nearly full - max upgraders
            upgradersNeeded = Math.min(15, Math.floor(energyCapacity / 200) + 5);
        } else if (storageEnergyPercent > 0.5) {
            // Storage half full - increase upgraders
            upgradersNeeded = Math.max(baseUpgraders, Math.floor(energyCapacity / 200) + 2);
        } else if (storageEnergyPercent > 0.25) {
            // Storage quarter full - moderate upgraders
            upgradersNeeded = Math.max(baseUpgraders, Math.floor(energyCapacity / 250));
        } else {
            // Low storage - minimal upgraders
            upgradersNeeded = baseUpgraders;
        }
        
        // Reduce upgraders if controller is close to downgrade (emergency)
        if (room.controller.ticksToDowngrade < 10000) {
            upgradersNeeded = Math.max(upgradersNeeded, 3); // Ensure minimum when close to downgrade
        }
        
        // Reduce upgraders significantly if at RCL8 (no more leveling needed)
        if (rcl === 8 && room.controller.ticksToDowngrade > 100000) {
            upgradersNeeded = 1; // Minimal maintenance at RCL8
        }
        
        haulersTarget = Math.max(Math.max(2, Math.floor(energyCapacity / 400)), haulersNeeded);

        // If storage is full and terminal exists, prioritize selling excess
        if (terminal && storage.store[RESOURCE_ENERGY] > storage.storeCapacity * 0.95) {
            // Optionally, could spawn extra haulers to move energy to terminal
            haulersTarget += 1;
        }
    }

    // Scale builders with construction workload: 1 base, +1 per >5 sites, up to 3
    const constructionSitesCount = room.find(FIND_CONSTRUCTION_SITES).length;
    buildersNeeded = 1 + Math.min(2, Math.floor(constructionSitesCount / 5));

    const result = {
        miner: Math.max(1, minersNeeded),
        hauler: haulersTarget,
        upgrader: upgradersNeeded,
        builder: buildersNeeded
    };

    // Log throughput calculations every 100 ticks
    if (Game.time % 100 === 0) {
        const remoteSummary = remoteSourceCount > 0 ? `, ${remoteSourceCount} remote` : '';
        console.log(`📊 THROUGHPUT CALC: avgDist=${avgDistance.toFixed(1)}, Trtt=${roundTripTime.toFixed(1)}, carryNeeded=${carryPerHauler}, haulers=${result.hauler}, miners=${result.miner}`);
        console.log(`⚡ ENERGY FLOW: ${totalEnergyFlow} e/tick from ${sources.length} local${remoteSummary} sources, Room Energy: ${energyAvailable}/${energyCapacity} (${(energyPercent*100).toFixed(0)}%)`);
    }

    return result;
}

// Automated body configurations based on energy capacity and throughput calculations
function getBodiesByEnergyCapacity(energyCapacity) {
    const spawn = Game.spawns[Object.keys(Game.spawns)[0]];
    if (!spawn) {
        // Fallback for early game when no spawn exists
        return {
            miner: [WORK, WORK, MOVE],
            hauler: [CARRY, CARRY, MOVE],
            upgrader: [WORK, CARRY, MOVE],
            builder: [WORK, CARRY, MOVE]
        };
    }

    const room = spawn.room;
    
    // Use cached distance metrics instead of recalculating
    const metrics = getCachedDistanceMetrics(room);
    const carryNeeded = metrics ? metrics.carryPerHauler : Math.ceil(energyCapacity / 200);

    // Calculate optimal MOVE parts (roughly 1 MOVE per 2 CARRY for balanced ratio)
    const moveNeeded = Math.ceil(carryNeeded / 2);

    // Create hauler body with calculated CARRY/MOVE ratio
    const haulerBody = [];
    for (let i = 0; i < carryNeeded; i++) haulerBody.push(CARRY);
    for (let i = 0; i < moveNeeded; i++) haulerBody.push(MOVE);

    // Check if we can afford this hauler body, otherwise scale down
    const haulerCost = haulerBody.reduce((cost, part) => cost + (part === CARRY ? 50 : 50), 0);
    let affordableHaulerBody = haulerBody;

    if (haulerCost > energyCapacity) {
        // Scale down hauler body to fit energy capacity
        const maxParts = Math.floor(energyCapacity / 50); // Each part costs 50 energy
        const carryParts = Math.max(1, Math.floor(maxParts * 0.6)); // 60% CARRY
        const moveParts = Math.max(1, maxParts - carryParts); // Rest MOVE

        affordableHaulerBody = [];
        for (let i = 0; i < carryParts; i++) affordableHaulerBody.push(CARRY);
        for (let i = 0; i < moveParts; i++) affordableHaulerBody.push(MOVE);
    }

    if (energyCapacity >= 1800) { // RCL 6+
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: affordableHaulerBody, // Throughput-calculated
            upgrader: [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], // 10W3C3M
            builder: [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE], // 7W5C4M
            scout: [MOVE, MOVE, MOVE], // 3M - 150 energy (fast scouting)
            reserver: [CLAIM, CLAIM, MOVE, MOVE], // 2CLAIM 2M - 1300 energy
            remoteMiner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M - same as local miner
            remoteBuilder: [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE] // 3W3C6M - mobile
        };
    } else if (energyCapacity >= 1300) { // RCL 5
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: affordableHaulerBody, // Throughput-calculated
            upgrader: [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE], // 7W2C2M
            builder: [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], // 5W4C3M
            scout: [MOVE, MOVE, MOVE], // 3M - 150 energy
            reserver: [CLAIM, CLAIM, MOVE, MOVE], // 2CLAIM 2M
            remoteMiner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            remoteBuilder: [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE] // 3W3C6M
        };
    } else if (energyCapacity >= 800) { // RCL 4
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: affordableHaulerBody, // Throughput-calculated
            upgrader: [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE], // 5W2C1M
            builder: [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE], // 4W3C2M
            scout: [MOVE, MOVE, MOVE], // 3M - 150 energy
            reserver: [CLAIM, CLAIM, MOVE, MOVE], // 2CLAIM 2M - 1300 energy (need to save up)
            remoteMiner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M - 550 energy
            remoteBuilder: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE] // 2W2C4M - 500 energy
        };
    } else if (energyCapacity >= 550) { // RCL 3
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: affordableHaulerBody, // Throughput-calculated
            upgrader: [WORK, WORK, WORK, WORK, CARRY, MOVE], // 4W1C1M
            builder: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], // 3W2C3M
            reserver: [CLAIM, MOVE], // 1CLAIM 1M - no remote harvesting yet at RCL 3
            remoteMiner: [WORK, WORK, MOVE], // 2W1M - minimal
            remoteBuilder: [WORK, CARRY, MOVE, MOVE] // 1W1C2M - minimal
        };
    } else { // RCL 1-2
        return {
            miner: [WORK, WORK, MOVE], // 2W1M - only 250 energy
            hauler: affordableHaulerBody.length > 0 ? affordableHaulerBody : [CARRY, CARRY, MOVE], // Throughput-calculated or fallback
            upgrader: [WORK, CARRY, MOVE], // 1W1C1M
            builder: [WORK, CARRY, MOVE], // 1W1C1M
            reserver: [CLAIM, MOVE], // 1CLAIM 1M - no remote harvesting at RCL 1-2
            remoteMiner: [WORK, MOVE], // 1W1M - minimal
            remoteBuilder: [WORK, CARRY, MOVE] // 1W1C1M - minimal
        };
    }
}

// Create construction sites for planned structures that don't exist
function createMissingConstructionSites(room) {
    if (!room.memory.plannedStructures) return;
    
    const rcl = room.controller.level;
    
    // Limit construction sites to avoid spam - reduce limit when building roads
    const existingConstructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
    const roadSites = room.find(FIND_CONSTRUCTION_SITES, {
        filter: s => s.structureType === STRUCTURE_ROAD
    }).length;
    
    // If we're building mostly roads, be more conservative with construction sites
    const maxSites = roadSites > existingConstructionSites * 0.8 ? 8 : 15;
    if (existingConstructionSites >= maxSites) return;
    
    // Filter structures by current RCL to avoid error spam
    const allowedStructures = getAllowedStructuresByRCL(rcl);
    
    // Count existing structures by type
    const existingStructures = {};
    room.find(FIND_STRUCTURES).forEach(structure => {
        existingStructures[structure.structureType] = (existingStructures[structure.structureType] || 0) + 1;
    });
    
    // Count construction sites by type
    const constructionSites = {};
    room.find(FIND_CONSTRUCTION_SITES).forEach(site => {
        constructionSites[site.structureType] = (constructionSites[site.structureType] || 0) + 1;
    });
    
    // Sort planned structures by priority, with extensions sorted by distance to spawn
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const sortedPlannedStructures = [...room.memory.plannedStructures].sort((a, b) => {
        // At RCL 4+, prioritize storage for remote harvesting
        const isRCL4Plus = rcl >= 4;
        
        // Priority order for structure types
        let priorityOrder;
        if (isRCL4Plus) {
            // At RCL 4+, storage is critical for remote harvesting - prioritize it!
            priorityOrder = [
                STRUCTURE_STORAGE,     // TOP PRIORITY at RCL 4+ for remote energy
                STRUCTURE_EXTENSION,
                STRUCTURE_SPAWN,
                STRUCTURE_TOWER,
                STRUCTURE_CONTAINER,
                STRUCTURE_WALL,
                STRUCTURE_ROAD,
                STRUCTURE_LINK,
                STRUCTURE_TERMINAL
            ];
        } else {
            // Before RCL 4, extensions are most important
            priorityOrder = [
            STRUCTURE_EXTENSION,
            STRUCTURE_SPAWN,
            STRUCTURE_STORAGE,
            STRUCTURE_TOWER,
            STRUCTURE_CONTAINER,
            STRUCTURE_WALL,
            STRUCTURE_ROAD,
            STRUCTURE_LINK,
            STRUCTURE_TERMINAL
        ];
        }
        
        const aPriority = priorityOrder.indexOf(a.type);
        const bPriority = priorityOrder.indexOf(b.type);
        
        // If same structure type and it's an extension, sort by distance to spawn
        if (a.type === b.type && a.type === STRUCTURE_EXTENSION && spawn) {
            const distA = spawn.pos.getRangeTo(a.x, a.y);
            const distB = spawn.pos.getRangeTo(b.x, b.y);
            return distA - distB;
        }
        
        // Otherwise sort by structure priority
        if (aPriority !== -1 && bPriority !== -1) {
            return aPriority - bPriority;
        }
        
        // If one structure is not in priority list, put it at the end
        if (aPriority === -1 && bPriority !== -1) return 1;
        if (aPriority !== -1 && bPriority === -1) return -1;
        
        return 0; // Same priority
    });
    
    let created = 0;
    let totalPlanned = 0;
    let extensionsCreated = 0;
    let roadsSkipped = 0;
    const createdByType = {};
    
    // Count existing important structures to determine if we should build roads yet
    const existingExtensions = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION
    }).length;
    const existingContainers = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
    }).length;
    
    // Only build roads after we have some essential structures
    const shouldBuildRoads = existingExtensions >= 5 && existingContainers >= 1;
    
    for (const planned of sortedPlannedStructures) {
        totalPlanned++;
        
        // Skip structures not allowed at current RCL
        if (!allowedStructures.includes(planned.type)) {
            continue;
        }

        // Extensions are allowed per RCL limits (no extra gating here)
        // Check if we're already at the limit for this structure type
        const currentCount = (existingStructures[planned.type] || 0) + (constructionSites[planned.type] || 0);
        const maxAllowed = getMaxStructuresByRCL(rcl, planned.type);
        if (currentCount >= maxAllowed) {
            continue; // Already at limit, skip this structure
        }

        // Skip roads until we have essential structures built
        if (planned.type === STRUCTURE_ROAD && !shouldBuildRoads) {
            roadsSkipped++;
            continue;
        }
        
        const pos = new RoomPosition(planned.x, planned.y, room.name);
        const structures = pos.lookFor(LOOK_STRUCTURES);
        const constructionSitesAtPos = pos.lookFor(LOOK_CONSTRUCTION_SITES);
        
    // Check if structure or construction site already exists
    const hasStructure = structures.some(s => s.structureType === planned.type);
    const hasConstructionSite = constructionSitesAtPos.some(c => c.structureType === planned.type);

        if (!hasStructure && !hasConstructionSite) {
            const result = room.createConstructionSite(pos.x, pos.y, planned.type);
            if (result === OK) {
                created++;
                createdByType[planned.type] = (createdByType[planned.type] || 0) + 1;
                if (planned.type === STRUCTURE_EXTENSION) {
                    extensionsCreated++;
                }
                // Special message for storage at RCL 4+ (critical for remote harvesting)
                if (planned.type === STRUCTURE_STORAGE && rcl >= 4) {
                    console.log(`📦 PRIORITY: Storage construction site created for remote harvesting energy!`);
                }
            } else if (result !== ERR_RCL_NOT_ENOUGH) {
                // Only log unexpected failures (not RCL gating)
                console.log(`❌ Failed to create ${planned.type} at (${pos.x},${pos.y}): ${result}`);
            }
        }

        // Limit total construction sites, but allow more extensions
        if (created >= 10 && extensionsCreated >= 5) break;
    }
    
    if (created > 0) {
        const parts = [];
        for (const t in createdByType) {
            const short = t.toString().replace('structure_', '').toLowerCase();
            parts.push(`${createdByType[t]} ${short}`);
        }
        console.log(`🏗️ Created ${created} construction sites (${parts.join(', ')})`);
    }
    if (roadsSkipped > 0) {
        console.log(`🛣️ Skipped ${roadsSkipped} roads - building extensions first (need ${Math.max(0, 5 - existingExtensions)} more extensions and ${Math.max(0, 1 - existingContainers)} more containers)`);
    }
    
    // Log structure limits for debugging
    const extensionLimit = getMaxStructuresByRCL(rcl, STRUCTURE_EXTENSION);
    const currentExtensions = existingStructures[STRUCTURE_EXTENSION] || 0;
    const extensionSites = constructionSites[STRUCTURE_EXTENSION] || 0;
    console.log(`📊 Total planned structures: ${totalPlanned}, RCL ${rcl} allows: ${allowedStructures.join(', ')}`);
    console.log(`🏗️ Extensions: ${currentExtensions} built + ${extensionSites} sites = ${currentExtensions + extensionSites}/${extensionLimit} allowed`);
}

// Helper function: Get maximum allowed structures by RCL and type
function getMaxStructuresByRCL(rcl, structureType) {
    const limits = {
        [STRUCTURE_EXTENSION]: [0, 5, 10, 20, 30, 40, 50, 60, 60][rcl] || 0,
        [STRUCTURE_ROAD]: 2500, // Effectively unlimited for our purposes
        [STRUCTURE_CONTAINER]: [0, 5, 5, 5, 5, 5, 5, 5, 5][rcl] || 0,
        [STRUCTURE_WALL]: [0, 0, 3000, 3000, 3000, 3000, 3000, 3000, 3000][rcl] || 0,
        [STRUCTURE_RAMPART]: [0, 0, 3000, 3000, 3000, 3000, 3000, 3000, 3000][rcl] || 0,
        [STRUCTURE_TOWER]: [0, 0, 0, 1, 1, 2, 2, 3, 6][rcl] || 0,
        [STRUCTURE_STORAGE]: [0, 0, 0, 0, 1, 1, 1, 1, 1][rcl] || 0,
        [STRUCTURE_LINK]: [0, 0, 0, 0, 0, 2, 3, 4, 6][rcl] || 0,
        [STRUCTURE_TERMINAL]: [0, 0, 0, 0, 0, 0, 0, 0, 1][rcl] || 0,
        [STRUCTURE_SPAWN]: [1, 1, 1, 1, 1, 1, 1, 2, 3][rcl] || 0
    };
    
    return limits[structureType] || 0;
}

// Helper function: Get allowed structures by RCL to prevent construction errors
function getAllowedStructuresByRCL(rcl) {
    const baseStructures = [STRUCTURE_ROAD, STRUCTURE_CONTAINER, STRUCTURE_EXTENSION];
    
    switch (rcl) {
        case 1:
            return [...baseStructures];
        case 2:
            return [...baseStructures, STRUCTURE_WALL, STRUCTURE_RAMPART];
        case 3:
            return [...baseStructures, STRUCTURE_WALL, STRUCTURE_RAMPART, STRUCTURE_TOWER];
        case 4:
            return [...baseStructures, STRUCTURE_WALL, STRUCTURE_RAMPART, STRUCTURE_TOWER, STRUCTURE_STORAGE];
        case 5:
            return [...baseStructures, STRUCTURE_WALL, STRUCTURE_RAMPART, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_LINK];
        case 6:
            return [...baseStructures, STRUCTURE_WALL, STRUCTURE_RAMPART, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_LINK, STRUCTURE_EXTRACTOR, STRUCTURE_LAB];
        case 7:
            return [...baseStructures, STRUCTURE_WALL, STRUCTURE_RAMPART, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_LINK, STRUCTURE_EXTRACTOR, STRUCTURE_LAB, STRUCTURE_FACTORY];
        case 8:
            return [...baseStructures, STRUCTURE_WALL, STRUCTURE_RAMPART, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_LINK, STRUCTURE_EXTRACTOR, STRUCTURE_LAB, STRUCTURE_FACTORY, STRUCTURE_TERMINAL, STRUCTURE_OBSERVER, STRUCTURE_POWER_SPAWN, STRUCTURE_NUKER];
        default:
            return baseStructures;
    }
}

// Clean status dashboard
function displayStatusDashboard(room, creeps) {
    const rcl = room.controller.level;
    const progress = room.controller.progress;
    const progressTotal = room.controller.progressTotal;
    const energyAvailable = room.energyAvailable;
    const energyCapacity = room.energyCapacityAvailable;
    const sources = room.find(FIND_SOURCES);
    
    // Calculate progress percentage
    const progressPercent = ((progress / progressTotal) * 100).toFixed(1);
    
    // Count construction sites
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
    
    // Calculate energy flow (miners should be generating ~10 energy/tick per source)
    const expectedEnergyPerTick = sources.length * 10;
    
    // Check hauler efficiency (are they moving energy?)
    const busyHaulers = creeps.hauler.filter(h => h.store[RESOURCE_ENERGY] > 0).length;
    const idleHaulers = creeps.hauler.length - busyHaulers;
    
    // Check ground energy accumulation at sources
    let totalGroundEnergy = 0;
    let maxGroundAtSource = 0;
    const sourceEnergyData = [];
    
    sources.forEach(source => {
        const totalSourceEnergy = getTotalSourceEnergy(room, source);
        const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
            filter: (resource) => resource.resourceType === RESOURCE_ENERGY && 
                                resource.pos.getRangeTo(source) <= 3
        });
        const groundEnergy = droppedEnergy.reduce((sum, drop) => sum + drop.amount, 0);
        
        totalGroundEnergy += groundEnergy;
        if (groundEnergy > maxGroundAtSource) {
            maxGroundAtSource = groundEnergy;
        }
        
        sourceEnergyData.push({
            id: source.id.substr(-4),
            total: totalSourceEnergy,
            ground: groundEnergy,
            assignedCreeps: _.filter(Game.creeps, c => 
                (c.memory.role === 'hauler' || c.memory.role === 'builder' || c.memory.role === 'upgrader') &&
                c.memory.assignedSource === source.id
            ).length
        });
    });
    
    console.log(`\n=== BASE STATUS RCL ${rcl} ===`);
    console.log(`Controller: ${progress}/${progressTotal} (${progressPercent}%) - ${progressTotal - progress} to next RCL`);
    console.log(`Energy: ${energyAvailable}/${energyCapacity} (${((energyAvailable/energyCapacity)*100).toFixed(0)}%)`);
    console.log(`Expected Flow: ${expectedEnergyPerTick} energy/tick from ${sources.length} sources`);
    
    console.log(`\n--- POPULATION ---`);
    const targets = getPopulationByRCL(rcl);
    console.log(`Miners: ${creeps.miner.length}/${targets.miner} | Haulers: ${creeps.hauler.length}/${targets.hauler} (${busyHaulers} busy, ${idleHaulers} idle)`);
    console.log(`Upgraders: ${creeps.upgrader.length}/${targets.upgrader} | Builders: ${creeps.builder.length}/${targets.builder}`);
    
    // Show energy distribution across sources
    if (totalGroundEnergy > 100) {
        console.log(`\n⚠️  GROUND ENERGY: ${totalGroundEnergy} total (max ${maxGroundAtSource} at one source)`);
    }
    sourceEnergyData.forEach(data => {
        const groundIndicator = data.ground > 100 ? `⚠️${data.ground}ground ` : '';
        console.log(`Source ${data.id}: ${data.total}e total, ${data.assignedCreeps} creeps ${groundIndicator}`);
    });
    
    if (constructionSites > 0) {
        console.log(`\n--- CONSTRUCTION ---`);
        console.log(`${constructionSites} sites remaining`);
        
        // Show what's being built
        const sites = room.find(FIND_CONSTRUCTION_SITES);
        const siteTypes = {};
        sites.forEach(site => {
            siteTypes[site.structureType] = (siteTypes[site.structureType] || 0) + 1;
        });
        const siteList = Object.entries(siteTypes).map(([type, count]) => `${count}x ${type}`).join(', ');
        console.log(`Building: ${siteList}`);
    }
    
    // Show any issues
    const issues = [];
    if (creeps.miner.length < targets.miner) issues.push('Need more miners');
    if (idleHaulers === creeps.hauler.length && creeps.hauler.length > 0) issues.push('All haulers idle');
    if (energyAvailable < energyCapacity * 0.3) issues.push('Low energy reserves');
    
    if (issues.length > 0) {
        console.log(`\n⚠️  ISSUES: ${issues.join(', ')}`);
    }
    
    console.log('========================\n');
}

// Base plan visualization - shows planned structures with color coding
function visualizeBasePlan(room) {
    if (!room.memory.plannedStructures || !room.memory.baseCenter) return;
    
    const visual = room.visual;
    const anchor = room.memory.baseCenter;
    
    // Color scheme for different structure types
    const structureColors = {
        [STRUCTURE_SPAWN]: '#FFFFFF',
        [STRUCTURE_EXTENSION]: '#FFE56D',
        [STRUCTURE_STORAGE]: '#FF6B6B',
        [STRUCTURE_CONTAINER]: '#4ECDC4',
        [STRUCTURE_TOWER]: '#FF8E53',
        [STRUCTURE_ROAD]: '#555555',
        [STRUCTURE_LINK]: '#9B59B6',
    [STRUCTURE_TERMINAL]: '#2287e6ff',
        [STRUCTURE_WALL]: '#95A5A6',
        [STRUCTURE_RAMPART]: '#2ecc71'
    };
            
    // Visualize planned structures
    // 1. Base planning visualization (planned structures)
    room.memory.plannedStructures.forEach(planned => {
        const color = structureColors[planned.type] || '#fff';
        const pos = new RoomPosition(planned.x, planned.y, room.name);
        visual.circle(pos.x, pos.y, {radius:0.45,fill:color,opacity:0.35,stroke:color});
        visual.text(planned.type.replace('structure_','').substr(0,2).toUpperCase(), pos.x, pos.y, {color:'#222',font:0.5});
    });

    // 2. Energy/Controller overlays
    // Sources: show container + ground energy, renewal timer
    const sources = room.find(FIND_SOURCES);
    sources.forEach(source => {
        const container = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && s.pos.getRangeTo(source) <= 2
        })[0];
        const dropped = room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.pos.getRangeTo(source) <= 3
        });
        const groundAmount = dropped.reduce((sum, r) => sum + r.amount, 0);
        const containerAmount = container ? (container.store[RESOURCE_ENERGY] || 0) : 0;
        const ticksToRenew = source.ticksToRegeneration || 0;
        visual.text(`S:${source.id.substr(-4)}`, source.pos.x, source.pos.y - 1.2, {color:'#ffe56d',font:0.5});
        visual.text(`C:${containerAmount}`, source.pos.x, source.pos.y - 0.7, {color:'#4ecdc4',font:0.4});
        visual.text(`G:${groundAmount}`, source.pos.x, source.pos.y - 0.3, {color:'#ff6b6b',font:0.4});
        visual.text(`Renew:${ticksToRenew}`, source.pos.x, source.pos.y + 0.2, {color:'#aaa',font:0.35});
    });

    // Upgrade container: show energy
    const controller = room.controller;
    const upgradeContainer = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER && controller && s.pos.getRangeTo(controller) <= 3
    })[0];
    if (upgradeContainer) {
        visual.text(`Upgrade:${upgradeContainer.store[RESOURCE_ENERGY]||0}`, upgradeContainer.pos.x, upgradeContainer.pos.y + 0.7, {color:'#4ecdc4',font:0.45});
    }

    // Controller: show progress and %
    if (controller) {
        const percent = ((controller.progress/controller.progressTotal)*100).toFixed(1);
        visual.text(`RCL:${controller.level}`, controller.pos.x, controller.pos.y - 1.2, {color:'#fff',font:0.5});
        visual.text(`Progress:${controller.progress}/${controller.progressTotal}`, controller.pos.x, controller.pos.y - 0.7, {color:'#ffe56d',font:0.4});
        visual.text(`${percent}%`, controller.pos.x, controller.pos.y - 0.3, {color:'#4ecdc4',font:0.45});
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
        case 'scout':
            runScout(creep);
            break;
        case 'reserver':
            runReserver(creep);
            break;
        case 'remoteMiner':
            runRemoteMiner(creep);
            break;
        case 'remoteBuilder':
            runRemoteBuilder(creep);
            break;
    }
}

function runTowers(room) {
    // Find all towers in the room
    const towers = room.find(FIND_MY_STRUCTURES, {
        filter: (structure) => structure.structureType === STRUCTURE_TOWER
    });

    if (towers.length === 0) return; // No towers to operate

    // Find hostile creeps in the room
    const hostiles = room.find(FIND_HOSTILE_CREEPS);

    if (hostiles.length > 0) {
        console.log(`🚨 ${hostiles.length} hostile creep(s) detected! Activating tower defense.`);

        // Sort hostiles by distance to spawn (prioritize threats near base)
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (spawn) {
            hostiles.sort((a, b) => spawn.pos.getRangeTo(a) - spawn.pos.getRangeTo(b));
        }

        // Command each tower to attack the closest hostile
        towers.forEach((tower, index) => {
            if (index < hostiles.length) {
                const target = hostiles[index];
                const attackResult = tower.attack(target);
                if (attackResult === OK) {
                    console.log(`🏹 Tower at (${tower.pos.x},${tower.pos.y}) attacking hostile ${target.name} (${target.owner.username})`);
                } else {
                    console.log(`❌ Tower attack failed: ${attackResult}`);
                }
            }
        });
    } else {
        // No hostiles - check for injured creeps first
        const injuredCreeps = room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.hits < creep.hitsMax
        });

        if (injuredCreeps.length > 0) {
            // Heal injured creeps
            towers.forEach(tower => {
                // Heal the most injured creep
                const target = _.min(injuredCreeps, creep => creep.hits / creep.hitsMax);
                const healResult = tower.heal(target);
                if (healResult === OK) {
                    console.log(`💚 Tower healing injured creep ${target.name}`);
                }
            });
        } else {
            // No hostiles or injured creeps - repair damaged structures
            const structuresNeedingRepair = getStructuresNeedingRepair(room);

            if (structuresNeedingRepair.length > 0) {
                towers.forEach(tower => {
                    // Find the most damaged structure within range
                    const target = tower.pos.findClosestByRange(structuresNeedingRepair);
                    if (target) {
                        const rcl = room.controller.level;
                        const wallTarget = WALL_TARGET_HITS[rcl] || WALL_TARGET_HITS[1];
                        const rampartTarget = RAMPART_TARGET_HITS[rcl] || RAMPART_TARGET_HITS[1];

                        // Skip repairs if target already meets configured thresholds
                        if (target.structureType === STRUCTURE_WALL && target.hits >= wallTarget) return;
                        if (target.structureType === STRUCTURE_RAMPART && target.hits >= rampartTarget) return;

                        const repairResult = tower.repair(target);
                        if (repairResult === OK) {
                            const structureType = target.structureType === STRUCTURE_WALL ? 'wall' : 
                                                target.structureType === STRUCTURE_RAMPART ? 'rampart' : 
                                                target.structureType;
                            console.log(`🔧 Tower repairing ${structureType} at (${target.pos.x},${target.pos.y}) - ${target.hits}/${target.hitsMax} hits`);
                        } else {
                            console.log(`❌ Tower repair failed: ${repairResult}`);
                        }
                    }
                });
            }
        }
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
            if (source) {
                creep.memory.sourceId = source.id;
                console.log(`WARNING: ${creep.name} forced to share source ${source.id} - check population targets`);
            } else {
                console.log(`ERROR: ${creep.name} cannot find any accessible source`);
                return;
            }
        }
    }
  
    if (!source) return;
    
    // Find container adjacent to this source (MUST be range 1 for harvesting)
    const container = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            return structure.structureType === STRUCTURE_CONTAINER &&
                   structure.pos.getRangeTo(source) === 1; // Exact range check
        }
    })[0];

    if (container) {
        // Valid adjacent container found - move to it and harvest
        if (creep.pos.isEqualTo(container.pos)) {
            // We're on the container, harvest the source
            const harvestResult = creep.harvest(source);
            if (harvestResult === ERR_NOT_ENOUGH_RESOURCES) {
                // Source is depleted, wait on container
                creep.say('⏸️');
            } else if (harvestResult !== OK && harvestResult !== ERR_BUSY) {
                console.log(`⚠️ ${creep.name}: Harvest error ${harvestResult} at source ${source.id}`);
            }
        } else {
            // Move to the valid container
            creep.moveTo(container.pos, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
    } else {
        // No valid adjacent container - check if there's a badly placed one we should warn about
        const badContainer = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return structure.structureType === STRUCTURE_CONTAINER &&
                       structure.pos.getRangeTo(source) <= 3; // Within 3 tiles but not adjacent
            }
        })[0];
        
        if (badContainer && Game.time % 100 === 0) {
            console.log(`⚠️ Container at ${badContainer.pos} is not adjacent to source ${source.id}! Miners will harvest without it.`);
        }
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
    
    // Check if this is a dedicated remote hauler
    const isRemoteHauler = creep.memory.targetRemoteRoom;
    
    if (isRemoteHauler) {
        runRemoteHauler(creep);
        return;
    }
    
    // If carrying energy, find a sink to deliver to
    if (creep.store[RESOURCE_ENERGY] > 0) {
        // Check if we're in a remote room - if so, go home first
        if (!creep.memory.homeRoom) {
            creep.memory.homeRoom = creep.room.name;
        }
        
        const homeRoom = creep.memory.homeRoom;
        if (creep.room.name !== homeRoom) {
            // We're in a remote room - go home to deliver
            const exitDir = creep.room.findExitTo(homeRoom);
            const exit = creep.pos.findClosestByPath(exitDir);
            if (exit) {
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }
        
        const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
        
        // Find all potential targets
        // Determine if there are hostiles present — if so, towers become high-priority targets
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
        const spawnTargets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                // Extensions and spawns always count if they need energy
                if (structure.structureType === STRUCTURE_EXTENSION || structure.structureType === STRUCTURE_SPAWN) {
                    return structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }

                // Towers: only refill if below threshold or hostiles are present
                if (structure.structureType === STRUCTURE_TOWER) {
                    const towerEnergyFrac = (structure.store[RESOURCE_ENERGY] || 0) / (structure.storeCapacity || 1000);
                    if (hostiles.length > 0) return structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    return towerEnergyFrac < TOWER_REFILL_THRESHOLD && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }

                return false;
            }
        });
        
        // Find source positions to identify source containers
        const sources = creep.room.find(FIND_SOURCES);
        const controller = creep.room.controller;
        
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
                return true; // This is a non-source container (like near spawn or controller)
            }
        });
        
        // Find controller container specifically (for early game when storage isn't built yet)
        const controllerContainers = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                if (structure.structureType !== STRUCTURE_CONTAINER || structure.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
                    return false;
                }
                // Only controller containers (near controller, not near sources)
                if (controller && structure.pos.getRangeTo(controller) <= 3) {
                    // Make sure it's not a source container
                    for (const source of sources) {
                        if (structure.pos.getRangeTo(source) <= 2) {
                            return false; // This is a source container
                        }
                    }
                    return true; // This is a controller container
                }
                return false;
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
        // Priority 2: Controller containers (keep upgraders supplied)
        else if (controllerContainers.length > 0) {
            target = creep.pos.findClosestByPath(controllerContainers);
        }
        // Priority 3: Storage (if available)
        else if (storage.length > 0) {
            target = creep.pos.findClosestByPath(storage);
        }
        // Priority 4: Other containers (like near spawn)
        else if (containers.length > 0) {
            target = creep.pos.findClosestByPath(containers);
        }
        
        if (target) {
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    } else {
        // Pick up energy from source containers or dropped energy
        // Priority: local sources > remote sources
        
        // Store home room name
        if (!creep.memory.homeRoom) {
            creep.memory.homeRoom = creep.room.name;
        }
        
        const homeRoomName = creep.memory.homeRoom;
        const isInHomeRoom = (creep.room.name === homeRoomName);
        
        // If in home room, check local sources first, then consider going to remote rooms
        if (isInHomeRoom) {
        const sources = creep.room.find(FIND_SOURCES);
        
            // First try to find source containers with energy in home room
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

            // Check if local containers have meaningful energy (> 400 - let them build up for efficient hauler trips)
            const localContainersWithEnergy = sourceContainers.filter(c => c.store[RESOURCE_ENERGY] > 400);
            
            if (localContainersWithEnergy.length > 0) {
                // Use enhanced distribution system
                const energySource = getDistributedEnergyContainer(creep, localContainersWithEnergy);
            
            if (energySource && energySource.target) {
                let result;
                if (energySource.actionType === 'pickup') {
                    result = creep.pickup(energySource.target);
                } else {
                    result = creep.withdraw(energySource.target, RESOURCE_ENERGY);
                }
                
                if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(energySource.target, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            } else {
                // No energy in local containers (or low energy) - check remote rooms
                const activeRemoteRooms = getActiveRemoteRooms();
                
                if (activeRemoteRooms.length > 0) {
                    // Find a remote room with energy available (containers or dropped)
                    let bestRemoteTarget = null;
                    let bestAmount = 0;
                    
                    for (const remoteRoomData of activeRemoteRooms) {
                        const remoteRoom = Game.rooms[remoteRoomData.name];
                        if (!remoteRoom) continue; // No vision
                        
                        const remoteSources = remoteRoom.find(FIND_SOURCES);
                        
                        // Check containers
                        const remoteContainers = remoteRoom.find(FIND_STRUCTURES, {
                            filter: (structure) => {
                                if (structure.structureType !== STRUCTURE_CONTAINER || structure.store[RESOURCE_ENERGY] <= 400) {
                                    return false;
                                }
                                // Only pick up from source containers
                                for (const source of remoteSources) {
                                    if (structure.pos.getRangeTo(source) <= 2) {
                                        return true;
                                    }
                                }
                                return false;
                            }
                        });
                        
                        for (const container of remoteContainers) {
                            if (container.store[RESOURCE_ENERGY] > bestAmount) {
                                bestAmount = container.store[RESOURCE_ENERGY];
                                bestRemoteTarget = container;
                            }
                        }
                        
                        // Also check dropped energy near sources (if no containers or low amounts)
                        const droppedEnergy = remoteRoom.find(FIND_DROPPED_RESOURCES, {
                            filter: (resource) => {
                                if (resource.resourceType !== RESOURCE_ENERGY || resource.amount < 200) {
                                    return false;
                                }
                                // Only near sources
                                for (const source of remoteSources) {
                                    if (resource.pos.getRangeTo(source) <= 3) {
                                        return true;
                                    }
                                }
                                return false;
                            }
                        });
                        
                        for (const dropped of droppedEnergy) {
                            if (dropped.amount > bestAmount) {
                                bestAmount = dropped.amount;
                                bestRemoteTarget = dropped;
                            }
                        }
                    }
                    
                    if (bestRemoteTarget) {
                        // Go to remote room to collect energy
                        creep.memory.targetRemoteContainer = bestRemoteTarget.id;
                        const exitDir = creep.room.findExitTo(bestRemoteTarget.room.name);
                        const exit = creep.pos.findClosestByPath(exitDir);
                        if (exit) {
                            creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            }
        } else {
            // No remote rooms, check for dropped energy in home room
            const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
                filter: (resource) => {
                    return resource.resourceType === RESOURCE_ENERGY && resource.amount >= 50;
                }
            });
            
            if (droppedEnergy.length > 0) {
                        const target = creep.pos.findClosestByPath(droppedEnergy);
                        if (target && creep.pickup(target) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                        }
                    }
                }
            }
        } else {
            // In a remote room - collect energy and return home
            const targetContainerId = creep.memory.targetRemoteContainer;
            
            if (targetContainerId) {
                const target = Game.getObjectById(targetContainerId);
                
                if (target) {
                    let result;
                    let hasEnergy = false;
                    
                    // Check if it's a container or dropped resource
                    if (target.structureType === STRUCTURE_CONTAINER) {
                        hasEnergy = target.store[RESOURCE_ENERGY] > 0;
                        if (hasEnergy) {
                            result = creep.withdraw(target, RESOURCE_ENERGY);
                        }
                    } else if (target.resourceType === RESOURCE_ENERGY) {
                        // It's dropped energy
                        hasEnergy = target.amount > 0;
                        if (hasEnergy) {
                            result = creep.pickup(target);
                        }
                    }
                    
                    if (hasEnergy) {
                        if (result === ERR_NOT_IN_RANGE) {
                            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                        } else if (result === OK) {
                            // Successfully collected, clear target
                            delete creep.memory.targetRemoteContainer;
                        }
                    } else {
                        // Target is empty, return home
                        delete creep.memory.targetRemoteContainer;
                        const exitDir = creep.room.findExitTo(homeRoomName);
                        const exit = creep.pos.findClosestByPath(exitDir);
                        if (exit) {
                            creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' } });
                        }
                    }
                } else {
                    // Target doesn't exist anymore, return home
                    delete creep.memory.targetRemoteContainer;
                    const exitDir = creep.room.findExitTo(homeRoomName);
                    const exit = creep.pos.findClosestByPath(exitDir);
                    if (exit) {
                        creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                }
            } else {
                // No target, look for any energy source in this room (containers or dropped)
                const sources = creep.room.find(FIND_SOURCES);
                const sourceContainers = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        if (structure.structureType !== STRUCTURE_CONTAINER || structure.store[RESOURCE_ENERGY] <= 0) {
                            return false;
                        }
                        for (const source of sources) {
                            if (structure.pos.getRangeTo(source) <= 2) {
                                return true;
                            }
                        }
                        return false;
                    }
                });
                
                const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
                    filter: (resource) => {
                        if (resource.resourceType !== RESOURCE_ENERGY || resource.amount < 50) {
                            return false;
                        }
                        for (const source of sources) {
                            if (resource.pos.getRangeTo(source) <= 3) {
                                return true;
                            }
                        }
                        return false;
                    }
                });
                
                if (sourceContainers.length > 0) {
                    const target = creep.pos.findClosestByPath(sourceContainers);
                    if (target) {
                        if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                        } else {
                            delete creep.memory.targetRemoteContainer;
                        }
                    }
                } else if (droppedEnergy.length > 0) {
                    const target = creep.pos.findClosestByPath(droppedEnergy);
                    if (target) {
                        if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
            } else {
                            delete creep.memory.targetRemoteContainer;
                        }
                    }
                } else {
                    // No energy available, return home
                    delete creep.memory.targetRemoteContainer;
                    const exitDir = creep.room.findExitTo(homeRoomName);
                    const exit = creep.pos.findClosestByPath(exitDir);
                    if (exit) {
                        creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                }
            }
        }
    }
}

// Scout logic - explores adjacent rooms for remote harvesting
function runScout(creep) {
    const homeRoom = creep.memory.homeRoom;
    const targetRoom = creep.memory.targetRoom;
    const scoutedRooms = creep.memory.scoutedRooms || [];
    
    // If no target room assigned, get one from the scout queue
    if (!targetRoom) {
        const adjacentRooms = getAdjacentRoomNames(homeRoom);
        const unscoutedRooms = adjacentRooms.filter(roomName => !scoutedRooms.includes(roomName));
        
        // Filter out unreachable rooms and temporarily blocked rooms
        const reachableRooms = [];
        const blockedRooms = creep.memory.blockedRooms || {};
        
        for (const roomName of unscoutedRooms) {
            // Check if this room was recently blocked (within last 1000 ticks)
            if (blockedRooms[roomName] && (Game.time - blockedRooms[roomName]) < 1000) {
                console.log(`🚫 Scout ${creep.name} skipping temporarily blocked room ${roomName} (spawn area)`);
                continue;
            }
            
            const exitDir = creep.room.findExitTo(roomName);
            if (exitDir !== ERR_NO_PATH && exitDir !== ERR_INVALID_ARGS) {
                reachableRooms.push(roomName);
            } else {
                // Mark unreachable rooms as "scouted" so we don't try again
                scoutedRooms.push(roomName);
                creep.memory.scoutedRooms = scoutedRooms;
                console.log(`🚫 Scout ${creep.name} skipping permanently unreachable room ${roomName}`);
            }
        }
        
        if (reachableRooms.length > 0) {
            // Assign first reachable unscouted room
            creep.memory.targetRoom = reachableRooms[0];
            console.log(`🔍 Scout ${creep.name} assigned to explore ${reachableRooms[0]} (${reachableRooms.length} reachable rooms remaining)`);
        } else {
            // All rooms scouted, scout can be recycled
            const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
            if (spawn && creep.pos.isNearTo(spawn)) {
                spawn.recycleCreep(creep);
                console.log(`♻️ Scout ${creep.name} recycled - all rooms explored`);
            } else if (spawn) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }
    }
    
    // Move to target room
    if (creep.room.name !== creep.memory.targetRoom) {
        // Track how long we've been trying to reach this room
        if (!creep.memory.targetStartTime) {
            creep.memory.targetStartTime = Game.time;
        }
        
        // If we've been trying for more than 100 ticks, this room is probably blocked
        if (Game.time - creep.memory.targetStartTime > 100) {
            console.log(`🚫 Scout ${creep.name} timeout trying to reach ${creep.memory.targetRoom} - marking as temporarily blocked`);
            
            // Mark room as temporarily blocked
            const blockedRooms = creep.memory.blockedRooms || {};
            blockedRooms[creep.memory.targetRoom] = Game.time;
            creep.memory.blockedRooms = blockedRooms;
            
            // Clear target and try again
            delete creep.memory.targetRoom;
            delete creep.memory.targetStartTime;
            return;
        }
        
        const exitDir = creep.room.findExitTo(creep.memory.targetRoom);
        if (exitDir === ERR_NO_PATH) {
            console.log(`⚠️ Scout ${creep.name} can't find path to ${creep.memory.targetRoom}, marking as temporarily blocked`);
            
            // Mark room as temporarily blocked
            const blockedRooms = creep.memory.blockedRooms || {};
            blockedRooms[creep.memory.targetRoom] = Game.time;
            creep.memory.blockedRooms = blockedRooms;
            
            delete creep.memory.targetRoom;
            delete creep.memory.targetStartTime;
            return;
        }
        
        const exit = creep.pos.findClosestByPath(exitDir);
        if (exit) {
            creep.moveTo(exit, { 
                visualizePathStyle: { stroke: '#00ff00' },
                maxRooms: 2 // Limit to 2 rooms to avoid getting stuck
            });
        }
        return;
    }
    
    // In target room - explore for a few ticks, then mark as scouted
    if (!creep.memory.scoutTime) {
        creep.memory.scoutTime = Game.time;
        console.log(`🔍 Scout ${creep.name} exploring ${creep.room.name}`);
    }
    
    // Scout for 50 ticks (enough to get good vision and evaluate the room)
    if (Game.time - creep.memory.scoutTime >= 50) {
        // Mark room as scouted
        if (!scoutedRooms.includes(creep.room.name)) {
            scoutedRooms.push(creep.room.name);
            creep.memory.scoutedRooms = scoutedRooms;
        }
        
        // Clear target and let the scout get a new assignment
        delete creep.memory.targetRoom;
        delete creep.memory.scoutTime;
        delete creep.memory.targetStartTime;
        
        console.log(`✅ Scout ${creep.name} completed exploration of ${creep.room.name}`);
    } else {
        // Move around the room to explore
        const randomPos = {
            x: Math.floor(Math.random() * 50),
            y: Math.floor(Math.random() * 50)
        };
        creep.moveTo(randomPos, { 
            visualizePathStyle: { stroke: '#00ff00', opacity: 0.5 },
            range: 25 // Don't need to get exactly to the position
        });
    }
}

// Dedicated remote hauler logic - optimized for remote room operations
function runRemoteHauler(creep) {
    const targetRemoteRoom = creep.memory.targetRemoteRoom;
    const homeRoom = creep.memory.homeRoom;
    
    // If carrying energy, deliver to home room
    if (creep.store[RESOURCE_ENERGY] > 0) {
        // Check if we're in the home room
        if (creep.room.name === homeRoom) {
            // Find delivery targets in home room
            const spawnTargets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    if (structure.structureType === STRUCTURE_EXTENSION || structure.structureType === STRUCTURE_SPAWN) {
                        return structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                    return false;
                }
            });
            
            const storage = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return structure.structureType === STRUCTURE_STORAGE &&
                           structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            
            // Find controller container specifically
            const controller = creep.room.controller;
            const sources = creep.room.find(FIND_SOURCES);
            const controllerContainers = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    if (structure.structureType !== STRUCTURE_CONTAINER || structure.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
                        return false;
                    }
                    if (controller && structure.pos.getRangeTo(controller) <= 3) {
                        // Make sure it's not a source container
                        for (const source of sources) {
                            if (structure.pos.getRangeTo(source) <= 2) {
                                return false;
                            }
                        }
                        return true;
                    }
                    return false;
                }
            });
            
            let target = null;
            
            // Priority: Spawn/Extensions > Controller containers > Storage
            if (spawnTargets.length > 0) {
                target = creep.pos.findClosestByPath(spawnTargets);
            } else if (controllerContainers.length > 0) {
                target = creep.pos.findClosestByPath(controllerContainers);
            } else if (storage.length > 0) {
                target = creep.pos.findClosestByPath(storage);
            }
            
            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
        } else {
            // Not in home room - move towards home room
            const exitDir = creep.room.findExitTo(homeRoom);
            const exit = creep.pos.findClosestByPath(exitDir);
            if (exit) {
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    } else {
        // Need energy - go to target remote room and collect
        if (creep.room.name === targetRemoteRoom) {
            // In target remote room - collect energy
            const sources = creep.room.find(FIND_SOURCES);
            
            // Look for source containers first
            const sourceContainers = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    if (structure.structureType !== STRUCTURE_CONTAINER || structure.store[RESOURCE_ENERGY] <= 0) {
                        return false;
                    }
                    // Only pick up from source containers
                    for (const source of sources) {
                        if (structure.pos.getRangeTo(source) <= 2) {
                            return true;
                        }
                    }
                    return false;
                }
            });
            
            // Look for dropped energy near sources
            const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
                filter: (resource) => {
                    if (resource.resourceType !== RESOURCE_ENERGY || resource.amount < 200) {
                        return false;
                    }
                    // Only near sources
                    for (const source of sources) {
                        if (resource.pos.getRangeTo(source) <= 3) {
                            return true;
                        }
                    }
                    return false;
                }
            });
            
            let target = null;
            
            // Prefer containers over dropped energy
            if (sourceContainers.length > 0) {
                target = creep.pos.findClosestByPath(sourceContainers);
                if (target) {
                    if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                }
            } else if (droppedEnergy.length > 0) {
                target = creep.pos.findClosestByPath(droppedEnergy);
                if (target) {
                    if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                }
            }
        } else {
            // Not in target remote room - move towards it
            const exitDir = creep.room.findExitTo(targetRemoteRoom);
            const exit = creep.pos.findClosestByPath(exitDir);
            if (exit) {
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#00aa00' } });
            }
        }
    }
}

// Helper function: Calculate total energy available at each source (container + ground)
function getTotalSourceEnergy(room, source) {
    let totalEnergy = 0;
    
    // Find container energy near this source
    const container = room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            return structure.structureType === STRUCTURE_CONTAINER &&
                   structure.pos.getRangeTo(source) <= 2;
        }
    })[0];
    
    if (container) {
        totalEnergy += container.store[RESOURCE_ENERGY] || 0;
    }
    
    // Find dropped energy near this source
    const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
        filter: (resource) => {
            return resource.resourceType === RESOURCE_ENERGY && 
                   resource.pos.getRangeTo(source) <= 3; // Slightly larger range for ground energy
        }
    });
    
    droppedEnergy.forEach(drop => {
        totalEnergy += drop.amount;
    });
    
    return totalEnergy;
}

// Helper function: Get best energy source (ground energy first, then container) near assigned source
function getEnergyFromAssignedSource(creep, assignedSource) {
    if (!assignedSource) return null;
    
    // First priority: Dropped energy near assigned source
    const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
        filter: (resource) => {
            return resource.resourceType === RESOURCE_ENERGY && 
                   resource.amount >= 50 &&
                   resource.pos.getRangeTo(assignedSource) <= 3;
        }
    });
    
    if (droppedEnergy.length > 0) {
        // Sort by amount (largest first) to be more efficient
        droppedEnergy.sort((a, b) => b.amount - a.amount);
        return { target: droppedEnergy[0], type: 'pickup' };
    }
    
    // Second priority: Container near assigned source
    const container = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            return structure.structureType === STRUCTURE_CONTAINER &&
                   structure.store[RESOURCE_ENERGY] > 0 &&
                   structure.pos.getRangeTo(assignedSource) <= 2;
        }
    })[0];
    
    if (container) {
        return { target: container, type: 'withdraw' };
    }
    
    return null;
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
        // Try to find ground energy near non-source containers
        const groundEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: (resource) => resource.resourceType === RESOURCE_ENERGY && resource.amount >= 50
        });
        for (const container of nonSourceContainers) {
            const ground = groundEnergy.find(drop => drop.pos.getRangeTo(container) <= 3);
            if (ground) {
                return { target: ground, actionType: 'pickup' };
            }
        }
        // If no ground energy, fallback to closest non-source container
        const closest = creep.pos.findClosestByPath(nonSourceContainers);
        if (closest) {
            return { target: closest, actionType: 'withdraw' };
        }
    }

    // If only source containers available, use distribution logic
    if (sourceContainers.length > 0) {
        // Try to find ground energy near source containers
        const groundEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: (resource) => resource.resourceType === RESOURCE_ENERGY && resource.amount >= 50
        });
        for (const container of sourceContainers) {
            const ground = groundEnergy.find(drop => drop.pos.getRangeTo(container) <= 3);
            if (ground) {
                return { target: ground, actionType: 'pickup' };
            }
        }
        // If no ground energy, fallback to closest source container
        const closest = creep.pos.findClosestByPath(sourceContainers);
        if (closest) {
            return { target: closest, actionType: 'withdraw' };
        }
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
            // Use enhanced energy distribution that prioritizes ground energy
            const energySource = getDistributedEnergyContainer(creep, targets);
            if (energySource && energySource.target) {
                let result;
                if (energySource.actionType === 'pickup') {
                    result = creep.pickup(energySource.target);
                } else {
                    result = creep.withdraw(energySource.target, RESOURCE_ENERGY);
                }
                if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(energySource.target, { visualizePathStyle: { stroke: '#ffaa00' } });
                } else if (result === OK && energySource.actionType === 'pickup') {
                    // After picking up ground energy, attempt to top up from a nearby source container (<=2 tiles)
                    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        const nearbyContainer = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0 &&
                                         creep.pos.getRangeTo(s.pos) <= 2
                        });
                        if (nearbyContainer) {
                            const res2 = creep.withdraw(nearbyContainer, RESOURCE_ENERGY);
                            if (res2 === ERR_NOT_IN_RANGE) {
                                creep.moveTo(nearbyContainer, { visualizePathStyle: { stroke: '#ffaa00' } });
                            }
                        }
                    }
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

function manageDefenseHitPoints(room) {
    const rcl = room.controller.level;
    const wallTargetHits = WALL_TARGET_HITS[rcl] || WALL_TARGET_HITS[1];
    const rampartTargetHits = RAMPART_TARGET_HITS[rcl] || RAMPART_TARGET_HITS[1];
    
    const walls = room.find(FIND_STRUCTURES, {
        filter: (structure) => structure.structureType === STRUCTURE_WALL
    });
    
    const ramparts = room.find(FIND_STRUCTURES, {
        filter: (structure) => structure.structureType === STRUCTURE_RAMPART
    });

    let wallsBelowTarget = 0;
    let wallsAtTarget = 0;
    let wallsCritical = 0;
    
    let rampartsBelowTarget = 0;
    let rampartsAtTarget = 0;
    let rampartsCritical = 0;

    walls.forEach(wall => {
        if (wall.hits < wallTargetHits) {
            wallsBelowTarget++;
            if (wall.hits < wallTargetHits * 0.2) {
                wallsCritical++;
            }
        } else {
            wallsAtTarget++;
        }
    });
    
    ramparts.forEach(rampart => {
        if (rampart.hits < rampartTargetHits) {
            rampartsBelowTarget++;
            if (rampart.hits < rampartTargetHits * 0.2) {
                rampartsCritical++;
            }
        } else {
            rampartsAtTarget++;
        }
    });

    if (Game.time % 50 === 0 && (walls.length > 0 || ramparts.length > 0)) {
        if (walls.length > 0) {
            console.log(`🛡️ Walls (RCL ${rcl}, target: ${wallTargetHits.toLocaleString()}): ${wallsAtTarget} at target, ${wallsBelowTarget} need repair (${wallsCritical} critical)`);
        }
        if (ramparts.length > 0) {
            console.log(`🛡️ Ramparts (RCL ${rcl}, target: ${rampartTargetHits.toLocaleString()}): ${rampartsAtTarget} at target, ${rampartsBelowTarget} need repair (${rampartsCritical} critical)`);
        }
    }
}

function cleanupSharedConstructionTarget(room) {
    if (room.memory.sharedConstructionTarget) {
        const target = Game.getObjectById(room.memory.sharedConstructionTarget);
        if (!target) {
            // Target no longer exists, clear it
            delete room.memory.sharedConstructionTarget;
        }
    }
}

function getSharedConstructionTarget(room) {
    // Check if current shared target still exists and is valid
    if (room.memory.sharedConstructionTarget) {
        const target = Game.getObjectById(room.memory.sharedConstructionTarget);
        if (target) {
            return target; // Current shared target is still valid
        } else {
            // Target completed or destroyed, clear it
            delete room.memory.sharedConstructionTarget;
        }
    }
    
    // Find a new shared construction target
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
    if (constructionSites.length === 0) {
        return null; // No construction sites available
    }
    
    // Check if we should build roads yet (same logic as createMissingConstructionSites)
    const existingExtensions = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION
    }).length;
    const existingContainers = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
    }).length;
    const shouldBuildRoads = existingExtensions >= 5 && existingContainers >= 1;
    
    // Filter out roads if we shouldn't build them yet
    const filteredConstructionSites = shouldBuildRoads ? 
        constructionSites : 
        constructionSites.filter(site => site.structureType !== STRUCTURE_ROAD);
    
    if (filteredConstructionSites.length === 0) {
        if (!shouldBuildRoads) {
            console.log(`🛣️ No non-road construction sites available. Need ${5 - existingExtensions} more extensions and ${1 - existingContainers} more containers before building roads.`);
        }
        return null;
    }
    
    // Prioritize construction sites by importance - extensions first!
    const priorityOrder = [
        STRUCTURE_EXTENSION,
        STRUCTURE_SPAWN,
        STRUCTURE_STORAGE,
        STRUCTURE_TOWER,
        STRUCTURE_CONTAINER,
        STRUCTURE_WALL,
        STRUCTURE_ROAD,
        STRUCTURE_LINK,
        STRUCTURE_TERMINAL
    ];
    
    // Find highest priority construction site
    let selectedTarget = null;
    for (const structureType of priorityOrder) {
        const sitesOfType = filteredConstructionSites.filter(site => site.structureType === structureType);
        if (sitesOfType.length > 0) {
            const spawn = room.find(FIND_MY_SPAWNS)[0];
            
            if (structureType === STRUCTURE_EXTENSION && spawn) {
                // For extensions, prioritize by distance to spawn (closest first)
                sitesOfType.sort((a, b) => {
                    const distA = spawn.pos.getRangeTo(a.pos);
                    const distB = spawn.pos.getRangeTo(b.pos);
                    return distA - distB;
                });
                selectedTarget = sitesOfType[0];
                console.log(`🏗️ Prioritizing extension at (${selectedTarget.pos.x},${selectedTarget.pos.y}) - distance ${spawn.pos.getRangeTo(selectedTarget.pos)} from spawn`);
            } else if (structureType === STRUCTURE_ROAD && shouldBuildRoads) {
                // Only select roads if we should be building them
                selectedTarget = spawn ? spawn.pos.findClosestByPath(sitesOfType) : sitesOfType[0];
                console.log(`🛣️ Now building roads - selected road at (${selectedTarget.pos.x},${selectedTarget.pos.y})`);
            } else if (structureType !== STRUCTURE_ROAD) {
                // For other non-road structures, pick the one closest to spawn by path
                selectedTarget = spawn ? spawn.pos.findClosestByPath(sitesOfType) : sitesOfType[0];
            }
            break;
        }
    }
    
    // If no prioritized target found, take any construction site (excluding roads if we shouldn't build them)
    if (!selectedTarget) {
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        selectedTarget = spawn ? spawn.pos.findClosestByPath(filteredConstructionSites) : filteredConstructionSites[0];
    }
    
    // Set as shared target
    if (selectedTarget) {
        room.memory.sharedConstructionTarget = selectedTarget.id;
        if (selectedTarget.structureType === STRUCTURE_EXTENSION) {
            console.log(`🏗️ New shared construction target: PRIORITY EXTENSION at (${selectedTarget.pos.x},${selectedTarget.pos.y})`);
        } else {
            console.log(`🏗️ New shared construction target: ${selectedTarget.structureType} at (${selectedTarget.pos.x},${selectedTarget.pos.y})`);
        }
    }
    
    return selectedTarget;
}

function getDefensesNeedingRepair(room) {
    const rcl = room.controller.level;
    const wallTargetHits = WALL_TARGET_HITS[rcl] || WALL_TARGET_HITS[1];
    const rampartTargetHits = RAMPART_TARGET_HITS[rcl] || RAMPART_TARGET_HITS[1];
    
    // Find walls and ramparts needing repair
    const defenses = room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            if (structure.structureType === STRUCTURE_WALL) {
                return structure.hits < wallTargetHits;
            } else if (structure.structureType === STRUCTURE_RAMPART) {
                return structure.hits < rampartTargetHits;
            }
            return false;
        }
    });

    return defenses
        .map(def => ({ 
            structure: def, 
            targetHits: def.structureType === STRUCTURE_WALL ? wallTargetHits : rampartTargetHits 
        }))
        .sort((a, b) => {
            const aPercent = a.structure.hits / a.targetHits;
            const bPercent = b.structure.hits / b.targetHits;
            return aPercent - bPercent;
        })
        .map(item => item.structure);
}

function getStructuresNeedingRepair(room) {
    // Find all structures that are significantly damaged.
    // - Ramparts: compare against absolute RAMPART_TARGET_HITS threshold
    // - Other structures: use the 80% of hitsMax heuristic as before
    const rcl = room.controller.level;
    const rampartTargetHits = RAMPART_TARGET_HITS[rcl] || RAMPART_TARGET_HITS[1];

    const damagedStructures = room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            // Skip walls (handled separately by getDefensesNeedingRepair)
            if (structure.structureType === STRUCTURE_WALL) {
                return false;
            }

            // Ramparts: repair if below absolute rampart target
            if (structure.structureType === STRUCTURE_RAMPART) {
                return structure.hits < rampartTargetHits;
            }

            // Skip structures that are already at full health
            if (structure.hits >= structure.hitsMax) {
                return false;
            }

            // Other structures: Only repair structures that are below 80% health
            return structure.hits / structure.hitsMax < 0.8;
        }
    });

    // Priority tiers for tower repairs
    const getPriority = (structure) => {
        // Critical infrastructure (highest priority)
        if (structure.structureType === STRUCTURE_SPAWN) return 1;
        if (structure.structureType === STRUCTURE_TOWER) return 2;
        if (structure.structureType === STRUCTURE_STORAGE) return 3;
        if (structure.structureType === STRUCTURE_TERMINAL) return 4;
        
        // Important infrastructure
        if (structure.structureType === STRUCTURE_CONTAINER) {
            // Source/controller containers higher priority
            const sources = room.find(FIND_SOURCES);
            const controller = room.controller;
            const nearSource = sources.some(s => structure.pos.getRangeTo(s) <= 2);
            const nearController = controller && structure.pos.getRangeTo(controller) <= 3;
            if (nearSource || nearController) return 5;
            return 7;
        }
        
        // Extensions
        if (structure.structureType === STRUCTURE_EXTENSION) return 6;
        
        // Ramparts protecting critical structures
        if (structure.structureType === STRUCTURE_RAMPART) return 8;
        
        // Roads
        if (structure.structureType === STRUCTURE_ROAD) return 9;
        
        // Everything else
        return 10;
    };

    // Sort by priority first, then by damage percentage
    return damagedStructures.sort((a, b) => {
        const aPriority = getPriority(a);
        const bPriority = getPriority(b);
        
        if (aPriority !== bPriority) {
            return aPriority - bPriority;
        }
        
        // Same priority - sort by damage percentage
        const aPercent = a.hits / a.hitsMax;
        const bPercent = b.hits / b.hitsMax;
        return aPercent - bPercent;
    });
}



function runBuilder(creep) {
    // If creep has energy, prioritize repairs then building
    if (creep.store[RESOURCE_ENERGY] > 0) {
        let target = null;
        let isRepairTask = false;
        
        // Check if we have an assigned target (repair or build)
        if (creep.memory.buildTarget) {
            target = Game.getObjectById(creep.memory.buildTarget);
            isRepairTask = creep.memory.isRepairTask || false;
            // If the target no longer exists, clear assignment
            if (!target) {
                delete creep.memory.buildTarget;
                delete creep.memory.isRepairTask;
            }
        }
        
        // If no assigned target, find a new one - prioritize container repairs, then defense repairs
        if (!target) {
            // First priority: Nearby containers that are decaying (source/container near controller/storage)
            const containers = creep.room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && s.hits < Math.max(CONTAINER_REPAIR_THRESHOLD, s.hitsMax * CONTAINER_REPAIR_PERCENT)
            });
            if (containers.length > 0) {
                // Prefer containers near sources, controller, or storage
                containers.sort((a, b) => {
                    const aScore = (a.pos.getRangeTo(creep.pos) || 0) - (a.pos.getRangeTo(creep.room.controller) || 0);
                    const bScore = (b.pos.getRangeTo(creep.pos) || 0) - (b.pos.getRangeTo(creep.room.controller) || 0);
                    return aScore - bScore;
                });
                target = creep.pos.findClosestByPath(containers) || containers[0];
                if (target) {
                    creep.memory.buildTarget = target.id;
                    creep.memory.isRepairTask = true;
                    isRepairTask = true;
                }
            }

            // Second priority: Roads needing repair (decay over time)
            if (!target) {
                const roads = creep.room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax * 0.5
                });
                if (roads.length > 0) {
                    // Repair roads near spawn, sources, or controller first
                    const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
                    const sources = creep.room.find(FIND_SOURCES);
                    roads.sort((a, b) => {
                        const aDist = Math.min(
                            spawn ? a.pos.getRangeTo(spawn) : 50,
                            ...sources.map(s => a.pos.getRangeTo(s)),
                            a.pos.getRangeTo(creep.room.controller)
                        );
                        const bDist = Math.min(
                            spawn ? b.pos.getRangeTo(spawn) : 50,
                            ...sources.map(s => b.pos.getRangeTo(s)),
                            b.pos.getRangeTo(creep.room.controller)
                        );
                        return aDist - bDist;
                    });
                    target = creep.pos.findClosestByPath(roads) || roads[0];
                    if (target) {
                        creep.memory.buildTarget = target.id;
                        creep.memory.isRepairTask = true;
                        isRepairTask = true;
                    }
                }
            }

            // Third priority: Walls needing repair
            if (!target) {
                const defensesNeedingRepair = getDefensesNeedingRepair(creep.room);
                if (defensesNeedingRepair.length > 0) {
                    target = creep.pos.findClosestByPath(defensesNeedingRepair);
                    if (target) {
                        creep.memory.buildTarget = target.id;
                        creep.memory.isRepairTask = true;
                        isRepairTask = true;
                    }
                }
            }

            // Fourth priority: Shared construction site (all builders work together)
            if (!target) {
                target = getSharedConstructionTarget(creep.room);
                if (target) {
                    creep.memory.buildTarget = target.id;
                    creep.memory.isRepairTask = false;
                    isRepairTask = false;
                }
            }
        }
        
        if (target) {
            let actionResult;
            if (isRepairTask) {
                actionResult = creep.repair(target);
            } else {
                actionResult = creep.build(target);
            }
            
            if (actionResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            } else if (actionResult === OK) {
                // Check if repair target is now at target hits
                if (isRepairTask) {
                    const rcl = creep.room.controller.level;
                    if (target.structureType === STRUCTURE_WALL) {
                        const targetHits = WALL_TARGET_HITS[rcl] || WALL_TARGET_HITS[1];
                        if (target.hits >= targetHits) {
                            delete creep.memory.buildTarget;
                            delete creep.memory.isRepairTask;
                        }
                    } else if (target.structureType === STRUCTURE_RAMPART) {
                        const rampartHits = RAMPART_TARGET_HITS[rcl] || RAMPART_TARGET_HITS[1];
                        if (target.hits >= rampartHits) {
                            delete creep.memory.buildTarget;
                            delete creep.memory.isRepairTask;
                        }
                    }
                }
            } else if (actionResult !== OK) {
                console.log(`${isRepairTask ? 'Repair' : 'Build'} error: ${actionResult} for creep ${creep.name}`);
                // Clear assignment on error to try a different target
                delete creep.memory.buildTarget;
                delete creep.memory.isRepairTask;
                
                // If this was a construction site that failed, clear shared target
                if (!isRepairTask && actionResult === ERR_INVALID_TARGET) {
                    // Construction site was completed by another creep
                    if (creep.room.memory.sharedConstructionTarget === target.id) {
                        delete creep.room.memory.sharedConstructionTarget;
                        console.log(`🏗️ Shared construction target completed, selecting new target`);
                    }
                }
            }
        } else {
            // No construction sites or repairs - use builder energy to upgrade controller
            const controller = creep.room.controller;
            if (controller) {
                const upgradeResult = creep.upgradeController(controller);
                if (upgradeResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            } else {
                // Fallback: idle near spawn if no controller found
                const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
                if (spawn && creep.pos.getRangeTo(spawn) > 3) {
                    creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            }
        }
    } else {
        // Prioritize picking up dropped energy close to where we're building first,
        // then near our assigned source, then anywhere in the room.
        const allDropped = creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: (resource) => {
                return resource.resourceType === RESOURCE_ENERGY && resource.amount >= 50;
            }
        });

        let target = null;
        if (allDropped.length > 0) {
            // 1) Try dropped energy near current build target
            if (creep.memory.buildTarget) {
                const buildObj = Game.getObjectById(creep.memory.buildTarget);
                if (buildObj) {
                    const nearBuild = allDropped.filter(drop => drop.pos.getRangeTo(buildObj) <= 6);
                    if (nearBuild.length > 0) {
                        target = creep.pos.findClosestByPath(nearBuild);
                    }
                }
            }

            // 2) Try dropped energy near our assigned source
            if (!target && creep.memory.assignedSource) {
                const assignedSource = Game.getObjectById(creep.memory.assignedSource);
                if (assignedSource) {
                    const nearSource = allDropped.filter(drop => drop.pos.getRangeTo(assignedSource) <= 6);
                    if (nearSource.length > 0) {
                        target = creep.pos.findClosestByPath(nearSource);
                    }
                }
            }

            // 3) Fallback to closest dropped energy in the room
            if (!target) {
                target = creep.pos.findClosestByPath(allDropped);
            }
        }

        if (target) {
            const pickupResult = creep.pickup(target);
            if (pickupResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
            } else if (pickupResult === OK) {
                // After picking up ground energy, if we still have free capacity,
                // try to top up from a nearby source container (<=2 tiles).
                if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    const nearbyContainer = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0 &&
                                    // Only consider source containers (near sources)
                                    creep.pos.getRangeTo(s.pos) <= 2
                    });
                    if (nearbyContainer) {
                        const res = creep.withdraw(nearbyContainer, RESOURCE_ENERGY);
                        if (res === ERR_NOT_IN_RANGE) {
                            creep.moveTo(nearbyContainer, { visualizePathStyle: { stroke: '#ffaa00' } });
                        }
                    }
                }
            }
        } else {
            // Fallback to containers and storage (exclude controller container)
            const controller = creep.room.controller;
            const targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    if (structure.structureType === STRUCTURE_STORAGE && structure.store[RESOURCE_ENERGY] > 0) {
                        return true;
                    }
                    if (structure.structureType === STRUCTURE_CONTAINER && structure.store[RESOURCE_ENERGY] > 0) {
                        // Exclude controller containers - only use source containers
                        if (controller && structure.pos.getRangeTo(controller) <= 3) {
                            return false; // This is a controller container, skip it
                        }
                        return true; // This is a source container, use it
                    }
                    return false;
                }
            });
            
            if (targets.length > 0) {
                // Use enhanced energy distribution that prioritizes ground energy
                const energySource = getDistributedEnergyContainer(creep, targets);
                
                if (energySource && energySource.target) {
                    let result;
                    if (energySource.actionType === 'pickup') {
                        result = creep.pickup(energySource.target);
                    } else {
                        result = creep.withdraw(energySource.target, RESOURCE_ENERGY);
                    }
                    
                    if (result === ERR_NOT_IN_RANGE) {
                        creep.moveTo(energySource.target, { visualizePathStyle: { stroke: '#ffaa00' } });
                    } else if (result !== OK && result !== ERR_NOT_ENOUGH_RESOURCES) {
                        console.log(`Builder ${energySource.actionType} error: ${result}`);
                    }
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

// ========================================
// REMOTE HARVESTING SYSTEM (v1.2)
// ========================================

/**
 * Get adjacent room names from a given room name
 * E.g., "E5N5" returns ["E4N4", "E4N5", "E4N6", "E5N4", "E5N6", "E6N4", "E6N5", "E6N6"]
 */
function getAdjacentRoomNames(roomName) {
    const parsed = /^([WE])(\d+)([NS])(\d+)$/.exec(roomName);
    if (!parsed) return [];
    
    const [, ew, x, ns, y] = parsed;
    const xNum = parseInt(x);
    const yNum = parseInt(y);
    
    const adjacentRooms = [];
    
    // Generate all 8 adjacent room names
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue; // Skip current room
            
            let newX = xNum + (ew === 'E' ? dx : -dx);
            let newY = yNum + (ns === 'N' ? dy : -dy);
            let newEW = ew;
            let newNS = ns;
            
            // Handle coordinate wraparound at 0
            if (newX < 0) {
                newX = Math.abs(newX) - 1;
                newEW = (ew === 'E') ? 'W' : 'E';
            }
            if (newY < 0) {
                newY = Math.abs(newY) - 1;
                newNS = (ns === 'N') ? 'S' : 'N';
            }
            
            adjacentRooms.push(`${newEW}${newX}${newNS}${newY}`);
        }
    }
    
    return adjacentRooms;
}

/**
 * Evaluate a room for remote harvesting suitability
 * Returns a score (higher is better) or null if unsuitable
 */
function evaluateRemoteRoom(roomName, homeRoomName) {
    // Check if we have vision of the room
    const room = Game.rooms[roomName];
    if (!room) {
        return null; // Can't evaluate without vision
    }
    
    // Check for controller - we need a controller to reserve
    if (!room.controller) {
        return { score: 0, reason: 'No controller' };
    }
    
    // Check if controller is owned or reserved by someone else
    if (room.controller.owner && room.controller.owner.username !== Memory.username) {
        return { score: 0, reason: 'Owned by hostile' };
    }
    
    if (room.controller.reservation && 
        room.controller.reservation.username !== Memory.username) {
        return { score: 0, reason: 'Reserved by hostile' };
    }
    
    // Check for hostile structures
    const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);
    if (hostileStructures.length > 0) {
        return { score: 0, reason: 'Hostile structures present' };
    }
    
    // Count sources
    const sources = room.find(FIND_SOURCES);
    if (sources.length === 0) {
        return { score: 0, reason: 'No sources' };
    }
    
    // Calculate path distance from home room spawn to first source
    const homeRoom = Game.rooms[homeRoomName];
    if (!homeRoom) return null;
    
    const homeSpawn = homeRoom.find(FIND_MY_SPAWNS)[0];
    if (!homeSpawn) return null;
    
    // Calculate average distance to sources
    let totalDistance = 0;
    let validPaths = 0;
    
    for (const source of sources) {
        const path = PathFinder.search(homeSpawn.pos, { pos: source.pos, range: 1 }, {
            plainCost: 2,
            swampCost: 10,
            maxRooms: 3
        });
        
        if (!path.incomplete) {
            totalDistance += path.path.length;
            validPaths++;
        }
    }
    
    if (validPaths === 0) {
        return { score: 0, reason: 'No valid path to sources' };
    }
    
    const avgDistance = totalDistance / validPaths;
    
    // Calculate swamp percentage (prefer less swamps)
    const terrain = new Room.Terrain(roomName);
    let swampTiles = 0;
    for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
            if (terrain.get(x, y) === TERRAIN_MASK_SWAMP) {
                swampTiles++;
            }
        }
    }
    const swampPercent = swampTiles / 2500;
    
    // Calculate score
    // Base score from number of sources (2 sources = 200, 1 source = 100)
    let score = sources.length * 100;
    
    // Distance penalty (closer is better) - reduce score by 1 per tile
    score -= avgDistance;
    
    // Swamp penalty (prefer plains) - reduce score by up to 50 based on swamp %
    score -= swampPercent * 50;
    
    // Determine reason based on score
    let reason = 'Suitable';
    if (score <= 0) {
        reason = 'Poor score (distance/swamp penalty too high)';
    } else if (score < 50) {
        reason = 'Low score (marginal room)';
    }
    
    return {
        score: Math.round(score),
        sources: sources.length,
        avgDistance: Math.round(avgDistance),
        swampPercent: Math.round(swampPercent * 100),
        reason: reason
    };
}

/**
 * Scout adjacent rooms and evaluate them for remote harvesting
 */
function scoutAdjacentRooms(homeRoom) {
    initializeRemoteMemory();
    
    const rcl = homeRoom.controller.level;
    
    // Only start scouting at RCL 4 (when we can make reservers)
    if (rcl < 4) return;
    
    // Scout every 100 ticks
    if (Game.time - Memory.remote.lastScout < 100) return;
    
    Memory.remote.lastScout = Game.time;
    
    // Get adjacent room names
    const adjacentRooms = getAdjacentRoomNames(homeRoom.name);
    
    // Filter out unreachable rooms in respawn areas
    const reachableAdjacentRooms = [];
    const homeSpawn = homeRoom.find(FIND_MY_SPAWNS)[0];
    
    for (const roomName of adjacentRooms) {
        const exitDir = homeRoom.findExitTo(roomName);
        if (exitDir !== ERR_NO_PATH && exitDir !== ERR_INVALID_ARGS) {
            reachableAdjacentRooms.push(roomName);
        }
    }
    
    console.log(`🔍 Scouting ${reachableAdjacentRooms.length} reachable adjacent rooms for remote harvesting (${adjacentRooms.length - reachableAdjacentRooms.length} blocked by respawn area boundaries)...`);
    
    // Check if we have any scouts that have completed scouting
    const scouts = _.filter(Game.creeps, c => c.memory.role === 'scout');
    let newlyScoutedRooms = [];
    
    for (const scout of scouts) {
        if (scout.memory.scoutedRooms) {
            for (const scoutedRoom of scout.memory.scoutedRooms) {
                if (!Memory.remote.rooms[scoutedRoom]) {
                    newlyScoutedRooms.push(scoutedRoom);
                }
            }
        }
    }
    
    // Evaluate newly scouted rooms
    let evaluated = 0;
    let suitable = 0;
    
    for (const roomName of newlyScoutedRooms) {
        const evaluation = evaluateRemoteRoom(roomName, homeRoom.name);
        
        if (evaluation !== null) {
            evaluated++;
            
            // Store evaluation in memory
            Memory.remote.rooms[roomName] = {
                evaluated: true,
                lastCheck: Game.time,
                score: evaluation.score,
                sources: evaluation.sources || 0,
                distance: evaluation.avgDistance || 999,
                swampPercent: evaluation.swampPercent || 0,
                active: false,
                reason: evaluation.reason
            };
            
            if (evaluation.score > 0) {
                suitable++;
                console.log(`  ✅ ${roomName}: Score ${evaluation.score} (${evaluation.sources} sources, ${evaluation.avgDistance} tiles, ${evaluation.swampPercent}% swamp)`);
    } else {
                console.log(`  ❌ ${roomName}: ${evaluation.reason}`);
            }
        }
    }
    
    // Also evaluate any reachable rooms we have vision of but haven't tracked yet
    for (const roomName of reachableAdjacentRooms) {
        // Skip if already tracked
        if (Memory.remote.rooms[roomName]) continue;
        
        const evaluation = evaluateRemoteRoom(roomName, homeRoom.name);
        
        if (evaluation !== null) {
            evaluated++;
            
            // Store evaluation in memory
            Memory.remote.rooms[roomName] = {
                evaluated: true,
                lastCheck: Game.time,
                score: evaluation.score,
                sources: evaluation.sources || 0,
                distance: evaluation.avgDistance || 999,
                swampPercent: evaluation.swampPercent || 0,
                active: false,
                reason: evaluation.reason
            };
            
            if (evaluation.score > 0) {
                suitable++;
                console.log(`  ✅ ${roomName}: Score ${evaluation.score} (${evaluation.sources} sources, ${evaluation.avgDistance} tiles, ${evaluation.swampPercent}% swamp)`);
            } else {
                console.log(`  ❌ ${roomName}: ${evaluation.reason}`);
            }
        } else {
            // No vision - add to scout queue (only if reachable)
            if (!Memory.remote.scoutQueue.includes(roomName)) {
                Memory.remote.scoutQueue.push(roomName);
            }
        }
    }
    
    if (evaluated > 0) {
        console.log(`📊 Evaluated ${evaluated} rooms, ${suitable} suitable for remote harvesting`);
    } else if (newlyScoutedRooms.length === 0) {
        const scouts = _.filter(Game.creeps, c => c.memory.role === 'scout');
        if (scouts.length === 0) {
            console.log(`⚠️ No scouts available - spawning scout to explore adjacent rooms`);
    } else {
            console.log(`🔍 Scout active - exploring adjacent rooms for remote harvesting`);
        }
    }
    
    // Auto-select best remote rooms based on RCL
    selectRemoteRooms(homeRoom);
}

/**
 * Select the best remote rooms to actively harvest based on RCL
 */
function selectRemoteRooms(homeRoom) {
    const rcl = homeRoom.controller.level;
    
    // Determine how many remote rooms we can handle
    let maxRemoteRooms = 0;
    if (rcl >= 4 && rcl < 6) maxRemoteRooms = 1;      // RCL 4-5: 1 remote room
    else if (rcl >= 6 && rcl < 8) maxRemoteRooms = 2; // RCL 6-7: 2 remote rooms
    else if (rcl >= 8) maxRemoteRooms = 3;             // RCL 8: 3 remote rooms
    
    if (maxRemoteRooms === 0) return;
    
    // Get all evaluated rooms sorted by score
    const evaluatedRooms = Object.keys(Memory.remote.rooms)
        .map(roomName => ({
            name: roomName,
            ...Memory.remote.rooms[roomName]
        }))
        .filter(r => r.evaluated && r.score > 0)
        .sort((a, b) => b.score - a.score);
    
    if (evaluatedRooms.length === 0) {
        console.log(`⚠️ No suitable remote rooms found. Need to scout adjacent rooms first.`);
        return;
    }
    
    // Count currently active rooms
    const activeRooms = evaluatedRooms.filter(r => r.active);
    
    // Activate top rooms up to our limit
    let changesMade = false;
    for (let i = 0; i < Math.min(maxRemoteRooms, evaluatedRooms.length); i++) {
        const room = evaluatedRooms[i];
        if (!room.active) {
            Memory.remote.rooms[room.name].active = true;
            console.log(`🎯 Activated remote room: ${room.name} (Score: ${room.score})`);
            changesMade = true;
        }
    }
    
    // Deactivate rooms beyond our limit
    for (let i = maxRemoteRooms; i < evaluatedRooms.length; i++) {
        const room = evaluatedRooms[i];
        if (room.active) {
            Memory.remote.rooms[room.name].active = false;
            console.log(`⏸️ Deactivated remote room: ${room.name} (over limit)`);
            changesMade = true;
        }
    }
    
    if (changesMade) {
        const nowActive = Object.keys(Memory.remote.rooms).filter(r => Memory.remote.rooms[r].active);
        console.log(`🌍 Remote rooms active: ${nowActive.length}/${maxRemoteRooms} (${nowActive.join(', ')})`);
    }
}

/**
 * Plan remote room infrastructure (containers and roads)
 * Called by remote builders when they have vision
 */
function planRemoteRoomInfrastructure(remoteRoomName, homeRoomName) {
    const remoteRoom = Game.rooms[remoteRoomName];
    const homeRoom = Game.rooms[homeRoomName];
    
    if (!remoteRoom || !homeRoom) return;
    
    const sources = remoteRoom.find(FIND_SOURCES);
    if (sources.length === 0) return;
    
    // Plan containers at each source
    for (const source of sources) {
        // Check if container already exists or is planned
        const existingContainer = source.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        })[0];
        
        const existingSite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
            })[0];
            
        if (!existingContainer && !existingSite) {
            // Find best position for container (adjacent to source)
            const terrain = new Room.Terrain(remoteRoomName);
            let bestPos = null;
            let bestScore = -1;
            
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    
                    const x = source.pos.x + dx;
                    const y = source.pos.y + dy;
                    
                    if (x < 1 || x > 48 || y < 1 || y > 48) continue;
                    
                    const terrainType = terrain.get(x, y);
                    if (terrainType === TERRAIN_MASK_WALL) continue;
                    
                    // Prefer plains over swamp
                    const score = (terrainType === TERRAIN_MASK_SWAMP) ? 1 : 2;
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestPos = new RoomPosition(x, y, remoteRoomName);
                    }
                }
            }
            
            if (bestPos) {
                const result = remoteRoom.createConstructionSite(bestPos.x, bestPos.y, STRUCTURE_CONTAINER);
                if (result === OK) {
                    console.log(`📦 Planned container at remote source in ${remoteRoomName} (${bestPos.x}, ${bestPos.y})`);
                }
            }
        }
    }
    
    // Plan road from source containers to home room exit
    // This is simplified - just creates a road path from each source toward home
    const homeSpawn = homeRoom.find(FIND_MY_SPAWNS)[0];
    if (!homeSpawn) return;
    
    for (const source of sources) {
        const path = PathFinder.search(source.pos, { pos: homeSpawn.pos, range: 1 }, {
            plainCost: 2,
            swampCost: 10,
            maxRooms: 3,
            roomCallback: function(roomName) {
                let costs = new PathFinder.CostMatrix;
                
                const room = Game.rooms[roomName];
                if (!room) return costs;
                
                // Avoid structures
                room.find(FIND_STRUCTURES).forEach(function(struct) {
                    if (struct.structureType === STRUCTURE_ROAD) {
                        costs.set(struct.pos.x, struct.pos.y, 1);
                    } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                             (struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                        costs.set(struct.pos.x, struct.pos.y, 0xff);
                    }
                });
                
                return costs;
            }
        });
        
        if (!path.incomplete) {
            // Create roads along the path (only in remote room, home room has its own planning)
            let roadsPlanned = 0;
            for (const pos of path.path) {
                if (pos.roomName === remoteRoomName) {
                    // Check if road already exists
                    const existingRoad = pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === STRUCTURE_ROAD);
                    const existingSite = pos.lookFor(LOOK_CONSTRUCTION_SITES).find(s => s.structureType === STRUCTURE_ROAD);
                    
                    if (!existingRoad && !existingSite) {
                        const result = remoteRoom.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
                        if (result === OK) {
                            roadsPlanned++;
                        }
                    }
                }
            }
            
            if (roadsPlanned > 0) {
                console.log(`🛣️ Planned ${roadsPlanned} road tiles in remote room ${remoteRoomName}`);
            }
        }
    }
}

// ========================================
// REMOTE HARVESTING CREEP BEHAVIORS
// ========================================

/**
 * Reserver behavior - keeps remote rooms reserved
 */
function runReserver(creep) {
    // Get assigned room
    const targetRoomName = creep.memory.targetRoom;
    if (!targetRoomName) {
        console.log(`⚠️ Reserver ${creep.name} has no target room!`);
        return;
    }
    
    // Move to target room if not there
    if (creep.room.name !== targetRoomName) {
        const exitDir = creep.room.findExitTo(targetRoomName);
        const exit = creep.pos.findClosestByPath(exitDir);
        if (exit) {
            creep.moveTo(exit, { visualizePathStyle: { stroke: '#00ffff' } });
        }
        return;
    }
    
    // We're in the target room - reserve the controller
    const controller = creep.room.controller;
    if (!controller) {
        console.log(`⚠️ Reserver ${creep.name} in ${targetRoomName} but no controller found!`);
        return;
    }
    
    const result = creep.reserveController(controller);
    if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { visualizePathStyle: { stroke: '#00ffff' } });
    } else if (result === OK) {
        // Successfully reserved
        if (Game.time % 10 === 0) {
            const ticksToEnd = (controller.reservation && controller.reservation.ticksToEnd) || 0;
            console.log(`✅ Reserved ${targetRoomName} for ${ticksToEnd} ticks`);
        }
    } else if (result !== OK) {
        console.log(`⚠️ Reserver ${creep.name} failed to reserve: ${result}`);
    }
}

/**
 * Remote miner behavior - mines energy in remote rooms
 */
function runRemoteMiner(creep) {
    const sourceId = creep.memory.sourceId;
    const targetRoomName = creep.memory.targetRoom;
    
    if (!sourceId || !targetRoomName) {
        console.log(`⚠️ Remote miner ${creep.name} missing sourceId or targetRoom!`);
        return;
    }
    
    // Move to target room if not there
    if (creep.room.name !== targetRoomName) {
        const exitDir = creep.room.findExitTo(targetRoomName);
        const exit = creep.pos.findClosestByPath(exitDir);
        if (exit) {
            creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
        return;
    }
    
    // We're in the target room - mine the source
    const source = Game.getObjectById(sourceId);
    if (!source) {
        console.log(`⚠️ Remote miner ${creep.name} can't find source ${sourceId}!`);
        return;
    }
    
    // Check if there's a container at the source
    const containers = source.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
    });
    
    if (containers.length > 0) {
        const container = containers[0];
        // Move to container and mine
        if (!creep.pos.isEqualTo(container.pos)) {
            creep.moveTo(container.pos, { visualizePathStyle: { stroke: '#ffaa00' } });
        } else {
            creep.harvest(source);
        }
    } else {
        // No container yet - mine next to source
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
    }
}

/**
 * Remote builder behavior - builds and maintains infrastructure in remote rooms
 */
function runRemoteBuilder(creep) {
    const targetRoomName = creep.memory.targetRoom;
    
    if (!targetRoomName) {
        console.log(`⚠️ Remote builder ${creep.name} has no target room!`);
        return;
    }
    
    // State machine: gathering or working
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
    }
    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
    }
    
    if (!creep.memory.working) {
        // Need energy - prioritize remote room sources, then home room
        if (creep.room.name === targetRoomName) {
            // In remote room - check for energy here first
            const sources = creep.room.find(FIND_SOURCES);
            
            // Check for containers with energy near sources
            const sourceContainers = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    if (structure.structureType !== STRUCTURE_CONTAINER || structure.store[RESOURCE_ENERGY] < 50) {
                        return false;
                    }
                    for (const source of sources) {
                        if (structure.pos.getRangeTo(source) <= 2) {
                            return true;
                        }
                    }
                    return false;
                }
            });
            
            // Check for dropped energy near sources
            const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
                filter: (resource) => {
                    if (resource.resourceType !== RESOURCE_ENERGY || resource.amount < 50) {
                        return false;
                    }
                    for (const source of sources) {
                        if (resource.pos.getRangeTo(source) <= 3) {
                            return true;
                        }
                    }
                    return false;
                }
            });
            
            if (sourceContainers.length > 0) {
                // Get energy from container
                const target = creep.pos.findClosestByPath(sourceContainers);
                if (target) {
                    if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                }
            } else if (droppedEnergy.length > 0) {
                // Pick up dropped energy
                const target = creep.pos.findClosestByPath(droppedEnergy);
                if (target) {
                    if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                }
            } else {
                // No energy in remote room - go back to home room
                const exitDir = creep.room.findExitTo(creep.memory.homeRoom);
                const exit = creep.pos.findClosestByPath(exitDir);
                if (exit) {
                    creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
        } else if (creep.room.name === creep.memory.homeRoom) {
            // In home room - get energy from storage or containers
            const storage = creep.room.storage;
            if (storage && storage.store[RESOURCE_ENERGY] > 0) {
                if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            } else {
                // Get from containers
                const containers = creep.room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
                });
                if (containers.length > 0) {
                    const target = creep.pos.findClosestByPath(containers);
                    if (target && creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                }
            }
        } else {
            // In transit - move towards home room
            const exitDir = creep.room.findExitTo(creep.memory.homeRoom);
            const exit = creep.pos.findClosestByPath(exitDir);
            if (exit) {
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    } else {
        // Has energy - go to remote room and build/repair
        if (creep.room.name !== targetRoomName) {
            const exitDir = creep.room.findExitTo(targetRoomName);
            const exit = creep.pos.findClosestByPath(exitDir);
            if (exit) {
                creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        } else {
            // In remote room - prioritize construction, then repair
            const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
            
            if (constructionSites.length > 0) {
                const target = creep.pos.findClosestByPath(constructionSites);
                if (target) {
                    if (creep.build(target) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                }
            } else {
                // No construction - repair containers and roads
                const repairTargets = creep.room.find(FIND_STRUCTURES, {
                    filter: s => {
                        if (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_ROAD) {
                            return s.hits < s.hitsMax * 0.8;
                        }
                        return false;
                    }
                });
                
                if (repairTargets.length > 0) {
                    const target = creep.pos.findClosestByPath(repairTargets);
                    if (target) {
                        if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                        }
                    }
                } else {
                    // Nothing to do - park near a source and wait
                    const sources = creep.room.find(FIND_SOURCES);
                    if (sources.length > 0) {
                        const closestSource = creep.pos.findClosestByPath(sources);
                        if (closestSource && creep.pos.getRangeTo(closestSource) > 2) {
                            creep.moveTo(closestSource, { 
                                visualizePathStyle: { stroke: '#ffffff', opacity: 0.5 },
                                range: 2
                            });
                        }
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
    
    // Initialize pixel tracking memory if needed
    if (!Memory.pixelTracking) {
        Memory.pixelTracking = {
            generationTimes: [],
            lastPixelCount: 0,
            lastRateCheck: Game.time,
            bucketHistory: []
        };
    }
    
    // Track bucket levels for fill rate calculation
    Memory.pixelTracking.bucketHistory.push({
        tick: Game.time,
        bucket: cpuBucket
    });
    
    // Keep only last 100 bucket measurements
    if (Memory.pixelTracking.bucketHistory.length > 100) {
        Memory.pixelTracking.bucketHistory.shift();
    }
    
    // Check if generatePixel function is available (not available on local servers)
    if (typeof Game.cpu.generatePixel === 'function') {
        const currentPixelCount = Game.resources['pixel'] || 0;
        
        // Aggressive Pixel generation strategy - generate as soon as possible
        if (cpuBucket >= 10000) {
            // We have enough CPU in bucket to generate a Pixel
            const result = Game.cpu.generatePixel();
            if (result === OK) {
                // Track pixel generation
                Memory.pixelTracking.generationTimes.push(Game.time);
                // Keep only last 10 generations for rate calculation
                if (Memory.pixelTracking.generationTimes.length > 10) {
                    Memory.pixelTracking.generationTimes.shift();
                }
                
                console.log(`🎯 PIXEL GENERATED! Bucket: ${cpuBucket} → ${Game.cpu.bucket}, Pixels: ${Game.resources['pixel'] || 0}`);
            } else {
                console.log(`❌ Failed to generate Pixel: ${result}`);
            }
        } else if (cpuBucket >= 9000) {
            // Getting close, log status more frequently
            console.log(`⚡ Pixel ready soon: Bucket ${cpuBucket}/10000`);
            
            // Calculate estimated time to pixel if we have bucket history
            const bucketHistory = Memory.pixelTracking.bucketHistory;
            if (bucketHistory.length >= 5) {
                const recentHistory = bucketHistory.slice(-5);
                const timeSpan = recentHistory[recentHistory.length - 1].tick - recentHistory[0].tick;
                const bucketIncrease = recentHistory[recentHistory.length - 1].bucket - recentHistory[0].bucket;
                const fillRate = bucketIncrease / timeSpan;
                
                if (fillRate > 0) {
                    const needed = 10000 - cpuBucket;
                    const ticksNeeded = Math.ceil(needed / fillRate);
                    console.log(`⏱️ Estimated ${ticksNeeded} ticks until next pixel (${fillRate.toFixed(1)} bucket/tick)`);
                }
            }
        }
        
        // Calculate and log pixel generation rate every 500 ticks
        if (Game.time % 500 === 0) {
            const generations = Memory.pixelTracking.generationTimes;
            const bucketHistory = Memory.pixelTracking.bucketHistory;
            
            // Calculate bucket fill rate
            let bucketFillRate = 0;
            if (bucketHistory.length >= 2) {
                const recentHistory = bucketHistory.slice(-20); // Use last 20 measurements
                const timeSpan = recentHistory[recentHistory.length - 1].tick - recentHistory[0].tick;
                const bucketIncrease = recentHistory[recentHistory.length - 1].bucket - recentHistory[0].bucket;
                bucketFillRate = bucketIncrease / timeSpan;
            }
            
            // Estimate time to next pixel
            let timeToNextPixel = 'Unknown';
            if (bucketFillRate > 0) {
                const neededBucket = 10000 - cpuBucket;
                const ticksNeeded = Math.ceil(neededBucket / bucketFillRate);
                timeToNextPixel = `${ticksNeeded} ticks`;
            }
            
            if (generations.length >= 2) {
                const timeSpan = generations[generations.length - 1] - generations[0];
                const pixelsGenerated = generations.length;
                const pixelsPerTick = (pixelsGenerated / timeSpan).toFixed(4);
                const ticksPerPixel = (timeSpan / pixelsGenerated).toFixed(1);
                
                console.log(`📊 PIXEL STATS: ${pixelsPerTick} pixels/tick (${ticksPerPixel} ticks/pixel) | Bucket fill: ${bucketFillRate.toFixed(2)}/tick | Next pixel: ${timeToNextPixel}`);
            } else if (generations.length === 1) {
                const timeSinceLast = Game.time - generations[0];
                console.log(`📊 PIXEL STATS: 1 pixel in last ${timeSinceLast} ticks (${(1/timeSinceLast).toFixed(4)} pixels/tick) | Bucket fill: ${bucketFillRate.toFixed(2)}/tick | Next pixel: ${timeToNextPixel}`);
            } else {
                console.log(`📊 PIXEL STATS: No pixels generated in last 500 ticks | Bucket fill: ${bucketFillRate.toFixed(2)}/tick | Next pixel: ${timeToNextPixel}`);
            }
            
            // Reset tracking for fresh calculation
            Memory.pixelTracking.generationTimes = [];
            Memory.pixelTracking.bucketHistory = Memory.pixelTracking.bucketHistory.slice(-10); // Keep some history
            Memory.pixelTracking.lastRateCheck = Game.time;
        }
        
        // Clean up old tracking data if it gets too large
        if (Memory.pixelTracking.generationTimes.length > 20) {
            Memory.pixelTracking.generationTimes = Memory.pixelTracking.generationTimes.slice(-10);
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
}
