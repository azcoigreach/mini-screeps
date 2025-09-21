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

// Wall and rampart maintenance configuration - hit points by RCL
const WALL_TARGET_HITS = {
    1: 1000,        // RCL 1: Basic protection (1K hits)
    2: 10000,       // RCL 2: Light fortification (10K hits)
    3: 30000,       // RCL 3: Medium fortification (30K hits)
    4: 100000,      // RCL 4: Strong fortification (100K hits)
    5: 300000,      // RCL 5: Heavy fortification (300K hits)
    6: 1000000,     // RCL 6: Fortress level (1M hits)
    7: 3000000,     // RCL 7: Major fortress (3M hits)
    8: 10000000     // RCL 8: Maximum fortress (10M hits)
};

const RAMPART_TARGET_HITS = {
    1: 1000,        // RCL 1: Basic protection (1K hits)
    2: 5000,        // RCL 2: Light fortification (5K hits)
    3: 15000,       // RCL 3: Medium fortification (15K hits)
    4: 50000,       // RCL 4: Strong fortification (50K hits)
    5: 100000,      // RCL 5: Heavy fortification (100K hits)
    6: 250000,      // RCL 6: Fortress level (250K hits)
    7: 500000,      // RCL 7: Major fortress (500K hits)
    8: 1000000      // RCL 8: Maximum fortress (1M hits)
};

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
    const sources = room.find(FIND_SOURCES);
    

    
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

    // Create construction sites more frequently
    if (Game.time % 5 === 0) {
        createMissingConstructionSites(room);
    }

    // Manage wall and rampart hit points
    if (Game.time % 10 === 0) {
        manageDefenseHitPoints(room);
    }

    // Clean up shared construction target if needed
    if (Game.time % 5 === 0) {
        cleanupSharedConstructionTarget(room);
    }

    // Spawn creeps based on needs
    spawnCreeps(spawn, creeps);

    // Display clean status dashboard every 20 ticks
    if (Game.time % 20 === 0) {
        displayStatusDashboard(room, creeps);
    }

    // Run creep logic
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        runCreep(creep);
    }

    // Visualize base plan every tick for debugging (toggle with VISUALIZE_BASE constant)
    if (room.memory.basePlanned && VISUALIZE_BASE) {
        visualizeBasePlan(room);
    }
    
    // Force redistribution of unassigned creeps every tick
    const energyCreeps = _.filter(Game.creeps, c => 
        (c.memory.role === 'hauler' || c.memory.role === 'builder' || c.memory.role === 'upgrader') &&
        !c.memory.assignedSource
    );
    
    if (energyCreeps.length > 0) {
        console.log(`🔄 Assigning ${energyCreeps.length} unassigned energy creeps...`);
        
        energyCreeps.forEach((creep, index) => {
            const sourceIndex = index % sources.length;
            creep.memory.assignedSource = sources[sourceIndex].id;
            console.log(`${creep.name} (${creep.memory.role}): Assigned to source ${sources[sourceIndex].id.substr(-4)}`);
        });
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
    
    // Calculate distance transform for optimal placement
    const distanceTransform = calculateDistanceTransform(room);
    
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
    
    // Place source stamps (containers + roads)
    for (const source of sources) {
        placeSourceStamp(room, source);
    }
    
    // Place controller stamp (container + roads)
    placeControllerStamp(room, controller, anchor);
    
    // Use distance transform to optimally place extension fields near spawn
    placeExtensionFieldsOptimal(room, spawn, distanceTransform);
    
    // Use distance transform to optimally place tower clusters near spawn
    placeDefenseStampsOptimal(room, spawn, distanceTransform);
    
    // Place economy stamps (storage, terminal, links)
    // placeEconomyStamps(room, anchor);
    
    // Connect everything with roads
    planRoadNetwork(room, anchor, sources, controller);
    
    // Use minimum cut to place walls with rampart gates for base security
    placeWallsWithGates(room, spawn);
    
    console.log(`Base planned with ${room.memory.plannedStructures.length} structures`);
}

// Calculate distance transform for the entire room
function calculateDistanceTransform(room) {
    const terrain = new Room.Terrain(room.name);
    const distanceMatrix = new PathFinder.CostMatrix();
    
    // Initialize all positions
    for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                distanceMatrix.set(x, y, 0);
            } else {
                distanceMatrix.set(x, y, 255); // Max distance initially
            }
        }
    }
    
    // Multi-pass distance transform
    let changed = true;
    while (changed) {
        changed = false;
        
        // Forward pass
        for (let x = 1; x < 49; x++) {
            for (let y = 1; y < 49; y++) {
                if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                    const current = distanceMatrix.get(x, y);
                    const newDist = Math.min(
                        distanceMatrix.get(x - 1, y) + 1,
                        distanceMatrix.get(x, y - 1) + 1,
                        distanceMatrix.get(x - 1, y - 1) + 1,
                        current
                    );
                    if (newDist < current) {
                        distanceMatrix.set(x, y, newDist);
                        changed = true;
                    }
                }
            }
        }
        
        // Backward pass
        for (let x = 48; x >= 1; x--) {
            for (let y = 48; y >= 1; y--) {
                if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                    const current = distanceMatrix.get(x, y);
                    const newDist = Math.min(
                        distanceMatrix.get(x + 1, y) + 1,
                        distanceMatrix.get(x, y + 1) + 1,
                        distanceMatrix.get(x + 1, y + 1) + 1,
                        current
                    );
                    if (newDist < current) {
                        distanceMatrix.set(x, y, newDist);
                        changed = true;
                    }
                }
            }
        }
    }
    
    return distanceMatrix;
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
        // === CENTER: SPAWN (anchor point) ===
        [0, 0, STRUCTURE_SPAWN],       // Spawn at center (anchor)
        
        // === COMPLETE ROAD PERIMETER (10x5 rectangle) ===
        // Top edge (y = -2) - expanded by 2 tiles
        [-5, -2, STRUCTURE_ROAD], [-4, -2, STRUCTURE_ROAD], [-3, -2, STRUCTURE_ROAD], [-2, -2, STRUCTURE_ROAD], [-1, -2, STRUCTURE_ROAD], [0, -2, STRUCTURE_ROAD], 
        [1, -2, STRUCTURE_ROAD], [2, -2, STRUCTURE_ROAD], [3, -2, STRUCTURE_ROAD], [4, -2, STRUCTURE_ROAD],
        
        // Second row (y = -1) - roads with structures
        [-5, -1, STRUCTURE_ROAD], [-4, -1, STRUCTURE_ROAD], [-3, -1, STRUCTURE_ROAD], [-2, -1, STRUCTURE_ROAD], [-1, -1, STRUCTURE_ROAD], [0, -1, STRUCTURE_ROAD], 
        [1, -1, STRUCTURE_ROAD], [2, -1, STRUCTURE_ROAD], [3, -1, STRUCTURE_ROAD], [4, -1, STRUCTURE_ROAD],
        
        // Third row (y = 0) - roads with structures  
        [-5, 0, STRUCTURE_ROAD], [-4, 0, STRUCTURE_ROAD], [-3, 0, STRUCTURE_ROAD], [-2, 0, STRUCTURE_ROAD], [-1, 0, STRUCTURE_ROAD], [0, 0, STRUCTURE_ROAD], 
        [1, 0, STRUCTURE_ROAD], [2, 0, STRUCTURE_ROAD], [3, 0, STRUCTURE_ROAD], [4, 0, STRUCTURE_ROAD],
        
        // Fourth row (y = 1) - roads with structures
        [-5, 1, STRUCTURE_ROAD], [-4, 1, STRUCTURE_ROAD], [-3, 1, STRUCTURE_ROAD], [-2, 1, STRUCTURE_ROAD], [-1, 1, STRUCTURE_ROAD], [0, 1, STRUCTURE_ROAD], 
        [1, 1, STRUCTURE_ROAD], [2, 1, STRUCTURE_ROAD], [3, 1, STRUCTURE_ROAD], [4, 1, STRUCTURE_ROAD],
        
        // Bottom edge (y = 2) - expanded by 2 tiles
        [-5, 2, STRUCTURE_ROAD], [-4, 2, STRUCTURE_ROAD], [-3, 2, STRUCTURE_ROAD], [-2, 2, STRUCTURE_ROAD], [-1, 2, STRUCTURE_ROAD], [0, 2, STRUCTURE_ROAD], 
        [1, 2, STRUCTURE_ROAD], [2, 2, STRUCTURE_ROAD], [3, 2, STRUCTURE_ROAD], [4, 2, STRUCTURE_ROAD],
        
        // === STRUCTURES (placed on top of roads) ===
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



// Optimal extension field placement using distance transform
function placeExtensionFieldsOptimal(room, spawn, distanceTransform) {
    const extensionStamp = [
        // Complete road perimeter (5x5 square)
        [-2, -2, STRUCTURE_ROAD], [-1, -2, STRUCTURE_ROAD], [0, -2, STRUCTURE_ROAD], [1, -2, STRUCTURE_ROAD], [2, -2, STRUCTURE_ROAD],
        [-2, -1, STRUCTURE_ROAD], [-1, -1, STRUCTURE_ROAD], [0, -1, STRUCTURE_ROAD], [1, -1, STRUCTURE_ROAD], [2, -1, STRUCTURE_ROAD],
        [-2, 0, STRUCTURE_ROAD], [-1, 0, STRUCTURE_ROAD], [0, 0, STRUCTURE_ROAD], [1, 0, STRUCTURE_ROAD], [2, 0, STRUCTURE_ROAD],
        [-2, 1, STRUCTURE_ROAD], [-1, 1, STRUCTURE_ROAD], [0, 1, STRUCTURE_ROAD], [1, 1, STRUCTURE_ROAD], [2, 1, STRUCTURE_ROAD],
        [-2, 2, STRUCTURE_ROAD], [-1, 2, STRUCTURE_ROAD], [0, 2, STRUCTURE_ROAD], [1, 2, STRUCTURE_ROAD], [2, 2, STRUCTURE_ROAD],
        
        // Plus pattern rotated 45 degrees (diamond formation)
        [0, -1, STRUCTURE_EXTENSION], // Top
        [-1, 0, STRUCTURE_EXTENSION], // Left
        [0, 0, STRUCTURE_EXTENSION],  // Center
        [1, 0, STRUCTURE_EXTENSION],  // Right
        [0, 1, STRUCTURE_EXTENSION]   // Bottom
    ];
    
    const spawnPos = spawn.pos;
    const candidatePositions = [];
    
    // Find candidate positions within reasonable distance of spawn
    for (let x = Math.max(5, spawnPos.x - 15); x <= Math.min(44, spawnPos.x + 15); x++) {
        for (let y = Math.max(5, spawnPos.y - 15); y <= Math.min(44, spawnPos.y + 15); y++) {
            const distanceFromSpawn = Math.max(Math.abs(x - spawnPos.x), Math.abs(y - spawnPos.y));
            const wallDistance = distanceTransform.get(x, y);
            
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



// Optimal turret cluster placement using distance transform
function placeDefenseStampsOptimal(room, spawn, distanceTransform) {
    // Define a condensed 2x2 turret cluster with a surrounding road border
    const turretClusterStamp = [
        // Border roads (top row)
        [-1, -1, STRUCTURE_ROAD], [0, -1, STRUCTURE_ROAD], [1, -1, STRUCTURE_ROAD], [2, -1, STRUCTURE_ROAD],
        // Border roads (middle rows sides)
        [-1, 0, STRUCTURE_ROAD], [2, 0, STRUCTURE_ROAD],
        [-1, 1, STRUCTURE_ROAD], [2, 1, STRUCTURE_ROAD],
        // Border roads (bottom row)
        [-1, 2, STRUCTURE_ROAD], [0, 2, STRUCTURE_ROAD], [1, 2, STRUCTURE_ROAD], [2, 2, STRUCTURE_ROAD],
        // 4 Turrets in a condensed 2x2 square
        [0, 0, STRUCTURE_TOWER], [1, 0, STRUCTURE_TOWER],
        [0, 1, STRUCTURE_TOWER], [1, 1, STRUCTURE_TOWER]
    ];
    
    const spawnPos = spawn.pos;
    let bestPosition = null;
    let bestScore = 0;
    
    // Look for an optimal position for the turret cluster
    for (let x = Math.max(5, spawnPos.x - 10); x <= Math.min(44, spawnPos.x + 10); x++) {
        for (let y = Math.max(5, spawnPos.y - 10); y <= Math.min(44, spawnPos.y + 10); y++) {
            const distanceFromSpawn = Math.max(Math.abs(x - spawnPos.x), Math.abs(y - spawnPos.y));
            const wallDistance = distanceTransform.get(x, y);
            
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

// Wall and rampart gate placement - block room entrances with walls and rampart gates
function placeWallsWithGates(room, spawn) {
    const terrain = new Room.Terrain(room.name);
    
    console.log('🚪 Finding room entrance points for blocking...');
    
    // Find room edge entrance points only (ignore internal chokepoints)
    const entrances = findRoomEntrances(terrain);
    console.log(`Found ${entrances.length} room entrance groups`);
    
    // Debug: Log each entrance found
    entrances.forEach((entrance, index) => {
        console.log(`Entrance ${index + 1}: ${entrance.direction} at (${entrance.x},${entrance.y}) width ${entrance.width}`);
    });
    
    const wallPositions = [];
    const rampartPositions = [];
    
    // Process each entrance and place blocking walls with rampart gates
    entrances.forEach(entrance => {
        const defenseStructures = blockEntranceWithWallsAndGates(entrance, terrain);
        wallPositions.push(...defenseStructures.walls);
        rampartPositions.push(...defenseStructures.ramparts);
    });
    
    // Remove duplicates for walls
    const uniqueWalls = [];
    const wallPositionSet = new Set();
    
    for (const wall of wallPositions) {
        const key = `${wall.x},${wall.y}`;
        if (!wallPositionSet.has(key) && terrain.get(wall.x, wall.y) !== TERRAIN_MASK_WALL) {
            wallPositionSet.add(key);
            uniqueWalls.push(wall);
        }
    }
    
    // Remove duplicates for ramparts
    const uniqueRamparts = [];
    const rampartPositionSet = new Set();
    
    for (const rampart of rampartPositions) {
        const key = `${rampart.x},${rampart.y}`;
        if (!rampartPositionSet.has(key) && !wallPositionSet.has(key) && terrain.get(rampart.x, rampart.y) !== TERRAIN_MASK_WALL) {
            rampartPositionSet.add(key);
            uniqueRamparts.push(rampart);
        }
    }
    
    // Add walls to planned structures
    uniqueWalls.forEach(pos => {
        room.memory.plannedStructures.push({
            x: pos.x,
            y: pos.y,
            type: STRUCTURE_WALL
        });
    });
    
    // Add rampart gates to planned structures
    uniqueRamparts.forEach(pos => {
        room.memory.plannedStructures.push({
            x: pos.x,
            y: pos.y,
            type: STRUCTURE_RAMPART
        });
    });
    
    console.log(`🛡️ Entrance defense: ${uniqueWalls.length} walls and ${uniqueRamparts.length} rampart gates blocking room entrances`);
    
    // Log efficiency
    const roomArea = calculateOpenRoomArea(terrain);
    const totalDefenses = uniqueWalls.length + uniqueRamparts.length;
    const efficiency = roomArea / totalDefenses;
    console.log(`Defense efficiency: ${efficiency.toFixed(1)} open tiles protected per defense structure`);
}



// Find room entrance points along the edges
function findRoomEntrances(terrain) {
    const entrances = [];
    
    // Check all room edges for openings
    const edges = [
        { start: [0, 0], end: [49, 0], dir: 'top' },      // Top edge
        { start: [0, 49], end: [49, 49], dir: 'bottom' }, // Bottom edge
        { start: [0, 0], end: [0, 49], dir: 'left' },     // Left edge
        { start: [49, 0], end: [49, 49], dir: 'right' }   // Right edge
    ];
    
    edges.forEach(edge => {
        const positions = getEdgePositions(edge.start, edge.end);
        
        for (const pos of positions) {
            if (terrain.get(pos.x, pos.y) !== TERRAIN_MASK_WALL) {
                // This is an entrance - check how wide it is
                const entranceWidth = measureEntranceWidth(pos.x, pos.y, edge.dir, terrain);
                
                entrances.push({
                    x: pos.x,
                    y: pos.y,
                    width: entranceWidth,
                    direction: edge.dir,
                    type: 'entrance'
                });
            }
        }
    });
    
    // Group nearby entrance points and pick the center of each group
    return consolidateEntrances(entrances);
}

// Get all positions along an edge
function getEdgePositions(start, end) {
    const positions = [];
    const [x1, y1] = start;
    const [x2, y2] = end;
    
    if (x1 === x2) { // Vertical edge
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            positions.push({ x: x1, y: y });
        }
    } else { // Horizontal edge
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
            positions.push({ x: x, y: y1 });
        }
    }
    
    return positions;
}

// Measure how wide an entrance is
function measureEntranceWidth(x, y, direction, terrain) {
    let width = 1;
    
    if (direction === 'top' || direction === 'bottom') {
        // Horizontal entrance - check left and right
        let left = x - 1, right = x + 1;
        while (left >= 0 && terrain.get(left, y) !== TERRAIN_MASK_WALL) {
            width++;
            left--;
        }
        while (right <= 49 && terrain.get(right, y) !== TERRAIN_MASK_WALL) {
            width++;
            right++;
        }
    } else {
        // Vertical entrance - check up and down
        let up = y - 1, down = y + 1;
        while (up >= 0 && terrain.get(x, up) !== TERRAIN_MASK_WALL) {
            width++;
            up--;
        }
        while (down <= 49 && terrain.get(x, down) !== TERRAIN_MASK_WALL) {
            width++;
            down++;
        }
    }
    
    return width;
}

// Consolidate nearby entrance points into single strategic positions
function consolidateEntrances(entrances) {
    const consolidated = [];
    const processed = new Set();
    
    for (let i = 0; i < entrances.length; i++) {
        if (processed.has(i)) continue;
        
        const entrance = entrances[i];
        const group = [entrance];
        processed.add(i);
        
        // Find nearby entrances in the same group (more generous grouping)
        for (let j = i + 1; j < entrances.length; j++) {
            if (processed.has(j)) continue;
            
            const other = entrances[j];
            const distance = Math.max(Math.abs(entrance.x - other.x), Math.abs(entrance.y - other.y));
            
            // Group entrances that are close and on the same edge
            if (distance <= 5 && entrance.direction === other.direction) {
                group.push(other);
                processed.add(j);
            }
        }
        
        // Calculate the bounds of the entire entrance group
        if (entrance.direction === 'top' || entrance.direction === 'bottom') {
            // Horizontal entrance - find min/max X coordinates
            const minX = Math.min(...group.map(e => e.x - Math.floor(e.width/2)));
            const maxX = Math.max(...group.map(e => e.x + Math.floor(e.width/2)));
            const centerX = Math.round((minX + maxX) / 2);
            const totalWidth = maxX - minX + 1;
            
            consolidated.push({
                x: centerX,
                y: entrance.y,
                width: totalWidth,
                direction: entrance.direction,
                type: 'entrance',
                groupSize: group.length
            });
        } else {
            // Vertical entrance - find min/max Y coordinates  
            const minY = Math.min(...group.map(e => e.y - Math.floor(e.width/2)));
            const maxY = Math.max(...group.map(e => e.y + Math.floor(e.width/2)));
            const centerY = Math.round((minY + maxY) / 2);
            const totalWidth = maxY - minY + 1;
            
            consolidated.push({
                x: entrance.x,
                y: centerY,
                width: totalWidth,
                direction: entrance.direction,
                type: 'entrance',
                groupSize: group.length
            });
        }
    }
    
    return consolidated;
}



// Block an entrance with ramparts (placed 2 tiles inward from room edge)
function blockEntranceWithWallsAndGates(entrance, terrain) {
    const walls = [];
    const ramparts = [];
    const { x, y, direction, width } = entrance;
    
    // Calculate the inward position (2 tiles from room edge as per building rules)
    let blockX = x;
    let blockY = y;
    
    // Move block position 2 tiles inward from the edge
    if (direction === 'top') {
        blockY = 2; // 2 tiles down from top edge
    } else if (direction === 'bottom') {
        blockY = 47; // 2 tiles up from bottom edge  
    } else if (direction === 'left') {
        blockX = 2; // 2 tiles right from left edge
    } else if (direction === 'right') {
        blockX = 47; // 2 tiles left from right edge
    }
    
    console.log(`Blocking ${direction} entrance: center (${x},${y}) width ${width}`);
    
    // Calculate entrance span and gate positions
    let positions = [];
    if (direction === 'top' || direction === 'bottom') {
        // Horizontal entrance - place defenses along x-axis at fixed y
        const startX = Math.max(2, x - Math.floor(width/2));
        const endX = Math.min(47, x + Math.floor(width/2));
        
        for (let checkX = startX; checkX <= endX; checkX++) {
            if (terrain.get(checkX, blockY) !== TERRAIN_MASK_WALL) {
                positions.push({ x: checkX, y: blockY });
            }
        }
    } else {
        // Vertical entrance - place defenses along y-axis at fixed x
        const startY = Math.max(2, y - Math.floor(width/2));
        const endY = Math.min(47, y + Math.floor(width/2));
        
        for (let checkY = startY; checkY <= endY; checkY++) {
            if (terrain.get(blockX, checkY) !== TERRAIN_MASK_WALL) {
                positions.push({ x: blockX, y: checkY });
            }
        }
    }
    
    // Place walls on most positions, rampart gates in the middle 2 positions
    const totalPositions = positions.length;
    if (totalPositions <= 2) {
        // Small entrance - all ramparts (gates)
        ramparts.push(...positions);
    } else {
        // Larger entrance - walls on edges, 2 rampart gates in middle
        const middleStart = Math.floor((totalPositions - 2) / 2);
        const middleEnd = middleStart + 1;
        
        positions.forEach((pos, index) => {
            if (index === middleStart || index === middleEnd) {
                ramparts.push(pos);
            } else {
                walls.push(pos);
            }
        });
    }
    
    return { walls, ramparts };
}

// Calculate total open area in room
function calculateOpenRoomArea(terrain) {
    let openArea = 0;
    
    for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
            if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                openArea++;
            }
        }
    }
    
    return openArea;
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

// Smart road network planning - comprehensive connectivity
function planRoadNetwork(room, anchor, sources, controller) {
    console.log('Planning comprehensive road network...');
    
    // Key positions for road planning
    const corePos = new RoomPosition(anchor.x, anchor.y, room.name);
    const controllerPos = controller.pos;
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const spawnPos = spawn.pos;
    
    // Find placed extension fields and tower clusters from planned structures
    const extensionFields = [];
    const towerClusters = [];
    
    // Group planned structures by type and location
    const structureGroups = {};
    room.memory.plannedStructures.forEach(planned => {
        if (planned.type === STRUCTURE_EXTENSION) {
            const key = `${Math.floor(planned.x / 5)}_${Math.floor(planned.y / 5)}`;
            if (!structureGroups[key]) {
                structureGroups[key] = { extensions: [], x: planned.x, y: planned.y };
            }
            structureGroups[key].extensions.push(planned);
        } else if (planned.type === STRUCTURE_TOWER) {
            const key = `tower_${Math.floor(planned.x / 5)}_${Math.floor(planned.y / 5)}`;
            if (!structureGroups[key]) {
                structureGroups[key] = { towers: [], x: planned.x, y: planned.y };
            }
            structureGroups[key].towers = (structureGroups[key].towers || []);
            structureGroups[key].towers.push(planned);
        }
    });
    
    // Create extension field centers
    Object.values(structureGroups).forEach((group, index) => {
        if (group.extensions && group.extensions.length >= 3) {
            extensionFields.push({
                x: group.x,
                y: group.y,
                name: `Ext Field ${index + 1}`
            });
        }
        if (group.towers && group.towers.length >= 3) {
            towerClusters.push({
                x: group.x,
                y: group.y,
                name: `Tower Cluster ${index + 1}`
            });
        }
    });
    
    console.log(`Core at (${anchor.x},${anchor.y}), planning roads to ${sources.length} sources, ${extensionFields.length} extension fields, ${towerClusters.length} tower clusters`);
    
    // 1. Connect spawn to all sources
    sources.forEach((source, index) => {
        const path = PathFinder.search(spawnPos, { pos: source.pos, range: 2 }).path;
        addPathAsRoads(room, path, `Spawn → Source ${index + 1}`);
    });
    
    // 2. Connect spawn to controller
    const controllerPath = PathFinder.search(spawnPos, { pos: controllerPos, range: 3 }).path;
    addPathAsRoads(room, controllerPath, 'Spawn → Controller');
    
    // 3. Connect spawn to each extension field
    extensionFields.forEach(field => {
        const fieldPos = new RoomPosition(field.x, field.y, room.name);
        const path = PathFinder.search(spawnPos, { pos: fieldPos, range: 2 }).path;
        addPathAsRoads(room, path, `Spawn → ${field.name}`);
    });
    
    // 4. Connect spawn to tower clusters
    towerClusters.forEach(cluster => {
        const clusterPos = new RoomPosition(cluster.x, cluster.y, room.name);
        const path = PathFinder.search(spawnPos, { pos: clusterPos, range: 2 }).path;
        addPathAsRoads(room, path, `Spawn → ${cluster.name}`);
    });
    
    // 5. Connect extension fields to each other for redundancy
    for (let i = 0; i < extensionFields.length; i++) {
        for (let j = i + 1; j < extensionFields.length; j++) {
            const field1 = extensionFields[i];
            const field2 = extensionFields[j];
            const distance = Math.max(Math.abs(field1.x - field2.x), Math.abs(field1.y - field2.y));
            
            if (distance <= 15) { // Connect if reasonably close
                const pos1 = new RoomPosition(field1.x, field1.y, room.name);
                const pos2 = new RoomPosition(field2.x, field2.y, room.name);
                const path = PathFinder.search(pos1, { pos: pos2, range: 2 }).path;
                addPathAsRoads(room, path, `${field1.name} → ${field2.name}`);
            }
        }
    }
}

// Enhanced helper function: Add path positions as road structures with logging
function addPathAsRoads(room, path, routeName = 'Unknown Route') {
    let roadsAdded = 0;
    let roadsSkipped = 0;
    let structureConflicts = 0;
    
    // Place roads on every tile of the path except start and end positions for continuous connections
    for (let i = 1; i < path.length - 1; i++) {
        const pos = path[i];
        
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
    if (roadsAdded > 0 || roadsSkipped > 0 || structureConflicts > 0) {
        console.log(`🛣️ ${routeName}: ${roadsAdded} roads added, ${roadsSkipped} duplicates skipped, ${structureConflicts} structure conflicts avoided`);
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
                const name = 'mine:' + generateHexId();
                const result = spawn.spawnCreep(bodyToUse, name, { memory: { role: 'miner' } });
                if (result === OK) {
                    console.log(`Spawning miner: ${name} (${costToUse}/${bodyCosts.miner} energy)`);
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
                const name = 'haul:' + generateHexId();
                const result = spawn.spawnCreep(bodyToUse, name, { memory: { role: 'hauler' } });
                if (result === OK) {
                    console.log(`Spawning hauler: ${name} (${costToUse}/${bodyCosts.hauler} energy)`);
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
                const name = 'upgr:' + generateHexId();
                const result = spawn.spawnCreep(bodyToUse, name, { memory: { role: 'upgrader' } });
                if (result === OK) {
                    console.log(`Spawning upgrader: ${name} (${costToUse}/${bodyCosts.upgrader} energy)`);
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
                const name = 'bldr:' + generateHexId();
                const result = spawn.spawnCreep(bodyToUse, name, { memory: { role: 'builder' } });
                if (result === OK) {
                    console.log(`Spawning builder: ${name} (${costToUse}/${bodyCosts.builder} energy)`);
                }
                return;
            }
        } else {
            console.log(`⏳ Waiting for ${bodyCosts.builder} energy to spawn optimal builder (have ${energyAvailable})`);
        }
    }
}

// Hard-coded population targets by RCL
function getPopulationByRCL(rcl) {
    switch (rcl) {
        case 1:
            return { miner: 2, hauler: 1, upgrader: 1, builder: 2 };
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
            hauler: [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], // 16C8M
            upgrader: [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], // 10W3C3M
            builder: [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE] // 7W5C4M
        };
    } else if (energyCapacity >= 1300) { // RCL 5
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], // 12C6M
            upgrader: [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE], // 7W2C2M
            builder: [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE] // 5W4C3M
        };
    } else if (energyCapacity >= 800) { // RCL 4
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE], // 8C4M
            upgrader: [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE], // 5W2C1M
            builder: [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE] // 4W3C2M
        };
    } else if (energyCapacity >= 550) { // RCL 3
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], // 8C3M
            upgrader: [WORK, WORK, WORK, WORK, CARRY, MOVE], // 4W1C1M
            builder: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE] // 3W2C3M
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
    
    const rcl = room.controller.level;
    console.log(`🏗️ Creating construction sites for RCL ${rcl}...`);
    
    // Limit construction sites to avoid spam
    const existingConstructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
    if (existingConstructionSites >= 15) return; // Allow more construction sites
    
    // Filter structures by current RCL to avoid error spam
    const allowedStructures = getAllowedStructuresByRCL(rcl);
    
    // Sort planned structures by priority, with extensions sorted by distance to spawn
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const sortedPlannedStructures = [...room.memory.plannedStructures].sort((a, b) => {
        // Priority order for structure types - extensions first!
        const priorityOrder = [
            STRUCTURE_EXTENSION,
            STRUCTURE_SPAWN,
            STRUCTURE_STORAGE,
            STRUCTURE_TOWER,
            STRUCTURE_CONTAINER,
            STRUCTURE_WALL,
            STRUCTURE_RAMPART,
            STRUCTURE_ROAD,
            STRUCTURE_LINK,
            STRUCTURE_TERMINAL
        ];
        
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
    let rampartCount = 0;
    let totalPlanned = 0;
    let extensionsCreated = 0;
    let roadsSkipped = 0;
    
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
            if (planned.type === STRUCTURE_RAMPART) {
                rampartCount++;
            }
            continue;
        }
        
        // Skip roads until we have essential structures built
        if (planned.type === STRUCTURE_ROAD && !shouldBuildRoads) {
            roadsSkipped++;
            continue;
        }
        
        const pos = new RoomPosition(planned.x, planned.y, room.name);
        const structures = pos.lookFor(LOOK_STRUCTURES);
        const constructionSites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
        
        // Check if structure or construction site already exists
        const hasStructure = structures.some(s => s.structureType === planned.type);
        const hasConstructionSite = constructionSites.some(c => c.structureType === planned.type);
        
        if (!hasStructure && !hasConstructionSite) {
            // Prioritize extensions - create more extension sites if needed
            if (planned.type === STRUCTURE_EXTENSION) {
                const result = room.createConstructionSite(pos.x, pos.y, planned.type);
                if (result === OK) {
                    created++;
                    extensionsCreated++;
                    if (spawn) {
                        const distance = spawn.pos.getRangeTo(pos.x, pos.y);
                        console.log(`✅ PRIORITY: Created extension construction site at (${pos.x},${pos.y}) - distance ${distance} from spawn`);
                    }
                } else {
                    console.log(`❌ Failed to create ${planned.type} at (${pos.x},${pos.y}): ${result}`);
                }
            } else {
                // For non-extensions, only create if we have room and haven't maxed out extension sites
                const result = room.createConstructionSite(pos.x, pos.y, planned.type);
                if (result === OK) {
                    created++;
                    if (planned.type === STRUCTURE_ROAD) {
                        console.log(`✅ Created road construction site at (${pos.x},${pos.y}) - after ${existingExtensions} extensions built`);
                    } else if (planned.type === STRUCTURE_RAMPART) {
                        console.log(`✅ Created rampart construction site at (${pos.x},${pos.y})`);
                    }
                } else {
                    console.log(`❌ Failed to create ${planned.type} at (${pos.x},${pos.y}): ${result}`);
                }
            }
        }
        
        // Limit total construction sites, but allow more extensions
        if (created >= 10 && extensionsCreated >= 5) break;
    }
    
    if (created > 0) {
        console.log(`🏗️ Created ${created} construction sites (${extensionsCreated} extensions prioritized, ${rampartCount} ramparts waiting for RCL 2+)`);
    }
    if (roadsSkipped > 0) {
        console.log(`🛣️ Skipped ${roadsSkipped} roads - building extensions first (need ${5 - existingExtensions} more extensions and ${1 - existingContainers} more containers)`);
    }
    console.log(`📊 Total planned structures: ${totalPlanned}, RCL ${rcl} allows: ${allowedStructures.join(', ')}`);
}

// Helper function: Get allowed structures by RCL to prevent construction errors
function getAllowedStructuresByRCL(rcl) {
    const baseStructures = [STRUCTURE_ROAD, STRUCTURE_CONTAINER, STRUCTURE_EXTENSION];
    
    switch (rcl) {
        case 1:
            return [...baseStructures];
        case 2:
            return [...baseStructures, STRUCTURE_RAMPART, STRUCTURE_WALL];
        case 3:
            return [...baseStructures, STRUCTURE_RAMPART, STRUCTURE_WALL, STRUCTURE_TOWER];
        case 4:
            return [...baseStructures, STRUCTURE_RAMPART, STRUCTURE_WALL, STRUCTURE_TOWER, STRUCTURE_STORAGE];
        case 5:
            return [...baseStructures, STRUCTURE_RAMPART, STRUCTURE_WALL, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_LINK];
        case 6:
            return [...baseStructures, STRUCTURE_RAMPART, STRUCTURE_WALL, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_LINK, STRUCTURE_EXTRACTOR, STRUCTURE_LAB];
        case 7:
            return [...baseStructures, STRUCTURE_RAMPART, STRUCTURE_WALL, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_LINK, STRUCTURE_EXTRACTOR, STRUCTURE_LAB, STRUCTURE_FACTORY];
        case 8:
            return [...baseStructures, STRUCTURE_RAMPART, STRUCTURE_WALL, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_LINK, STRUCTURE_EXTRACTOR, STRUCTURE_LAB, STRUCTURE_FACTORY, STRUCTURE_TERMINAL, STRUCTURE_OBSERVER, STRUCTURE_POWER_SPAWN, STRUCTURE_NUKER];
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
    
    console.log(`\n=== BASE STATUS RCL ${rcl} ===`);
    console.log(`Controller: ${progress}/${progressTotal} (${progressPercent}%) - ${progressTotal - progress} to next RCL`);
    console.log(`Energy: ${energyAvailable}/${energyCapacity} (${((energyAvailable/energyCapacity)*100).toFixed(0)}%)`);
    console.log(`Expected Flow: ${expectedEnergyPerTick} energy/tick from ${sources.length} sources`);
    
    console.log(`\n--- POPULATION ---`);
    const targets = getPopulationByRCL(rcl);
    console.log(`Miners: ${creeps.miner.length}/${targets.miner} | Haulers: ${creeps.hauler.length}/${targets.hauler} (${busyHaulers} busy, ${idleHaulers} idle)`);
    console.log(`Upgraders: ${creeps.upgrader.length}/${targets.upgrader} | Builders: ${creeps.builder.length}/${targets.builder}`);
    
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
        [STRUCTURE_RAMPART]: '#2ECC71',
        [STRUCTURE_WALL]: '#95A5A6'
    };
            
    // Visualize planned structures
    room.memory.plannedStructures.forEach(planned => {
        const color = structureColors[planned.type] || '#FFFFFF';
        const pos = new RoomPosition(planned.x, planned.y, room.name);
        
        // Check if structure already exists
        const existingStructures = pos.lookFor(LOOK_STRUCTURES);
        const existingConstruction = pos.lookFor(LOOK_CONSTRUCTION_SITES);
        const hasStructure = existingStructures.some(s => s.structureType === planned.type);
        const hasConstruction = existingConstruction.some(c => c.structureType === planned.type);
        
        if (hasStructure) {
            // Structure is built - show as solid
            visual.circle(planned.x, planned.y, {
                radius: 0.35,
                fill: color,
                opacity: 0.8
            });
        } else if (hasConstruction) {
            // Under construction - show as dashed circle
            visual.circle(planned.x, planned.y, {
                radius: 0.35,
                fill: 'transparent',
                stroke: color,
                strokeWidth: 0.15,
                lineDash: [0.2, 0.1],
                opacity: 0.7
            });
        } else {
            // Planned but not built - show as dotted
            visual.circle(planned.x, planned.y, {
                radius: 0.25,
                fill: 'transparent',
                stroke: color,
                strokeWidth: 0.1,
                lineDash: [0.1, 0.1],
                opacity: 0.5
            });
        }
        
        // Special visualization for roads
        if (planned.type === STRUCTURE_ROAD) {
            visual.circle(planned.x, planned.y, {
                radius: 0.15,
                fill: color,
                opacity: hasStructure ? 0.6 : 0.3
            });
        }
        
        // Special visualization for walls
        if (planned.type === STRUCTURE_WALL) {
            visual.rect(planned.x - 0.4, planned.y - 0.4, 0.8, 0.8, {
                fill: hasStructure ? color : 'transparent',
                stroke: color,
                strokeWidth: 0.15,
                opacity: hasStructure ? 0.9 : 0.5
            });
        }
        
        // Special visualization for ramparts
        if (planned.type === STRUCTURE_RAMPART) {
            visual.rect(planned.x - 0.3, planned.y - 0.3, 0.6, 0.6, {
                fill: 'transparent',
                stroke: color,
                strokeWidth: 0.1,
                opacity: hasStructure ? 0.8 : 0.4
            });
        }
    });
    
        
    // Show legend in top-right corner
    const legendX = 45;
    const legendY = 5;
    visual.rect(legendX - 2, legendY - 1, 4, 9, {
        fill: '#000000',
        opacity: 0.7,
        stroke: '#FFFFFF',
        strokeWidth: 0.1
    });
    visual.text('LEGEND', legendX, legendY, {
        color: '#FFFFFF',
        font: 0.4,
        align: 'center'
    });
    
    const legendItems = [
        { color: '#FFE56D', text: 'Extensions' },
        { color: '#4ECDC4', text: 'Containers' },
        { color: '#FF8E53', text: 'Towers' },
        { color: '#555555', text: 'Roads' },
        { color: '#FF6B6B', text: 'Storage' },
        { color: '#2ECC71', text: 'Ramparts' },
        { color: '#95A5A6', text: 'Walls' },
        { color: '#9B59B6', text: 'Links' },
        { color: '#2287e6ff', text: 'Terminal' }
    ];
    
    legendItems.forEach((item, index) => {
        const y = legendY + 1 + (index * 0.8);
        visual.circle(legendX - 1, y, {
            radius: 0.15,
            fill: item.color,
            opacity: 0.8
        });
        visual.text(item.text, legendX - 0.5, y + 0.1, {
            color: '#FFFFFF',
            font: 0.3,
            align: 'left'
        });
    });
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
    
    // Find container near this source
    const container = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            return structure.structureType === STRUCTURE_CONTAINER &&
                   structure.pos.getRangeTo(source) <= 2;
        }
    })[0];

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
            // Use unified distribution system for all energy-gathering roles
            const target = getDistributedEnergyContainer(creep, sourceContainers);
            
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
                // Use unified source assignment for dropped energy too
                let target = null;
                
                if (creep.memory.assignedSource) {
                    const assignedSource = Game.getObjectById(creep.memory.assignedSource);
                    if (assignedSource) {
                        // Look for dropped energy near assigned source
                        target = droppedEnergy.find(drop => drop.pos.getRangeTo(assignedSource) <= 3);
                    }
                }
                
                if (!target) {
                    // No assigned source or no energy near it, ensure we have a source assignment
                    if (!creep.memory.assignedSource && sourceContainers.length > 0) {
                        getDistributedEnergyContainer(creep, sourceContainers); // This will assign a source
                    }
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
            const assignedSource = Game.getObjectById(creep.memory.assignedSource);
            if (assignedSource) {
                // Find container near this assigned source
                const assignedContainer = sourceContainers.find(container => 
                    container.pos.getRangeTo(assignedSource) <= 2
                );
                
                if (assignedContainer) {
                    // Valid assignment - return the container (even if empty)
                    return assignedContainer;
                } else {
                    // No container near assigned source - distribute among available containers based on assigned source
                    const sourceIndex = sources.findIndex(s => s.id === creep.memory.assignedSource);
                    const containerIndex = sourceIndex % sourceContainers.length;
                    return sourceContainers[containerIndex];
                }
            } else {
                // Assigned source no longer exists, clear assignment
                delete creep.memory.assignedSource;
            }
        }
        
        // No assignment or assignment was cleared - always assign one
        
        // Find source with least assigned creeps across ALL energy-gathering roles
        const energyGatheringCreeps = _.filter(Game.creeps, c => 
            (c.memory.role === 'hauler' || c.memory.role === 'builder' || c.memory.role === 'upgrader') && 
            c.name !== creep.name
        );
        const sourceAssignments = {};
        
        for (const source of sources) {
            sourceAssignments[source.id] = energyGatheringCreeps.filter(c => c.memory.assignedSource === source.id).length;
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

function manageDefenseHitPoints(room) {
    const rcl = room.controller.level;
    const wallTargetHits = WALL_TARGET_HITS[rcl] || WALL_TARGET_HITS[1];
    const rampartTargetHits = RAMPART_TARGET_HITS[rcl] || RAMPART_TARGET_HITS[1];
    
    // Check walls
    const walls = room.find(FIND_STRUCTURES, {
        filter: (structure) => structure.structureType === STRUCTURE_WALL
    });
    
    // Check ramparts
    const ramparts = room.find(FIND_STRUCTURES, {
        filter: (structure) => structure.structureType === STRUCTURE_RAMPART
    });
    
    // Count status for walls
    let wallsBelowTarget = 0;
    let wallsAtTarget = 0;
    let wallsCritical = 0;
    
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
    
    // Count status for ramparts
    let rampartsBelowTarget = 0;
    let rampartsAtTarget = 0;
    let rampartsCritical = 0;
    
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
    
    // Log defense status every 50 ticks for monitoring
    if (Game.time % 50 === 0 && (walls.length > 0 || ramparts.length > 0)) {
        console.log(`🛡️ Walls (RCL ${rcl}, target: ${wallTargetHits.toLocaleString()}): ${wallsAtTarget} at target, ${wallsBelowTarget} need repair (${wallsCritical} critical)`);
        console.log(`🚪 Rampart gates (target: ${rampartTargetHits.toLocaleString()}): ${rampartsAtTarget} at target, ${rampartsBelowTarget} need repair (${rampartsCritical} critical)`);
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
        STRUCTURE_RAMPART,
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
    
    // Find walls needing repair
    const walls = room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            return structure.structureType === STRUCTURE_WALL && 
                   structure.hits < wallTargetHits;
        }
    });
    
    // Find ramparts needing repair
    const ramparts = room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            return structure.structureType === STRUCTURE_RAMPART && 
                   structure.hits < rampartTargetHits;
        }
    });
    
    // Combine and sort by most urgent (lowest hit % compared to target)
    const allDefenses = [
        ...walls.map(wall => ({ structure: wall, targetHits: wallTargetHits, type: 'wall' })),
        ...ramparts.map(rampart => ({ structure: rampart, targetHits: rampartTargetHits, type: 'rampart' }))
    ];
    
    return allDefenses.sort((a, b) => {
        const aPercent = a.structure.hits / a.targetHits;
        const bPercent = b.structure.hits / b.targetHits;
        return aPercent - bPercent;
    }).map(item => item.structure);
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
        
        // If no assigned target, find a new one - prioritize defense repairs
        if (!target) {
            // First priority: Walls and ramparts needing repair
            const defensesNeedingRepair = getDefensesNeedingRepair(creep.room);
            if (defensesNeedingRepair.length > 0) {
                target = creep.pos.findClosestByPath(defensesNeedingRepair);
                if (target) {
                    creep.memory.buildTarget = target.id;
                    creep.memory.isRepairTask = true;
                    isRepairTask = true;
                }
            }
            
            // Second priority: Shared construction site (all builders work together)
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
                    let targetHits;
                    if (target.structureType === STRUCTURE_WALL) {
                        targetHits = WALL_TARGET_HITS[rcl] || WALL_TARGET_HITS[1];
                    } else if (target.structureType === STRUCTURE_RAMPART) {
                        targetHits = RAMPART_TARGET_HITS[rcl] || RAMPART_TARGET_HITS[1];
                    }
                    
                    if (targetHits && target.hits >= targetHits) {
                        // Defense structure is now at target level, clear assignment
                        delete creep.memory.buildTarget;
                        delete creep.memory.isRepairTask;
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
        // Get energy from source containers and storage only (exclude controller container)
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
