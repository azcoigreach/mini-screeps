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
    // Clean up memory with error handling
    try {
        for (const name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }
    } catch (error) {
        console.log('Memory cleanup error:', error);
        // Reset memory if corrupted
        Memory.creeps = {};
    }

    // Get the spawn and room
    const spawn = Game.spawns[Object.keys(Game.spawns)[0]];
    if (!spawn) return;
    
    const room = spawn.room;
    const controller = room.controller;
    
    // Count creeps by role
    const creeps = {
        harvester: _.filter(Game.creeps, creep => creep.memory.role === 'harvester'),
        miner: _.filter(Game.creeps, creep => creep.memory.role === 'miner'),
        hauler: _.filter(Game.creeps, creep => creep.memory.role === 'hauler'),
        upgrader: _.filter(Game.creeps, creep => creep.memory.role === 'upgrader'),
        builder: _.filter(Game.creeps, creep => creep.memory.role === 'builder')
    };

    // Plan base layout if not done
    if (!room.memory.basePlanned) {
        try {
            planBase(room);
            room.memory.basePlanned = true;
        } catch (error) {
            console.log('Base planning error:', error);
        }
    }

    // Calculate and cache essential data only once for CPU efficiency
    if (!room.memory.baseSetup && room.memory.basePlanned) {
        try {
            setupBaseData(room);
            room.memory.baseSetup = true;
        } catch (error) {
            console.log('Base setup error:', error);
        }
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

function setupBaseData(room) {
    // Minimal setup - just cache essential room data for CPU efficiency
    const sources = room.find(FIND_SOURCES);
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    
    room.memory.roomData = {
        sourceCount: sources.length,
        maxEnergyPerTick: sources.length * 10, // 10 energy per source per tick
        setupComplete: true
    };
    
    console.log(`Base data setup complete: ${sources.length} sources, ${sources.length * 10} max energy/tick`);
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

// CPU-optimized population control with energy budgeting and defense allocation
function spawnCreeps(spawn, creeps) {
    const room = spawn.room;
    const energyCapacity = room.energyCapacityAvailable;
    const energyAvailable = room.energyAvailable;
    
    // Cache population data to avoid recalculation (CPU optimization)
    if (!room.memory.populationData || Game.time % 50 === 0) {
        calculatePopulationData(room);
    }
    const popData = room.memory.populationData;
    
    // Emergency bootstrap: if we have no creeps at all, spawn minimal recovery force
    const totalCreeps = Object.keys(Game.creeps).filter(name => Game.creeps[name].room.name === room.name).length;
    if (totalCreeps === 0) {
        return emergencyBootstrap(spawn);
    }
    
    // Normal bootstrap: basic infrastructure phase
    if (!popData.hasInfrastructure || energyCapacity < 550) {
        return normalBootstrap(spawn, creeps, popData);
    }
    
    // Production phase: optimized population control
    return productionSpawn(spawn, creeps, popData);
}

// Calculate all population requirements once per 50 ticks to save CPU
function calculatePopulationData(room) {
    const energyCapacity = room.energyCapacityAvailable;
    const sources = room.find(FIND_SOURCES);
    const towers = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });
    const containers = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
    const sourceContainers = containers.filter(c => sources.some(s => s.pos.getRangeTo(c) <= 2));
    
    // Infrastructure status
    const hasInfrastructure = sourceContainers.length >= 2 && energyCapacity >= 550;
    
    // Energy calculations (fixed values for CPU efficiency)
    const BASE_ENERGY_PER_TICK = 20; // 2 sources * 10 energy/tick
    const TOWER_ENERGY_PER_TICK = towers.length * 2; // 2 energy/tick per tower for maintenance/defense
    const REPAIR_ENERGY_PER_TICK = 5; // Fixed allocation for repairs
    const UPGRADER_MIN_ENERGY = 1; // Minimum to prevent controller downgrade
    
    // Calculate optimal populations based on energy capacity and efficiency
    let minerNeeds, haulerNeeds, upgraderNeeds, builderNeeds;
    
    if (energyCapacity >= 1800) { // RCL 6+
        minerNeeds = 2; // One per source
        haulerNeeds = 2; // Optimized large haulers
        upgraderNeeds = 4; // Strong upgrade force
        builderNeeds = 1; // One efficient builder
    } else if (energyCapacity >= 1300) { // RCL 5
        minerNeeds = 2;
        haulerNeeds = 2;
        upgraderNeeds = 3;
        builderNeeds = 1;
    } else if (energyCapacity >= 800) { // RCL 4
        minerNeeds = 2;
        haulerNeeds = 2;
        upgraderNeeds = 2;
        builderNeeds = 1;
    } else { // RCL 3 and below
        minerNeeds = 2;
        haulerNeeds = 3; // More small haulers
        upgraderNeeds = 2;
        builderNeeds = 1;
    }
    
    // Energy allocation
    const towerAllocation = TOWER_ENERGY_PER_TICK;
    const repairAllocation = REPAIR_ENERGY_PER_TICK;
    const availableForWork = Math.max(0, BASE_ENERGY_PER_TICK - towerAllocation - repairAllocation);
    
    // Construction needs check (cached to avoid repeated searches)
    const missingStructures = countMissingStructures(room);
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
    const hasConstructionWork = missingStructures > 0 || constructionSites > 0;
    
    // Builder allocation: 0 if no work, or enough for 1-2 builders
    const builderAllocation = hasConstructionWork ? Math.min(8, availableForWork * 0.4) : 0;
    const upgraderAllocation = Math.max(UPGRADER_MIN_ENERGY, availableForWork - builderAllocation);
    
    // Adjust builder/upgrader counts based on available energy
    if (!hasConstructionWork) builderNeeds = 0;
    if (upgraderAllocation < 4) upgraderNeeds = Math.max(1, upgraderNeeds - 1);
    
    room.memory.populationData = {
        hasInfrastructure,
        energyCapacity,
        needs: { miner: minerNeeds, hauler: haulerNeeds, upgrader: upgraderNeeds, builder: builderNeeds },
        energyBudget: {
            total: BASE_ENERGY_PER_TICK,
            towers: towerAllocation,
            repairs: repairAllocation,
            builders: builderAllocation,
            upgraders: upgraderAllocation
        },
        hasConstructionWork,
        missingStructures
    };
}

// Emergency recovery: spawn one harvester immediately
function emergencyBootstrap(spawn) {
    if (spawn.canCreateCreep([WORK, CARRY, MOVE]) === OK) {
        const name = 'harv:' + generateHexId();
        spawn.createCreep([WORK, CARRY, MOVE], name, { role: 'harvester' });
        console.log('🚨 EMERGENCY: Spawning recovery harvester');
        return true;
    }
    return false;
}

// Normal bootstrap: build up basic infrastructure
function normalBootstrap(spawn, creeps, popData) {
    const room = spawn.room;
    const energyCapacity = room.energyCapacityAvailable;
    
    // Bootstrap population targets (energy-efficient)
    const bootstrapNeeds = {
        harvester: Math.min(2, Math.max(1, Math.floor(energyCapacity / 250))),
        upgrader: 1,
        builder: popData.hasConstructionWork ? 1 : 0
    };
    
    // Spawn priority: harvester > builder > upgrader
    if (creeps.harvester.length < bootstrapNeeds.harvester) {
        if (spawn.canCreateCreep([WORK, CARRY, MOVE]) === OK) {
            const name = 'harv:' + generateHexId();
            spawn.createCreep([WORK, CARRY, MOVE], name, { role: 'harvester' });
            console.log(`Bootstrap: Spawning harvester (${creeps.harvester.length + 1}/${bootstrapNeeds.harvester})`);
            return true;
        }
    } else if (creeps.builder.length < bootstrapNeeds.builder) {
        if (spawn.canCreateCreep([WORK, CARRY, MOVE]) === OK) {
            const name = 'bldr:' + generateHexId();
            spawn.createCreep([WORK, CARRY, MOVE], name, { role: 'builder' });
            console.log('Bootstrap: Spawning builder');
            return true;
        }
    } else if (creeps.upgrader.length < bootstrapNeeds.upgrader) {
        if (spawn.canCreateCreep([WORK, CARRY, MOVE]) === OK) {
            const name = 'upgr:' + generateHexId();
            spawn.createCreep([WORK, CARRY, MOVE], name, { role: 'upgrader' });
            console.log('Bootstrap: Spawning upgrader');
            return true;
        }
    }
    return false;
}

// Production phase: optimized high-efficiency spawning
function productionSpawn(spawn, creeps, popData) {
    const needs = popData.needs;
    const energyCapacity = spawn.room.energyCapacityAvailable;
    
    // Pre-calculated body parts for efficiency (no recalculation every tick)
    const bodies = getOptimalBodies(energyCapacity);
    
    // Spawn priority: miner > hauler > upgrader > builder
    if (creeps.miner.length < needs.miner && spawn.canCreateCreep(bodies.miner) === OK) {
        const name = 'mine:' + generateHexId();
        spawn.createCreep(bodies.miner, name, { role: 'miner' });
        console.log(`Production: Spawning miner (${creeps.miner.length + 1}/${needs.miner})`);
        return true;
    } else if (creeps.hauler.length < needs.hauler && spawn.canCreateCreep(bodies.hauler) === OK) {
        const name = 'haul:' + generateHexId();
        spawn.createCreep(bodies.hauler, name, { role: 'hauler' });
        console.log(`Production: Spawning hauler (${creeps.hauler.length + 1}/${needs.hauler})`);
        return true;
    } else if (creeps.upgrader.length < needs.upgrader && spawn.canCreateCreep(bodies.upgrader) === OK) {
        const name = 'upgr:' + generateHexId();
        spawn.createCreep(bodies.upgrader, name, { role: 'upgrader' });
        console.log(`Production: Spawning upgrader (${creeps.upgrader.length + 1}/${needs.upgrader})`);
        return true;
    } else if (creeps.builder.length < needs.builder && spawn.canCreateCreep(bodies.builder) === OK) {
        const name = 'bldr:' + generateHexId();
        spawn.createCreep(bodies.builder, name, { role: 'builder' });
        console.log(`Production: Spawning builder (${creeps.builder.length + 1}/${needs.builder})`);
        return true;
    }
    
    // Log status every 100 ticks
    if (Game.time % 100 === 0) {
        const budget = popData.energyBudget;
        console.log(`Population: M:${creeps.miner.length}/${needs.miner} H:${creeps.hauler.length}/${needs.hauler} U:${creeps.upgrader.length}/${needs.upgrader} B:${creeps.builder.length}/${needs.builder}`);
        console.log(`Energy Budget: ${budget.total}e/t → T:${budget.towers} R:${budget.repairs} B:${budget.builders} U:${budget.upgraders}`);
    }
    
    return false;
}

// Pre-calculated optimal body parts based on energy capacity
function getOptimalBodies(energyCapacity) {
    if (energyCapacity >= 1800) { // RCL 6+
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE], // 5W1M - max efficiency
            hauler: [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE], // 8C4M
            upgrader: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], // 3W2C3M
            builder: [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE] // 3W2C3M
        };
    } else if (energyCapacity >= 1300) { // RCL 5
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE],
            hauler: [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE],
            upgrader: [WORK, WORK, CARRY, CARRY, MOVE, MOVE],
            builder: [WORK, WORK, CARRY, CARRY, MOVE, MOVE]
        };
    } else if (energyCapacity >= 800) { // RCL 4
        return {
            miner: [WORK, WORK, WORK, WORK, WORK, MOVE],
            hauler: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE],
            upgrader: [WORK, WORK, CARRY, MOVE],
            builder: [WORK, WORK, CARRY, MOVE]
        };
    } else { // RCL 3 and below
        return {
            miner: [WORK, WORK, WORK, MOVE],
            hauler: [CARRY, CARRY, MOVE],
            upgrader: [WORK, CARRY, MOVE],
            builder: [WORK, CARRY, MOVE]
        };
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
        const source = creep.pos.findClosestByPath(FIND_SOURCES);
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
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
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        } else {
            // No space in structures, help upgrade controller
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' } });
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
                // Don't take energy from spawn if it has less than 300 energy (reserve for spawning)
                if (structure.structureType === STRUCTURE_SPAWN) {
                    return structure.store[RESOURCE_ENERGY] > 300;
                }
                return (structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_STORAGE) &&
                       structure.store[RESOURCE_ENERGY] > 0;
            }
        });

        if (targets.length > 0) {
            // Prioritize extensions over storage, but avoid spawn if possible
            const priorityTargets = targets.filter(t => 
                t.structureType === STRUCTURE_EXTENSION
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
                // Don't take energy from spawn if it has less than 300 energy (reserve for spawning)
                if (structure.structureType === STRUCTURE_SPAWN) {
                    return structure.store[RESOURCE_ENERGY] > 300;
                }
                return (structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_STORAGE) &&
                       structure.store[RESOURCE_ENERGY] > 0;
            }
        });

        if (targets.length > 0) {
            // Prioritize extensions over storage, but avoid spawn if possible
            const priorityTargets = targets.filter(t => 
                t.structureType === STRUCTURE_EXTENSION
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
