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

// Wall maintenance configuration - hit points by RCL
const WALL_TARGET_HITS = {
    1: 1000,        // RCL 1: Basic protection (1K hits)
    2: 10000,       // RCL 2: Light fortification (10K hits)
    3: 30000,       // RCL 3: Medium fortification (30K hits)
    4: 100000,      // RCL 4: Strong fortification (100K hits)
    5: 100000,      // RCL 5: Strong fortification (100K hits)
    6: 100000,      // RCL 6: Strong fortification (100K hits)
    7: 100000,      // RCL 7: Strong fortification (100K hits)
    8: 100000       // RCL 8: Strong fortification (100K hits)
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

    // Run tower defense
    runTowers(room);

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
    
    // Place extension fields near spawn
    placeExtensionFieldsOptimal(room, spawn);
    
    // Place tower clusters for better defense coverage
    placeDefenseStampsOptimal(room, spawn);
        
    // Connect everything with roads
    planRoadNetwork(room, anchor, sources, controller);
    
    // Place minimal bookend walls - just 2 walls per entrance at the endpoints
    // This strategy places walls only at the ends of each passable span, allowing
    // enemies to enter but significantly restricting their movement options
    const edgeSealPlan = planMinimalEdgeSeal(room);
    buildPlannedEdgeSeal(room, edgeSealPlan);

    // Add an interior "curtain" line 2 tiles inside the room across each entrance
    // with a single center rampart as a friendly gate.
    const entranceCurtainPlan = planEntranceCurtains(room);
    buildEntranceCurtains(room, entranceCurtainPlan);
    
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
function placeCoreStamp(room, spawn) {
    // Place core structures around spawn
    const anchor = { x: spawn.pos.x, y: spawn.pos.y }; // Anchor to the spawn position
    const coreStamp = [
        // === NON-ROAD STRUCTURES FIRST (to prevent roads underneath) ===
        
        // CENTER: SPAWN (anchor point)
        [0, 0, STRUCTURE_SPAWN],       // Spawn at center (anchor)
        
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

        addStampToPlannedStructures(room, { x: pos.x, y: pos.y }, stamp);

        const look = room.lookAt(pos.x, pos.y);
        let hasWallOrSite = false;
        for (const o of look) {
            if (o.type === LOOK_STRUCTURES && o.structure && o.structure.structureType === STRUCTURE_WALL) {
                hasWallOrSite = true;
                break;
            }
            if (o.type === LOOK_CONSTRUCTION_SITES && o.constructionSite && o.constructionSite.structureType === STRUCTURE_WALL) {
                hasWallOrSite = true;
                break;
            }
        }
        if (!hasWallOrSite) {
            room.createConstructionSite(pos.x, pos.y, STRUCTURE_WALL);
            newWallsPlanned++;
        }
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

        // Record in planned structures
        addStampToPlannedStructures(room, { x: item.x, y: item.y }, [[0, 0, item.type]]);

        // Create construction site if not already present
        const look = room.lookAt(item.x, item.y);
        let exists = false;
        for (const o of look) {
            if (o.type === LOOK_STRUCTURES && o.structure && o.structure.structureType === item.type) { exists = true; break; }
            if (o.type === LOOK_CONSTRUCTION_SITES && o.constructionSite && o.constructionSite.structureType === item.type) { exists = true; break; }
        }
        if (!exists) {
            const res = room.createConstructionSite(item.x, item.y, item.type);
            if (res === OK) {
                if (item.type === STRUCTURE_WALL) wallsPlanned++; else rampartsPlanned++;
            }
        }
    }
    if (wallsPlanned || rampartsPlanned) {
        console.log(`🧱 Curtains: planned ${wallsPlanned} walls and ${rampartsPlanned} ramparts`);
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

// Automated population control based on throughput calculations
function getPopulationByRCL(rcl) {
    const spawn = Game.spawns[Object.keys(Game.spawns)[0]];
    if (!spawn) return { miner: 2, hauler: 1, upgrader: 1, builder: 1 };

    const room = spawn.room;
    const sources = room.find(FIND_SOURCES);

    // Calculate average distance from spawn to sources for throughput math
    let totalDistance = 0;
    sources.forEach(source => {
        const path = PathFinder.search(spawn.pos, { pos: source.pos, range: 1 }, {
            roomCallback: () => createRoadPlanningCostMatrix(room),
            maxRooms: 1
        });
        totalDistance += path.cost;
    });
    const avgDistance = totalDistance / sources.length;

    // Throughput Math Implementation:
    // Trtt = 2d + 4 (round-trip time formula)
    const roundTripTime = 2 * avgDistance + 4;

    // CARRY = Math.ceil((2/5) * Trtt) for optimal hauler sizing
    const carryPerHauler = Math.ceil((2/5) * roundTripTime);

    // Total energy flow: sources × 10 energy/tick = 20 energy/tick
    const totalEnergyFlow = sources.length * 10;

    // Calculate hauler capacity per trip (CARRY parts × 50 energy)
    const energyPerTripPerHauler = carryPerHauler * 50;

    // Haulers needed = total energy flow / energy per trip per hauler
    // But account for travel time - haulers spend Trtt ticks traveling
    const haulerEfficiency = 1 / (1 + roundTripTime / 50); // Rough efficiency factor
    const haulersNeeded = Math.ceil(totalEnergyFlow / (energyPerTripPerHauler * haulerEfficiency));

    // Miners: Always 1 per source (5W1M can harvest 10 energy/tick, matching source output)
    const minersNeeded = sources.length;

    // Remaining energy after hauler needs for upgraders and builders
    const energyForUpgradersBuilders = Math.max(0, totalEnergyFlow - (haulersNeeded * energyPerTripPerHauler * haulerEfficiency));

    // Upgraders and builders scale with RCL and available energy
    let upgradersNeeded = 1;
    let buildersNeeded = 1;

    if (rcl >= 2) {
        // More upgraders at higher RCL for faster progression
        upgradersNeeded = Math.min(6, Math.max(1, Math.floor(energyForUpgradersBuilders / 5)));
        buildersNeeded = Math.min(4, Math.max(1, Math.floor(energyForUpgradersBuilders / 3)));
    }

    // Ensure minimums for stability
    const result = {
        miner: Math.max(1, minersNeeded),
        hauler: Math.max(1, haulersNeeded),
        upgrader: Math.max(1, upgradersNeeded),
        builder: Math.max(1, buildersNeeded)
    };

    // Log throughput calculations every 100 ticks
    if (Game.time % 100 === 0) {
        console.log(`📊 THROUGHPUT CALC: avgDist=${avgDistance.toFixed(1)}, Trtt=${roundTripTime.toFixed(1)}, carryNeeded=${carryPerHauler}, haulers=${result.hauler}, miners=${result.miner}`);
        console.log(`⚡ ENERGY FLOW: ${totalEnergyFlow} e/tick from ${sources.length} sources, ${energyForUpgradersBuilders.toFixed(1)} e/tick available for upgraders/builders`);
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
    const sources = room.find(FIND_SOURCES);

    // Calculate optimal hauler body based on throughput math
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
    const carryNeeded = Math.ceil((2/5) * roundTripTime);

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
            builder: [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE] // 7W5C4M
        };
    } else if (energyCapacity >= 1300) { // RCL 5
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: affordableHaulerBody, // Throughput-calculated
            upgrader: [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE], // 7W2C2M
            builder: [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE] // 5W4C3M
        };
    } else if (energyCapacity >= 800) { // RCL 4
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: affordableHaulerBody, // Throughput-calculated
            upgrader: [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE], // 5W2C1M
            builder: [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE] // 4W3C2M
        };
    } else if (energyCapacity >= 550) { // RCL 3
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: affordableHaulerBody, // Throughput-calculated
            upgrader: [WORK, WORK, WORK, WORK, CARRY, MOVE], // 4W1C1M
            builder: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE] // 3W2C3M
        };
    } else { // RCL 1-2
        return {
            miner: [WORK, WORK, MOVE], // 2W1M - only 250 energy
            hauler: affordableHaulerBody.length > 0 ? affordableHaulerBody : [CARRY, CARRY, MOVE], // Throughput-calculated or fallback
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
        // Priority order for structure types - extensions first!
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
                } else if (result !== ERR_RCL_NOT_ENOUGH) {
                    // Only log errors that aren't RCL-related spam
                    console.log(`❌ Failed to create ${planned.type} at (${pos.x},${pos.y}): ${result}`);
                }
            } else {
                // For non-extensions, only create if we have room and haven't maxed out extension sites
                const result = room.createConstructionSite(pos.x, pos.y, planned.type);
                if (result === OK) {
                    created++;
                    if (planned.type === STRUCTURE_ROAD) {
                        console.log(`✅ Created road construction site at (${pos.x},${pos.y}) - after ${existingExtensions} extensions built`);
                    }
                } else if (result !== ERR_RCL_NOT_ENOUGH) {
                    // Only log errors that aren't RCL-related spam
                    console.log(`❌ Failed to create ${planned.type} at (${pos.x},${pos.y}): ${result}`);
                }
            }
        }
        
        // Limit total construction sites, but allow more extensions
        if (created >= 10 && extensionsCreated >= 5) break;
    }
    
    if (created > 0) {
        console.log(`🏗️ Created ${created} construction sites (${extensionsCreated} extensions prioritized)`);
    }
    if (roadsSkipped > 0) {
        console.log(`🛣️ Skipped ${roadsSkipped} roads - building extensions first (need ${5 - existingExtensions} more extensions and ${1 - existingContainers} more containers)`);
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
        [STRUCTURE_WALL]: '#95A5A6',
        [STRUCTURE_RAMPART]: '#2ecc71'
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
            visual.rect(planned.x - 0.45, planned.y - 0.45, 0.9, 0.9, {
                fill: 'transparent',
                stroke: color,
                strokeWidth: 0.15,
                opacity: 0.8
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
        { color: '#95A5A6', text: 'Walls' },
        { color: '#2ecc71', text: 'Rampart (gate)' },
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
                        const repairResult = tower.repair(target);
                        if (repairResult === OK) {
                            console.log(`🔧 Tower repairing ${target.structureType} at (${target.pos.x},${target.pos.y}) - ${target.hits}/${target.hitsMax} hits`);
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
                const assignedContainer = sourceContainers.find(container => 
                    container.pos.getRangeTo(assignedSource) <= 2
                );
                if (assignedContainer) {
                    return assignedContainer;
                }
            } else {
                delete creep.memory.assignedSource;
            }
        }

        const leastUsedSource = getLeastUtilizedSource(creep.room);
        if (leastUsedSource) {
            const leastUsedContainer = sourceContainers.find(container => 
                container.pos.getRangeTo(leastUsedSource) <= 2
            );
            if (leastUsedContainer) {
                creep.memory.assignedSource = leastUsedSource.id;
                return leastUsedContainer;
            }
        }

        // Fallback: distribute using current role assignments if no container matched least-used source
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
    
    const walls = room.find(FIND_STRUCTURES, {
        filter: (structure) => structure.structureType === STRUCTURE_WALL
    });

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

    if (Game.time % 50 === 0 && walls.length > 0) {
        console.log(`🛡️ Walls (RCL ${rcl}, target: ${wallTargetHits.toLocaleString()}): ${wallsAtTarget} at target, ${wallsBelowTarget} need repair (${wallsCritical} critical)`);
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
    
    // Find walls and ramparts needing repair
    const defenses = room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            return (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) &&
                   structure.hits < wallTargetHits;
        }
    });

    return defenses
        .map(def => ({ structure: def, targetHits: wallTargetHits }))
        .sort((a, b) => {
            const aPercent = a.structure.hits / a.targetHits;
            const bPercent = b.structure.hits / b.targetHits;
            return aPercent - bPercent;
        })
        .map(item => item.structure);
}

function getStructuresNeedingRepair(room) {
    // Find all structures that are significantly damaged (below 80% of max hits)
    const damagedStructures = room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            // Skip walls (handled separately by getDefensesNeedingRepair)
            if (structure.structureType === STRUCTURE_WALL) {
                return false;
            }
            // Skip structures that are already at full health
            if (structure.hits >= structure.hitsMax) {
                return false;
            }
            // Only repair structures that are below 80% health
            return structure.hits / structure.hitsMax < 0.8;
        }
    });

    // Sort by most damaged first (lowest hit percentage)
    return damagedStructures.sort((a, b) => {
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
        
        // If no assigned target, find a new one - prioritize defense repairs
        if (!target) {
            // First priority: Walls needing repair
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
                    const targetHits = WALL_TARGET_HITS[rcl] || WALL_TARGET_HITS[1];
                    if (target.structureType === STRUCTURE_WALL && target.hits >= targetHits) {
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
        // Prioritize picking up dropped energy over containers
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
