// Builder role - Constructs buildings and structures
// Focuses on building the base infrastructure

const roleBuilder = {

    run: function(creep) {
        // Toggle working state based on energy
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('🔄 harvest');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('🚧 build');
        }

        if (creep.memory.working) {
            // Build structures
            this.buildStructures(creep);
        } else {
            // Collect energy
            this.collectEnergy(creep);
        }
    },

    buildStructures: function(creep) {
        // Find construction sites, prioritize by type
        const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
        
        if (constructionSites.length > 0) {
            // Priority order for construction
            const priorities = [
                STRUCTURE_SPAWN,
                STRUCTURE_EXTENSION,
                STRUCTURE_TOWER,
                STRUCTURE_STORAGE,
                STRUCTURE_CONTAINER,
                STRUCTURE_ROAD,
                STRUCTURE_WALL,
                STRUCTURE_RAMPART
            ];
            
            let target = null;
            for (let priority of priorities) {
                target = constructionSites.find(site => site.structureType === priority);
                if (target) break;
            }
            
            // If no priority target, build closest
            if (!target) {
                target = creep.pos.findClosestByPath(constructionSites);
            }
            
            if (target) {
                if (creep.build(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {
                        visualizePathStyle: {stroke: '#00ff00'},
                        reusePath: 10
                    });
                }
            }
        } else {
            // No construction sites, help with upgrading
            if (creep.room.controller) {
                if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, {
                        visualizePathStyle: {stroke: '#0099ff'},
                        reusePath: 15
                    });
                }
            }
        }
    },

    collectEnergy: function(creep) {
        // Priority 1: Containers and storage
        let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_CONTAINER ||
                        structure.structureType === STRUCTURE_STORAGE) &&
                        structure.store[RESOURCE_ENERGY] > 0;
            }
        });

        // Priority 2: Dropped energy
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                filter: resource => resource.resourceType === RESOURCE_ENERGY
            });
        }

        // Priority 3: Sources (as last resort)
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_SOURCES);
        }

        if (target) {
            let result;
            if (target instanceof Resource) {
                result = creep.pickup(target);
            } else if (target instanceof Source) {
                result = creep.harvest(target);
            } else {
                result = creep.withdraw(target, RESOURCE_ENERGY);
            }

            if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    visualizePathStyle: {stroke: '#ffaa00'},
                    reusePath: 10
                });
            }
        }
    }
};

module.exports = roleBuilder;