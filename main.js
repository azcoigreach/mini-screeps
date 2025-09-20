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
        harvester: _.filter(Game.creeps, creep => creep.memory.role === 'harvester'),
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

function generateHexId() {
    return Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
}

// Simplified population control based on room controller level
function spawnCreeps(spawn, creeps) {
    const room = spawn.room;
    const rcl = room.controller.level;
    const energyCapacity = room.energyCapacityAvailable;
    
    // Hard-coded population targets based on RCL
    const populationTargets = getPopulationByRCL(rcl);
    const bodies = getBodiesByEnergyCapacity(energyCapacity);
    
    // Simple spawn priority: harvester > miner > hauler > upgrader > builder
    if (creeps.harvester.length < populationTargets.harvester) {
        if (spawn.canCreateCreep(bodies.harvester) === OK) {
            const name = 'harv:' + generateHexId();
            spawn.createCreep(bodies.harvester, name, { role: 'harvester' });
            console.log(`Spawning harvester (${creeps.harvester.length + 1}/${populationTargets.harvester})`);
            return;
        }
    }
    
    if (creeps.miner.length < populationTargets.miner) {
        if (spawn.canCreateCreep(bodies.miner) === OK) {
            const name = 'mine:' + generateHexId();
            spawn.createCreep(bodies.miner, name, { role: 'miner' });
            console.log(`Spawning miner (${creeps.miner.length + 1}/${populationTargets.miner})`);
            return;
        }
    }
    
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
            return { harvester: 2, miner: 0, hauler: 0, upgrader: 1, builder: 1 };
        case 2:
            return { harvester: 2, miner: 0, hauler: 0, upgrader: 2, builder: 1 };
        case 3:
            return { harvester: 1, miner: 2, hauler: 2, upgrader: 2, builder: 1 };
        case 4:
            return { harvester: 0, miner: 2, hauler: 2, upgrader: 3, builder: 1 };
        case 5:
            return { harvester: 0, miner: 2, hauler: 2, upgrader: 4, builder: 1 };
        case 6:
            return { harvester: 0, miner: 2, hauler: 2, upgrader: 4, builder: 1 };
        case 7:
            return { harvester: 0, miner: 2, hauler: 3, upgrader: 5, builder: 2 };
        case 8:
            return { harvester: 0, miner: 2, hauler: 3, upgrader: 6, builder: 2 };
        default:
            return { harvester: 1, miner: 0, hauler: 0, upgrader: 1, builder: 1 };
    }
}

// Hard-coded body configurations by energy capacity
function getBodiesByEnergyCapacity(energyCapacity) {
    if (energyCapacity >= 1800) { // RCL 6+
        return {
            harvester: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], // 3W2C3M
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE], // 8C4M
            upgrader: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], // 3W2C3M
            builder: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE] // 3W2C3M
        };
    } else if (energyCapacity >= 1300) { // RCL 5
        return {
            harvester: [WORK, WORK, CARRY, CARRY, MOVE, MOVE], // 2W2C2M
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], // 6C3M
            upgrader: [WORK, WORK, CARRY, CARRY, MOVE, MOVE], // 2W2C2M
            builder: [WORK, WORK, CARRY, CARRY, MOVE, MOVE] // 2W2C2M
        };
    } else if (energyCapacity >= 800) { // RCL 4
        return {
            harvester: [WORK, WORK, CARRY, MOVE], // 2W1C1M
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE], // 4C2M
            upgrader: [WORK, WORK, CARRY, MOVE], // 2W1C1M
            builder: [WORK, WORK, CARRY, MOVE] // 2W1C1M
        };
    } else if (energyCapacity >= 550) { // RCL 3
        return {
            harvester: [WORK, CARRY, MOVE], // 1W1C1M
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M
            hauler: [CARRY, CARRY, MOVE], // 2C1M
            upgrader: [WORK, CARRY, MOVE], // 1W1C1M
            builder: [WORK, CARRY, MOVE] // 1W1C1M
        };
    } else { // RCL 1-2
        return {
            harvester: [WORK, CARRY, MOVE], // 1W1C1M
            miner: [WORK, WORK, WORK, MOVE], // 3W1M
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
        case 'harvester':
            runHarvester(creep);
            break;
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

function runHarvester(creep) {
    // Bootstrap harvester: harvest and deliver energy to spawn/extensions
    if (creep.store.getFreeCapacity() > 0) {
        const sources = creep.room.find(FIND_SOURCES);
        if (sources.length === 0) {
            console.log(`No sources found in room ${creep.room.name}`);
            return;
        }
        const source = creep.pos.findClosestByPath(sources);
        if (!source) {
            console.log(`No valid path to source for ${creep.name}`);
            return;
        }
        const harvestResult = creep.harvest(source);
        if (harvestResult === ERR_NOT_IN_RANGE) {
            const moveResult = creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            if (moveResult !== OK) {
                console.log(`Move error for ${creep.name}: ${moveResult}`);
            }
        } else if (harvestResult !== OK) {
            console.log(`Harvest error for ${creep.name}: ${harvestResult}`);
        }
    } else {
        // Find spawn/extensions to deliver energy to
        const targets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_SPAWN ||
                        structure.structureType === STRUCTURE_TOWER) &&
                       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });

        if (targets.length > 0) {
            const target = creep.pos.findClosestByPath(targets);
            if (target) {
                const transferResult = creep.transfer(target, RESOURCE_ENERGY);
                if (transferResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                } else if (transferResult !== OK) {
                    console.log(`Harvester transfer error: ${transferResult}`);
                }
            }
        } else {
            // No space in structures, find other creeps that need energy
            const needyCreeps = creep.room.find(FIND_MY_CREEPS, {
                filter: c => (c.memory.role === 'upgrader' || c.memory.role === 'builder') && 
                           c.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
            
            if (needyCreeps.length > 0) {
                const target = creep.pos.findClosestByPath(needyCreeps);
                if (target) {
                    const transferResult = creep.transfer(target, RESOURCE_ENERGY);
                    if (transferResult === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                }
            } else {
                // No one needs energy, help upgrade controller
                const controller = creep.room.controller;
                if (controller) {
                    const upgradeResult = creep.upgradeController(controller);
                    if (upgradeResult === ERR_NOT_IN_RANGE) {
                        creep.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                }
            }
        }
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
        // In bootstrap phase, get energy from harvesters or wait near spawn
        const harvesters = creep.room.find(FIND_MY_CREEPS, {
            filter: c => c.memory.role === 'harvester' && c.store[RESOURCE_ENERGY] > 0
        });
        
        const extensions = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION && s.store[RESOURCE_ENERGY] > 0
        });
        
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
        });
        
        const storage = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > 0
        });
        
        // Priority: extensions > containers > storage > harvesters
        let target = null;
        if (extensions.length > 0) {
            target = creep.pos.findClosestByPath(extensions);
        } else if (containers.length > 0) {
            target = creep.pos.findClosestByPath(containers);
        } else if (storage.length > 0) {
            target = creep.pos.findClosestByPath(storage);
        } else if (harvesters.length > 0) {
            target = creep.pos.findClosestByPath(harvesters);
        }
        
        if (target) {
            if (target.structureType) {
                // It's a structure, withdraw from it
                const withdrawResult = creep.withdraw(target, RESOURCE_ENERGY);
                if (withdrawResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                } else if (withdrawResult !== OK && withdrawResult !== ERR_NOT_ENOUGH_RESOURCES) {
                    console.log(`Upgrader withdraw error: ${withdrawResult}`);
                }
            } else {
                // It's a harvester creep, get energy from it
                const transferResult = target.transfer(creep, RESOURCE_ENERGY);
                if (transferResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                } else if (transferResult !== OK && transferResult !== ERR_NOT_ENOUGH_RESOURCES) {
                    console.log(`Upgrader transfer error: ${transferResult}`);
                }
            }
        } else {
            // No energy available, move to spawn and wait
            const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
            if (spawn && creep.pos.getRangeTo(spawn) > 1) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
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
            if (target) {
                const buildResult = creep.build(target);
                if (buildResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                } else if (buildResult !== OK) {
                    console.log(`Build error: ${buildResult} for creep ${creep.name}`);
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
        // In bootstrap phase, get energy from harvesters or wait near spawn
        const harvesters = creep.room.find(FIND_MY_CREEPS, {
            filter: c => c.memory.role === 'harvester' && c.store[RESOURCE_ENERGY] > 0
        });
        
        const extensions = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION && s.store[RESOURCE_ENERGY] > 0
        });
        
        const containers = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
        });
        
        const storage = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > 0
        });
        
        // Priority: extensions > containers > storage > harvesters
        let target = null;
        if (extensions.length > 0) {
            target = creep.pos.findClosestByPath(extensions);
        } else if (containers.length > 0) {
            target = creep.pos.findClosestByPath(containers);
        } else if (storage.length > 0) {
            target = creep.pos.findClosestByPath(storage);
        } else if (harvesters.length > 0) {
            target = creep.pos.findClosestByPath(harvesters);
        }
        
        if (target) {
            if (target.structureType) {
                // It's a structure, withdraw from it
                const withdrawResult = creep.withdraw(target, RESOURCE_ENERGY);
                if (withdrawResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                } else if (withdrawResult !== OK && withdrawResult !== ERR_NOT_ENOUGH_RESOURCES) {
                    console.log(`Builder withdraw error: ${withdrawResult}`);
                }
            } else {
                // It's a harvester creep, get energy from it
                const transferResult = target.transfer(creep, RESOURCE_ENERGY);
                if (transferResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                } else if (transferResult !== OK && transferResult !== ERR_NOT_ENOUGH_RESOURCES) {
                    console.log(`Builder transfer error: ${transferResult}`);
                }
            }
        } else {
            // No energy available, move to spawn and wait
            const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
            if (spawn && creep.pos.getRangeTo(spawn) > 1) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
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
