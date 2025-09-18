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
    const controller = room.controller;
    
    // Count creeps by role
    const creeps = {
        miner: _.filter(Game.creeps, creep => creep.memory.role === 'miner'),
        hauler: _.filter(Game.creeps, creep => creep.memory.role === 'hauler'),
        upgrader: _.filter(Game.creeps, creep => creep.memory.role === 'upgrader'),
        builder: _.filter(Game.creeps, creep => creep.memory.role === 'builder')
    };

    // Plan base layout if not done
    if (!room.memory.basePlanned) {
        planBase(room);
        room.memory.basePlanned = true;
    }

    // Calculate and cache distances for throughput optimization
    if (!room.memory.distancesCalculated) {
        calculateDistances(room);
        room.memory.distancesCalculated = true;
    }

    // Spawn creeps based on needs
    spawnCreeps(spawn, creeps);

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
    
    // Find a good spot for the base (near controller and spawn)
    const basePos = findBasePosition(controller, spawn);
    if (!basePos) return;

    // Store base position in room memory
    room.memory.basePos = { x: basePos.x, y: basePos.y };
    
    // Plan base structures around the base
    const baseStructures = [
        STRUCTURE_EXTENSION,
        STRUCTURE_EXTENSION,
        STRUCTURE_EXTENSION,
        STRUCTURE_EXTENSION,
        STRUCTURE_EXTENSION,
        STRUCTURE_EXTENSION,
        STRUCTURE_EXTENSION,
        STRUCTURE_EXTENSION,
        STRUCTURE_EXTENSION,
        STRUCTURE_EXTENSION,
        STRUCTURE_TOWER,
        STRUCTURE_TOWER,
        STRUCTURE_LINK,
        STRUCTURE_STORAGE,
        STRUCTURE_TERMINAL
    ];

    room.memory.plannedStructures = [];
    
    // Arrange base structures in a grid pattern around the base
    const radius = 3;
    let structureIndex = 0;
    
    for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
            if (x === 0 && y === 0) continue; // Skip center (base position)
            
            const pos = new RoomPosition(basePos.x + x, basePos.y + y, room.name);
            if (pos.lookFor(LOOK_TERRAIN)[0] === 'wall') continue;
            
            if (structureIndex < baseStructures.length) {
                room.memory.plannedStructures.push({
                    x: pos.x,
                    y: pos.y,
                    type: baseStructures[structureIndex]
                });
                structureIndex++;
            }
        }
    }
    
    // Plan containers near sources
    for (const source of sources) {
        const containerPos = findContainerPosition(source);
        if (containerPos) {
            room.memory.plannedStructures.push({
                x: containerPos.x,
                y: containerPos.y,
                type: STRUCTURE_CONTAINER
            });
        }
    }
    
    // Plan container near controller for upgraders
    const controllerContainerPos = findControllerContainerPosition(controller);
    if (controllerContainerPos) {
        room.memory.plannedStructures.push({
            x: controllerContainerPos.x,
            y: controllerContainerPos.y,
            type: STRUCTURE_CONTAINER
        });
    }
    
    // Plan roads between sources and base for hauler efficiency
    planRoads(room);
}

function findBasePosition(controller, spawn) {
    // Find position between controller and spawn
    const path = controller.pos.findPathTo(spawn);
    if (path.length > 0) {
        const midIndex = Math.floor(path.length / 2);
        return path[midIndex];
    }
    return controller.pos;
}

function findContainerPosition(source) {
    // Find a position adjacent to the source for a container
    const positions = source.room.lookForAtArea(LOOK_TERRAIN, source.pos.y - 1, source.pos.x - 1, source.pos.y + 1, source.pos.x + 1, true);
    
    for (const position of positions) {
        if (position.terrain === 'plain' || position.terrain === 'swamp') {
            return { x: position.x, y: position.y };
        }
    }
    return null;
}

function findControllerContainerPosition(controller) {
    // Find a position near the controller for a container
    const positions = controller.room.lookForAtArea(LOOK_TERRAIN, controller.pos.y - 2, controller.pos.x - 2, controller.pos.y + 2, controller.pos.x + 2, true);
    
    for (const position of positions) {
        if (position.terrain === 'plain' || position.terrain === 'swamp') {
            // Make sure it's not too close to the controller (need 1 space)
            const distance = controller.pos.getRangeTo(position.x, position.y);
            if (distance >= 2 && distance <= 3) {
                return { x: position.x, y: position.y };
            }
        }
    }
    return null;
}

function calculateDistances(room) {
    const sources = room.find(FIND_SOURCES);
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const controller = room.controller;
    
    // Find the main sink (spawn or storage)
    const sink = spawn; // For now, use spawn as main sink
    
    room.memory.distances = [];
    room.memory.averageDistance = 0;
    
    let totalDistance = 0;
    
    for (const source of sources) {
        // Calculate distance from source to sink
        const path = source.pos.findPathTo(sink);
        const distance = path.length;
        
        room.memory.distances.push({
            sourceId: source.id,
            distance: distance
        });
        
        totalDistance += distance;
    }
    
    room.memory.averageDistance = Math.round(totalDistance / sources.length);
    
    // Calculate throughput requirements
    const Trtt = 2 * room.memory.averageDistance + 4; // Round trip time with roads
    const totalCarryNeeded = Math.ceil((2/5) * Trtt); // 2/5 = 20 energy/tick / 50 energy per CARRY
    
    room.memory.throughput = {
        Trtt: Trtt,
        totalCarryNeeded: totalCarryNeeded,
        energyPerTick: 20 // 2 sources * 10 energy/tick each
    };
    
    console.log(`Distance calculation complete: avg=${room.memory.averageDistance}, Trtt=${Trtt}, carryNeeded=${totalCarryNeeded}`);
}

function planRoads(room) {
    const sources = room.find(FIND_SOURCES);
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const basePos = room.memory.basePos;
    
    if (!basePos) return;
    
    const baseRoomPos = new RoomPosition(basePos.x, basePos.y, room.name);
    
    // Plan roads from each source to base
    for (const source of sources) {
        const path = source.pos.findPathTo(baseRoomPos, {
            ignoreCreeps: true,
            ignoreRoads: true
        });
        
        // Add road construction sites along the path (every few steps for efficiency)
        for (let i = 0; i < path.length; i += 2) { // Every 2 steps to avoid too many roads
            const pos = path[i];
            const roomPos = new RoomPosition(pos.x, pos.y, room.name);
            
            // Check if there's already a structure planned or built here
            const existingStructure = roomPos.lookFor(LOOK_STRUCTURES)[0];
            const plannedStructure = room.memory.plannedStructures.find(p => p.x === pos.x && p.y === pos.y);
            
            if (!existingStructure && !plannedStructure) {
                room.memory.plannedStructures.push({
                    x: pos.x,
                    y: pos.y,
                    type: STRUCTURE_ROAD
                });
            }
        }
    }
    
    // Plan roads from base to controller
    const controller = room.controller;
    const controllerPath = baseRoomPos.findPathTo(controller, {
        ignoreCreeps: true,
        ignoreRoads: true
    });
    
    for (let i = 0; i < controllerPath.length; i += 2) {
        const pos = controllerPath[i];
        const roomPos = new RoomPosition(pos.x, pos.y, room.name);
        
        const existingStructure = roomPos.lookFor(LOOK_STRUCTURES)[0];
        const plannedStructure = room.memory.plannedStructures.find(p => p.x === pos.x && p.y === pos.y);
        
        if (!existingStructure && !plannedStructure) {
            room.memory.plannedStructures.push({
                x: pos.x,
                y: pos.y,
                type: STRUCTURE_ROAD
            });
        }
    }
}

function spawnCreeps(spawn, creeps) {
    const room = spawn.room;
    const energyCapacity = room.energyCapacityAvailable;
    
    // Get throughput data
    const throughput = room.memory.throughput;
    if (!throughput) {
        console.log('Throughput data not available, using basic spawn logic');
        return;
    }
    
    // Calculate optimal body parts based on throughput requirements
    const minerBody = [WORK, WORK, WORK, WORK, WORK, MOVE]; // 5W 1M for continuous mining
    const minerCost = 550; // 5*100 + 1*50
    
    // Calculate hauler body based on throughput
    const totalCarryNeeded = throughput.totalCarryNeeded;
    const numHaulers = (energyCapacity >= 800) ? 2 : 3; // More haulers for lower energy cap
    const carryPerHauler = Math.ceil(totalCarryNeeded / numHaulers);
    const movePerHauler = Math.ceil(carryPerHauler / 2); // Assume roads for efficiency
    
    const haulerBody = [];
    for (let i = 0; i < carryPerHauler; i++) haulerBody.push(CARRY);
    for (let i = 0; i < movePerHauler; i++) haulerBody.push(MOVE);
    const haulerCost = carryPerHauler * 50 + movePerHauler * 50;
    
    // Determine needs based on throughput optimization and room state
    const missingStructures = countMissingStructures(room);
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
    const hasConstructionWork = missingStructures > 0 || constructionSites > 0;
    
    // Dynamic energy allocation based on throughput math
    const availableEnergyPerTick = throughput.energyPerTick;
    const builderEnergyPerTick = hasConstructionWork ? 10 : 0; // 2 WORK * 5 energy/tick
    const upgraderEnergyPerTick = Math.max(4, availableEnergyPerTick - builderEnergyPerTick); // Min 4 for controller maintenance
    
    const needs = {
        miner: 2, // One per source, fixed
        hauler: numHaulers,
        upgrader: Math.max(1, Math.min(4, Math.floor(upgraderEnergyPerTick / 2))), // ~2 energy/tick per upgrader
        builder: hasConstructionWork ? 1 : 0
    };
    
    // Spawn priority: miner > hauler > upgrader > builder
    if (creeps.miner.length < needs.miner && spawn.canCreateCreep(minerBody) === OK) {
        const name = 'Miner' + Game.time;
        spawn.createCreep(minerBody, name, { role: 'miner' });
        console.log(`Spawning miner with body: ${minerBody.length} parts, cost: ${minerCost}`);
    } else if (creeps.hauler.length < needs.hauler && spawn.canCreateCreep(haulerBody) === OK) {
        const name = 'Hauler' + Game.time;
        spawn.createCreep(haulerBody, name, { role: 'hauler' });
        console.log(`Spawning hauler with body: ${haulerBody.length} parts (${carryPerHauler}C ${movePerHauler}M), cost: ${haulerCost}`);
    } else if (creeps.upgrader.length < needs.upgrader && spawn.canCreateCreep([WORK, CARRY, MOVE]) === OK) {
        const name = 'Upgrader' + Game.time;
        spawn.createCreep([WORK, CARRY, MOVE], name, { role: 'upgrader' });
    } else if (creeps.builder.length < needs.builder && spawn.canCreateCreep([WORK, CARRY, MOVE]) === OK) {
        const name = 'Builder' + Game.time;
        spawn.createCreep([WORK, CARRY, MOVE], name, { role: 'builder' });
    }
    
    // Log current creep status and energy flow
    if (Game.time % 100 === 0) {
        console.log(`Creeps: M:${creeps.miner.length}/${needs.miner}, H:${creeps.hauler.length}/${needs.hauler}, U:${creeps.upgrader.length}/${needs.upgrader}, B:${creeps.builder.length}/${needs.builder}`);
        console.log(`Energy Flow: ${availableEnergyPerTick} e/t → Builders:${builderEnergyPerTick}, Upgraders:${upgraderEnergyPerTick}, Missing:${missingStructures}`);
    }
}

function countMissingStructures(room) {
    if (!room.memory.plannedStructures) return 0;
    
    let missing = 0;
    for (const planned of room.memory.plannedStructures) {
        const pos = new RoomPosition(planned.x, planned.y, room.name);
        const structures = pos.lookFor(LOOK_STRUCTURES);
        const hasStructure = structures.some(s => s.structureType === planned.type);
        if (!hasStructure) missing++;
    }
    return missing;
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
    // Find assigned source or closest source
    let source = null;
    if (creep.memory.sourceId) {
        source = Game.getObjectById(creep.memory.sourceId);
    }
    
    if (!source) {
        // Assign to a source that doesn't have a dedicated miner
        const sources = creep.room.find(FIND_SOURCES);
        const miners = _.filter(Game.creeps, c => c.memory.role === 'miner');
        const assignedSources = miners.map(m => m.memory.sourceId).filter(id => id);
        
        for (const s of sources) {
            if (!assignedSources.includes(s.id)) {
                source = s;
                creep.memory.sourceId = s.id;
                break;
            }
        }
        
        // If all sources are assigned, use closest
        if (!source) {
            source = creep.pos.findClosestByPath(FIND_SOURCES);
            creep.memory.sourceId = source.id;
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
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                // Container is not adjacent to source, this shouldn't happen
                console.log(`Container not adjacent to source ${source.id}`);
            }
        } else {
            // Move to container
            creep.moveTo(container.pos, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
    } else {
        // No container yet, move to source and harvest normally
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
    }
}

function runHauler(creep) {
    // Haulers move energy from source containers to spawn/extensions/storage
    
    // If carrying energy, find a sink to deliver to
    if (creep.store[RESOURCE_ENERGY] > 0) {
        const targets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_SPAWN ||
                        structure.structureType === STRUCTURE_TOWER ||
                        structure.structureType === STRUCTURE_STORAGE) &&
                       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });

        if (targets.length > 0) {
            // Prioritize extensions and spawn over storage
            const priorityTargets = targets.filter(t => 
                t.structureType === STRUCTURE_EXTENSION || 
                t.structureType === STRUCTURE_SPAWN || 
                t.structureType === STRUCTURE_TOWER
            );
            
            const target = creep.pos.findClosestByPath(priorityTargets.length > 0 ? priorityTargets : targets);
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    } else {
        // Not carrying energy, find source containers to pick up from
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return structure.structureType === STRUCTURE_CONTAINER &&
                       structure.store[RESOURCE_ENERGY] > 0;
            }
        });

        if (containers.length > 0) {
            const target = creep.pos.findClosestByPath(containers);
            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    }
}

function runUpgrader(creep) {
    // Always prioritize upgrading the controller
    if (creep.store[RESOURCE_ENERGY] > 0) {
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
        }
    } else {
        // Get energy from spawn/extensions/storage (haulers deliver here)
        const targets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_SPAWN ||
                        structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_STORAGE) &&
                       structure.store[RESOURCE_ENERGY] > 0;
            }
        });

        if (targets.length > 0) {
            // Prioritize extensions and spawn over storage
            const priorityTargets = targets.filter(t => 
                t.structureType === STRUCTURE_EXTENSION || 
                t.structureType === STRUCTURE_SPAWN
            );
            
            const target = creep.pos.findClosestByPath(priorityTargets.length > 0 ? priorityTargets : targets);
            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    }
}

function runBuilder(creep) {
    // If creep has energy, build things
    if (creep.store[RESOURCE_ENERGY] > 0) {
        const targets = creep.room.find(FIND_CONSTRUCTION_SITES);
        if (targets.length > 0) {
            const target = creep.pos.findClosestByPath(targets);
            if (creep.build(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        } else {
            // No construction sites, help upgrade
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    } else {
        // Get energy from spawn/extensions/storage (haulers deliver here)
        const targets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_SPAWN ||
                        structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_STORAGE) &&
                       structure.store[RESOURCE_ENERGY] > 0;
            }
        });

        if (targets.length > 0) {
            // Prioritize extensions and spawn over storage
            const priorityTargets = targets.filter(t => 
                t.structureType === STRUCTURE_EXTENSION || 
                t.structureType === STRUCTURE_SPAWN
            );
            
            const target = creep.pos.findClosestByPath(priorityTargets.length > 0 ? priorityTargets : targets);
            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    }
}

function manageCPUForPixels() {
    const cpuUsed = Game.cpu.getUsed();
    const cpuLimit = Game.cpu.limit;
    const cpuBucket = Game.cpu.bucket;
    
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
}
