// Defender role - Protects the base from hostile creeps
// Engages enemies and patrols base perimeter

const roleDefender = {

    run: function(creep) {
        // Find hostile creeps in the room
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
        
        if (hostiles.length > 0) {
            this.defendAgainstHostiles(creep, hostiles);
        } else {
            // No hostiles, patrol or help with other tasks
            this.patrol(creep);
        }
    },

    defendAgainstHostiles: function(creep, hostiles) {
        // Find the closest or most dangerous hostile
        let target = null;
        
        // Priority 1: Hostiles attacking our structures
        const attackingHostiles = hostiles.filter(hostile => {
            const nearbyStructures = hostile.pos.findInRange(FIND_MY_STRUCTURES, 1);
            return nearbyStructures.length > 0;
        });
        
        if (attackingHostiles.length > 0) {
            target = creep.pos.findClosestByRange(attackingHostiles);
        } else {
            // Priority 2: Closest hostile
            target = creep.pos.findClosestByRange(hostiles);
        }
        
        if (target) {
            creep.say('🗡️ DEFEND!');
            
            // Attack the target
            if (creep.attack(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    visualizePathStyle: {stroke: '#ff0000'},
                    reusePath: 3
                });
            }
        }
    },

    patrol: function(creep) {
        // Check for hostiles in adjacent rooms if we're at room level 3+
        if (creep.room.controller && creep.room.controller.level >= 3) {
            this.checkAdjacentRooms(creep);
        } else {
            // Patrol around the room or help with other tasks
            this.helpWithOtherTasks(creep);
        }
    },

    checkAdjacentRooms: function(creep) {
        // Get exits and check adjacent rooms for threats
        const exits = Game.map.describeExits(creep.room.name);
        
        if (!creep.memory.patrolTarget) {
            // Choose a random exit to patrol
            const exitDirections = Object.keys(exits);
            if (exitDirections.length > 0) {
                const randomDirection = exitDirections[Math.floor(Math.random() * exitDirections.length)];
                creep.memory.patrolTarget = randomDirection;
            }
        }
        
        if (creep.memory.patrolTarget) {
            const exitDirection = parseInt(creep.memory.patrolTarget);
            const exit = creep.pos.findClosestByPath(exitDirection);
            
            if (exit) {
                creep.moveTo(exit, {
                    visualizePathStyle: {stroke: '#ff6600'},
                    reusePath: 20
                });
                
                // Reset patrol target occasionally
                if (Game.time % 100 === 0) {
                    creep.memory.patrolTarget = null;
                }
            }
        }
    },

    helpWithOtherTasks: function(creep) {
        // When not defending, help with base tasks
        if (creep.store.getFreeCapacity() > 0) {
            // Collect energy if we can carry it
            const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                filter: resource => resource.resourceType === RESOURCE_ENERGY
            });
            
            if (droppedEnergy) {
                if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(droppedEnergy);
                }
                return;
            }
        }
        
        if (creep.store[RESOURCE_ENERGY] > 0) {
            // Deliver energy to structures that need it
            const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType === STRUCTURE_EXTENSION ||
                            structure.structureType === STRUCTURE_SPAWN ||
                            structure.structureType === STRUCTURE_TOWER) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            
            if (target) {
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target);
                }
                return;
            }
        }
        
        // Default: Move to a defensive position near spawn
        const spawns = creep.room.find(FIND_MY_SPAWNS);
        if (spawns.length > 0) {
            const spawn = spawns[0];
            if (!creep.pos.inRangeTo(spawn, 3)) {
                creep.moveTo(spawn, {
                    visualizePathStyle: {stroke: '#0066ff'},
                    reusePath: 50
                });
            }
        }
    }
};

module.exports = roleDefender;