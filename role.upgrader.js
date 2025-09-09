// Upgrader role - Focuses on upgrading the room controller
// Optimized for fast room controller leveling

const roleUpgrader = {

    run: function(creep) {
        // Toggle working state based on energy
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('🔄 harvest');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('⚡ upgrade');
        }

        if (creep.memory.working) {
            // Upgrade the controller
            this.upgradeController(creep);
        } else {
            // Collect energy
            this.collectEnergy(creep);
        }
    },

    upgradeController: function(creep) {
        if (creep.room.controller) {
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {
                    visualizePathStyle: {stroke: '#0099ff'},
                    reusePath: 15
                });
            }
        }
    },

    collectEnergy: function(creep) {
        // Priority 1: Containers near controller
        let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
                return structure.structureType === STRUCTURE_CONTAINER &&
                       structure.store[RESOURCE_ENERGY] > 0 &&
                       structure.pos.inRangeTo(creep.room.controller, 3);
            }
        });

        // Priority 2: Any containers with energy
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType === STRUCTURE_CONTAINER ||
                            structure.structureType === STRUCTURE_STORAGE) &&
                            structure.store[RESOURCE_ENERGY] > 0;
                }
            });
        }

        // Priority 3: Dropped energy
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                filter: resource => resource.resourceType === RESOURCE_ENERGY
            });
        }

        // Priority 4: Sources (as last resort)
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

module.exports = roleUpgrader;