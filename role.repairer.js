// Repairer role - Repairs damaged structures
// Maintains base infrastructure

const roleRepairer = {

    run: function(creep) {
        // Toggle working state based on energy
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('🔄 harvest');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('🔧 repair');
        }

        if (creep.memory.working) {
            // Repair structures
            this.repairStructures(creep);
        } else {
            // Collect energy
            this.collectEnergy(creep);
        }
    },

    repairStructures: function(creep) {
        // Find damaged structures, prioritize by importance and damage level
        const damagedStructures = creep.room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return structure.hits < structure.hitsMax && 
                       structure.structureType !== STRUCTURE_WALL;
            }
        });

        if (damagedStructures.length > 0) {
            // Priority repair order
            const priorities = [
                STRUCTURE_SPAWN,
                STRUCTURE_EXTENSION,
                STRUCTURE_TOWER,
                STRUCTURE_STORAGE,
                STRUCTURE_CONTAINER,
                STRUCTURE_ROAD,
                STRUCTURE_RAMPART
            ];
            
            let target = null;
            
            // Find highest priority damaged structure
            for (let priority of priorities) {
                target = damagedStructures.find(structure => 
                    structure.structureType === priority && 
                    structure.hits < structure.hitsMax * 0.8
                );
                if (target) break;
            }
            
            // If no priority target, repair most damaged
            if (!target) {
                target = damagedStructures.reduce((prev, current) => {
                    const prevRatio = prev.hits / prev.hitsMax;
                    const currentRatio = current.hits / current.hitsMax;
                    return prevRatio < currentRatio ? prev : current;
                });
            }
            
            if (target) {
                if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {
                        visualizePathStyle: {stroke: '#yellow'},
                        reusePath: 10
                    });
                }
            }
        } else {
            // No damaged structures, help with building
            const constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
            if (constructionSites.length > 0) {
                const target = creep.pos.findClosestByPath(constructionSites);
                if (target) {
                    if (creep.build(target) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, {
                            visualizePathStyle: {stroke: '#00ff00'},
                            reusePath: 10
                        });
                    }
                }
            } else {
                // Nothing to build, help upgrade controller
                if (creep.room.controller) {
                    if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(creep.room.controller, {
                            visualizePathStyle: {stroke: '#0099ff'},
                            reusePath: 15
                        });
                    }
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

module.exports = roleRepairer;