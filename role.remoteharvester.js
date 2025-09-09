// Remote Harvester role - Harvests energy from adjacent rooms
// Brings energy back to main base for rapid expansion

const roleRemoteHarvester = {

    run: function(creep) {
        // Initialize memory for remote harvesting
        if (!creep.memory.targetRoom) {
            this.assignTargetRoom(creep);
        }
        
        // Toggle working state based on energy and location
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.working = false;
            creep.say('🚀 remote');
        }
        if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = true;
            creep.say('📦 return');
        }

        if (creep.memory.working) {
            // Return energy to home room
            this.returnToHomeRoom(creep);
        } else {
            // Go to target room and harvest
            this.harvestInRemoteRoom(creep);
        }
    },

    assignTargetRoom: function(creep) {
        // Get target room from expansion manager or find adjacent room
        const homeRoom = creep.room;
        const exits = Game.map.describeExits(homeRoom.name);
        
        // Choose the first available adjacent room
        for (let direction in exits) {
            const roomName = exits[direction];
            creep.memory.targetRoom = roomName;
            creep.memory.homeRoom = homeRoom.name;
            console.log(`Remote harvester ${creep.name} assigned to room ${roomName}`);
            break;
        }
    },

    harvestInRemoteRoom: function(creep) {
        const targetRoomName = creep.memory.targetRoom;
        
        // If not in target room, move to it
        if (creep.room.name !== targetRoomName) {
            const exitDir = Game.map.findExit(creep.room, targetRoomName);
            const exit = creep.pos.findClosestByPath(exitDir);
            if (exit) {
                creep.moveTo(exit, {
                    visualizePathStyle: {stroke: '#00ffff'},
                    reusePath: 50
                });
            }
            return;
        }
        
        // In target room, find and harvest from sources
        const sources = creep.room.find(FIND_SOURCES);
        if (sources.length > 0) {
            let target = null;
            
            // Use assigned source if available
            if (creep.memory.sourceId) {
                target = Game.getObjectById(creep.memory.sourceId);
            }
            
            // Find closest source if no assignment
            if (!target) {
                target = creep.pos.findClosestByPath(sources);
                if (target) {
                    creep.memory.sourceId = target.id;
                }
            }
            
            if (target) {
                if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {
                        visualizePathStyle: {stroke: '#00ffff'},
                        reusePath: 10
                    });
                }
            }
        } else {
            console.log(`No sources found in remote room ${targetRoomName}`);
        }
    },

    returnToHomeRoom: function(creep) {
        const homeRoomName = creep.memory.homeRoom;
        
        // If not in home room, move to it
        if (creep.room.name !== homeRoomName) {
            const exitDir = Game.map.findExit(creep.room, homeRoomName);
            const exit = creep.pos.findClosestByPath(exitDir);
            if (exit) {
                creep.moveTo(exit, {
                    visualizePathStyle: {stroke: '#ffffff'},
                    reusePath: 50
                });
            }
            return;
        }
        
        // In home room, deliver energy
        this.deliverEnergy(creep);
    },

    deliverEnergy: function(creep) {
        // Priority 1: Storage or containers
        let target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType === STRUCTURE_STORAGE ||
                        structure.structureType === STRUCTURE_CONTAINER) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });

        // Priority 2: Spawns and extensions if storage not available
        if (!target) {
            target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType === STRUCTURE_EXTENSION ||
                            structure.structureType === STRUCTURE_SPAWN) &&
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
            // No storage available, drop energy near spawn
            const spawns = creep.room.find(FIND_MY_SPAWNS);
            if (spawns.length > 0) {
                if (!creep.pos.inRangeTo(spawns[0], 2)) {
                    creep.moveTo(spawns[0]);
                } else {
                    creep.drop(RESOURCE_ENERGY);
                }
            }
        }
    }
};

module.exports = roleRemoteHarvester;