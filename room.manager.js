// Room management module
// Handles creep spawning, energy management, and room operations

const memoryManager = require('memory.manager');

const roomManager = {
    
    run: function(room) {
        // Initialize room memory
        memoryManager.initializeRoom(room);
        memoryManager.updateRoomStats(room);
        
        // Spawn creeps based on room needs
        this.manageCreepSpawning(room);
        
        // Manage energy distribution
        this.manageEnergyDistribution(room);
        
        // Handle emergency situations
        this.handleEmergencies(room);
    },
    
    manageCreepSpawning: function(room) {
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;
        
        const spawn = spawns[0]; // Use first available spawn
        if (spawn.spawning) return;
        
        const creeps = room.find(FIND_MY_CREEPS);
        const harvesters = creeps.filter(creep => creep.memory.role === 'harvester');
        const upgraders = creeps.filter(creep => creep.memory.role === 'upgrader');
        const builders = creeps.filter(creep => creep.memory.role === 'builder');
        const repairers = creeps.filter(creep => creep.memory.role === 'repairer');
        const defenders = creeps.filter(creep => creep.memory.role === 'defender');
        const scouts = creeps.filter(creep => creep.memory.role === 'scout');
        
        const sources = room.find(FIND_SOURCES);
        const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        const roomLevel = room.controller.level;
        const energyCapacity = room.energyCapacityAvailable;
        
        console.log(`Room ${room.name} - H:${harvesters.length} U:${upgraders.length} B:${builders.length} R:${repairers.length} D:${defenders.length} S:${scouts.length}`);
        
        // Priority 1: Emergency harvesters (at least 2 per source)
        if (harvesters.length < sources.length * 2) {
            const body = this.getOptimalBody('harvester', energyCapacity);
            const newName = 'Harvester' + Game.time;
            console.log('Spawning harvester:', newName);
            spawn.spawnCreep(body, newName, {memory: {role: 'harvester', working: false}});
            return;
        }
        
        // Priority 2: Defenders if under attack
        if (hostiles.length > 0 && defenders.length < Math.min(hostiles.length * 2, 4)) {
            const body = this.getOptimalBody('defender', energyCapacity);
            const newName = 'Defender' + Game.time;
            console.log('Spawning defender:', newName);
            spawn.spawnCreep(body, newName, {memory: {role: 'defender', working: false}});
            return;
        }
        
        // Priority 3: Builders for construction
        if (constructionSites.length > 0 && builders.length < Math.min(constructionSites.length, 3)) {
            const body = this.getOptimalBody('builder', energyCapacity);
            const newName = 'Builder' + Game.time;
            console.log('Spawning builder:', newName);
            spawn.spawnCreep(body, newName, {memory: {role: 'builder', working: false}});
            return;
        }
        
        // Priority 4: Upgraders (scale with room level, more for higher levels)
        const targetUpgraders = Math.min(roomLevel + 2, 6);
        if (upgraders.length < targetUpgraders) {
            const body = this.getOptimalBody('upgrader', energyCapacity);
            const newName = 'Upgrader' + Game.time;
            console.log('Spawning upgrader:', newName);
            spawn.spawnCreep(body, newName, {memory: {role: 'upgrader', working: false}});
            return;
        }
        
        // Priority 5: Repairers
        if (repairers.length < 2) {
            const body = this.getOptimalBody('repairer', energyCapacity);
            const newName = 'Repairer' + Game.time;
            console.log('Spawning repairer:', newName);
            spawn.spawnCreep(body, newName, {memory: {role: 'repairer', working: false}});
            return;
        }
        
        // Priority 6: Scouts for expansion (after RCL 3)
        if (roomLevel >= 3 && scouts.length < 1) {
            const body = this.getOptimalBody('scout', energyCapacity);
            const newName = 'Scout' + Game.time;
            console.log('Spawning scout:', newName);
            spawn.spawnCreep(body, newName, {memory: {role: 'scout', working: false}});
            return;
        }
    },
    
    getOptimalBody: function(role, energyCapacity) {
        // Calculate optimal body based on available energy and role
        const maxEnergy = Math.min(energyCapacity, 1500); // Cap at 1500 for efficiency
        
        switch (role) {
            case 'harvester':
                return this.buildBody([WORK, CARRY, MOVE], maxEnergy, {work: 5, carry: 1, move: 3});
            case 'upgrader':
                return this.buildBody([WORK, CARRY, MOVE], maxEnergy, {work: 3, carry: 1, move: 2});
            case 'builder':
                return this.buildBody([WORK, CARRY, MOVE], maxEnergy, {work: 2, carry: 2, move: 2});
            case 'repairer':
                return this.buildBody([WORK, CARRY, MOVE], maxEnergy, {work: 2, carry: 1, move: 2});
            case 'defender':
                return this.buildBody([ATTACK, TOUGH, MOVE], maxEnergy, {attack: 1, tough: 1, move: 2});
            case 'scout':
                return [MOVE, MOVE, CARRY]; // Fast and cheap
            default:
                return [WORK, CARRY, MOVE];
        }
    },
    
    buildBody: function(baseBody, maxEnergy, ratios) {
        const body = [];
        let cost = 0;
        
        // Add base body parts
        for (let part of baseBody) {
            body.push(part);
            cost += BODYPART_COST[part];
        }
        
        // Add additional parts based on ratios
        let remainingEnergy = maxEnergy - cost;
        while (remainingEnergy > 0) {
            let added = false;
            
            for (let partType in ratios) {
                const partConstant = partType.toUpperCase();
                const partCost = BODYPART_COST[partConstant];
                const currentCount = body.filter(part => part === partConstant).length;
                const targetRatio = ratios[partType];
                
                if (remainingEnergy >= partCost && currentCount < targetRatio * 10) {
                    body.push(partConstant);
                    remainingEnergy -= partCost;
                    added = true;
                    break;
                }
            }
            
            if (!added) break;
        }
        
        return body;
    },
    
    manageEnergyDistribution: function(room) {
        // Ensure spawns and extensions are filled first
        const energyStructures = room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_SPAWN) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        
        // Priority energy distribution logged for debugging
        if (energyStructures.length > 0) {
            console.log(`Room ${room.name} needs energy in ${energyStructures.length} structures`);
        }
    },
    
    handleEmergencies: function(room) {
        const creeps = room.find(FIND_MY_CREEPS);
        const harvesters = creeps.filter(creep => creep.memory.role === 'harvester');
        
        // Emergency: No harvesters and low energy
        if (harvesters.length === 0 && room.energyAvailable < 200) {
            console.log('EMERGENCY: No harvesters in room', room.name);
            // Emergency spawn with minimal energy
            const spawns = room.find(FIND_MY_SPAWNS);
            if (spawns.length > 0 && !spawns[0].spawning && room.energyAvailable >= 200) {
                spawns[0].spawnCreep([WORK, CARRY, MOVE], 'EmergencyHarvester' + Game.time, 
                    {memory: {role: 'harvester', working: false}});
            }
        }
    }
};

module.exports = roomManager;