/**
 * Mini-Screeps Bot - Pixel Focused
 * 
 * Goals:
 * 1. Primary: Earn Pixels (10,000 CPU = 1 Pixel)
 * 2. Secondary: Maintain base and upgrade controller
 * 
 * Features:
 * - Single room operation only
 * - No expansion or remote harvesting
 * - Minimal creep types: harvester, upgrader, builder
 * - Centralized base around controller
 * - No Labs or Factories
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
        harvester: _.filter(Game.creeps, creep => creep.memory.role === 'harvester'),
        upgrader: _.filter(Game.creeps, creep => creep.memory.role === 'upgrader'),
        builder: _.filter(Game.creeps, creep => creep.memory.role === 'builder')
    };

    // Plan base layout if not done
    if (!room.memory.basePlanned) {
        planBase(room);
        room.memory.basePlanned = true;
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

function spawnCreeps(spawn, creeps) {
    // Determine what we need
    const needs = {
        harvester: Math.max(2, Math.min(4, Math.floor(creeps.upgrader.length + creeps.builder.length + 1))),
        upgrader: Math.max(1, Math.min(3, Math.floor(creeps.harvester.length / 2))),
        builder: Math.max(1, Math.min(2, countMissingStructures(spawn.room) > 0 ? 1 : 0))
    };

    // Spawn priority: harvester > upgrader > builder
    if (creeps.harvester.length < needs.harvester && spawn.canCreateCreep([WORK, CARRY, MOVE]) === OK) {
        const name = 'Harvester' + Game.time;
        spawn.createCreep([WORK, CARRY, MOVE], name, { role: 'harvester' });
    } else if (creeps.upgrader.length < needs.upgrader && spawn.canCreateCreep([WORK, CARRY, MOVE]) === OK) {
        const name = 'Upgrader' + Game.time;
        spawn.createCreep([WORK, CARRY, MOVE], name, { role: 'upgrader' });
    } else if (creeps.builder.length < needs.builder && spawn.canCreateCreep([WORK, CARRY, MOVE]) === OK) {
        const name = 'Builder' + Game.time;
        spawn.createCreep([WORK, CARRY, MOVE], name, { role: 'builder' });
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
        case 'harvester':
            runHarvester(creep);
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
    // If creep is not carrying energy, go harvest
    if (creep.store.getFreeCapacity() > 0) {
        const source = creep.pos.findClosestByPath(FIND_SOURCES);
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
    } else {
        // Find container near the source we're harvesting from
        const source = creep.pos.findClosestByPath(FIND_SOURCES);
        const container = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return structure.structureType === STRUCTURE_CONTAINER &&
                       structure.pos.getRangeTo(source) <= 2 &&
                       structure.store.getFreeCapacity() > 0;
            }
        });

        if (container.length > 0) {
            const target = creep.pos.findClosestByPath(container);
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        } else {
            // No container near source, look for extensions/spawn/towers
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
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            } else {
                // No space in structures, go to storage
                const storage = creep.room.storage;
                if (storage && storage.store.getFreeCapacity() > 0) {
                    if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' } });
                    }
                }
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
        // Get energy from container near controller first
        const controllerContainer = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return structure.structureType === STRUCTURE_CONTAINER &&
                       structure.pos.getRangeTo(creep.room.controller) <= 3 &&
                       structure.store[RESOURCE_ENERGY] > 0;
            }
        });

        if (controllerContainer.length > 0) {
            const target = creep.pos.findClosestByPath(controllerContainer);
            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        } else {
            // No container near controller, get from storage or extensions
            const targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType === STRUCTURE_STORAGE ||
                            structure.structureType === STRUCTURE_EXTENSION ||
                            structure.structureType === STRUCTURE_CONTAINER) &&
                           structure.store[RESOURCE_ENERGY] > 0;
                }
            });

            if (targets.length > 0) {
                const target = creep.pos.findClosestByPath(targets);
                if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
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
        // Get energy from containers first, then storage/extensions
        const targets = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_CONTAINER ||
                        structure.structureType === STRUCTURE_STORAGE ||
                        structure.structureType === STRUCTURE_EXTENSION) &&
                       structure.store[RESOURCE_ENERGY] > 0;
            }
        });

        if (targets.length > 0) {
            const target = creep.pos.findClosestByPath(targets);
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
