// Harvester role - Collects energy from sources and delivers to spawns/extensions
// Optimized for fast energy collection and delivery

const roleHarvester = {

    run: function(creep) {
        // Toggle working state based on energy
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('🔄 harvest');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('⚡ deliver');
        }

        if (creep.memory.working) {
            // Deliver energy to structures
            this.deliverEnergy(creep);
        } else {
            // Harvest energy from sources
            this.harvestEnergy(creep);
        }
    },

    harvestEnergy: function(creep) {
        // Find the closest source or assigned source
        let source = null;
        
        if (creep.memory.sourceId) {
            source = Game.getObjectById(creep.memory.sourceId);
        }
        
        if (!source) {
            const sources = creep.room.find(FIND_SOURCES);
            source = creep.pos.findClosestByPath(sources);
            if (source) {
                creep.memory.sourceId = source.id;
            }
        }

        if (source) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, {
                    visualizePathStyle: {stroke: '#ffaa00'},
                    reusePath: 10
                });
            }
        } else {
            console.log('Harvester', creep.name, 'could not find a source');
        }
    },

    deliverEnergy: function(creep) {
        // Priority 1: Spawns and extensions
        let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_SPAWN) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });

        // Priority 2: Towers (if they're low on energy)
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return structure.structureType === STRUCTURE_TOWER &&
                           structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
        }

        // Priority 3: Storage or containers
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType === STRUCTURE_STORAGE ||
                            structure.structureType === STRUCTURE_CONTAINER) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
        }

        if (target) {
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    visualizePathStyle: {stroke: '#ffffff'},
                    reusePath: 5
                });
            }
        } else {
            // No targets available, idle near spawn
            const spawns = creep.room.find(FIND_MY_SPAWNS);
            if (spawns.length > 0) {
                creep.moveTo(spawns[0]);
            }
        }
    }
};

module.exports = roleHarvester;