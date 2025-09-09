// Scout role - Explores adjacent rooms and gathers intelligence
// Identifies expansion opportunities and threats

const roleScout = {

    run: function(creep) {
        // Initialize scouting memory
        if (!creep.memory.targetRoom) {
            this.assignScoutingTarget(creep);
        }
        
        // Scout the assigned room
        this.scoutRoom(creep);
    },

    assignScoutingTarget: function(creep) {
        const homeRoom = creep.room;
        const exits = Game.map.describeExits(homeRoom.name);
        
        if (!Memory.scouting) {
            Memory.scouting = {
                scoutedRooms: {},
                lastScoutTime: Game.time
            };
        }
        
        // Find unscoured adjacent rooms
        let targetRoom = null;
        for (let direction in exits) {
            const roomName = exits[direction];
            if (!Memory.scouting.scoutedRooms[roomName] || 
                Game.time - Memory.scouting.scoutedRooms[roomName].lastScouted > 1000) {
                targetRoom = roomName;
                break;
            }
        }
        
        if (targetRoom) {
            creep.memory.targetRoom = targetRoom;
            creep.memory.homeRoom = homeRoom.name;
            creep.memory.scoutingPhase = 'traveling';
            console.log(`Scout ${creep.name} assigned to explore ${targetRoom}`);
        } else {
            // All adjacent rooms scouted, help with other tasks
            creep.memory.targetRoom = homeRoom.name;
            creep.memory.scoutingPhase = 'helping';
        }
    },

    scoutRoom: function(creep) {
        const targetRoomName = creep.memory.targetRoom;
        const homeRoomName = creep.memory.homeRoom;
        
        switch (creep.memory.scoutingPhase) {
            case 'traveling':
                this.travelToRoom(creep, targetRoomName);
                break;
            case 'scouting':
                this.gatherIntelligence(creep);
                break;
            case 'returning':
                this.travelToRoom(creep, homeRoomName);
                break;
            case 'helping':
                this.helpWithBaseTasks(creep);
                break;
        }
    },

    travelToRoom: function(creep, targetRoomName) {
        if (creep.room.name === targetRoomName) {
            if (creep.memory.scoutingPhase === 'traveling') {
                creep.memory.scoutingPhase = 'scouting';
                creep.memory.scoutStartTime = Game.time;
            } else if (creep.memory.scoutingPhase === 'returning') {
                // Finished scouting, assign new target
                creep.memory.targetRoom = null;
                creep.memory.scoutingPhase = null;
            }
            return;
        }
        
        const exitDir = Game.map.findExit(creep.room, targetRoomName);
        const exit = creep.pos.findClosestByPath(exitDir);
        if (exit) {
            creep.moveTo(exit, {
                visualizePathStyle: {stroke: '#9966ff'},
                reusePath: 50
            });
        }
    },

    gatherIntelligence: function(creep) {
        const room = creep.room;
        const roomName = room.name;
        
        if (!Memory.scouting.scoutedRooms[roomName]) {
            Memory.scouting.scoutedRooms[roomName] = {};
        }
        
        const roomData = Memory.scouting.scoutedRooms[roomName];
        
        // Gather basic room information
        roomData.lastScouted = Game.time;
        roomData.sources = room.find(FIND_SOURCES).map(source => ({
            id: source.id,
            pos: source.pos,
            energyCapacity: source.energyCapacity
        }));
        
        roomData.minerals = room.find(FIND_MINERALS).map(mineral => ({
            id: mineral.id,
            pos: mineral.pos,
            mineralType: mineral.mineralType
        }));
        
        // Check for controller
        if (room.controller) {
            roomData.controller = {
                pos: room.controller.pos,
                level: room.controller.level,
                owner: room.controller.owner ? room.controller.owner.username : null,
                reservation: room.controller.reservation ? {
                    username: room.controller.reservation.username,
                    ticksToEnd: room.controller.reservation.ticksToEnd
                } : null
            };
        }
        
        // Check for hostile structures and creeps
        roomData.hostileStructures = room.find(FIND_HOSTILE_STRUCTURES).length;
        roomData.hostileCreeps = room.find(FIND_HOSTILE_CREEPS).length;
        
        // Calculate expansion potential
        roomData.expansionPotential = this.calculateExpansionPotential(room, roomData);
        
        console.log(`Scout completed intelligence gathering for ${roomName}:`,
            `Sources: ${roomData.sources.length}`,
            `Controller: ${roomData.controller ? 'Yes' : 'No'}`,
            `Hostiles: ${roomData.hostileCreeps + roomData.hostileStructures}`,
            `Potential: ${roomData.expansionPotential}`);
        
        // Scout for a while, then return
        if (Game.time - creep.memory.scoutStartTime > 50) {
            creep.memory.scoutingPhase = 'returning';
        } else {
            // Move around the room to explore
            if (!creep.memory.exploreTarget || creep.pos.isEqualTo(creep.memory.exploreTarget)) {
                creep.memory.exploreTarget = new RoomPosition(
                    Math.floor(Math.random() * 50),
                    Math.floor(Math.random() * 50),
                    roomName
                );
            }
            creep.moveTo(creep.memory.exploreTarget.x, creep.memory.exploreTarget.y);
        }
    },

    calculateExpansionPotential: function(room, roomData) {
        let potential = 0;
        
        // Points for sources
        potential += roomData.sources.length * 10;
        
        // Points for controller availability
        if (roomData.controller && !roomData.controller.owner) {
            potential += 20;
        }
        
        // Penalty for hostiles
        potential -= (roomData.hostileStructures + roomData.hostileCreeps) * 5;
        
        // Bonus for minerals
        potential += roomData.minerals.length * 5;
        
        return Math.max(0, potential);
    },

    helpWithBaseTasks: function(creep) {
        // When not scouting, help with base tasks
        if (creep.store.getFreeCapacity() > 0) {
            // Pick up dropped energy
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
            // Deliver energy
            const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType === STRUCTURE_EXTENSION ||
                            structure.structureType === STRUCTURE_SPAWN) &&
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
        
        // Default: Stay near spawn and reassign if needed
        const spawns = creep.room.find(FIND_MY_SPAWNS);
        if (spawns.length > 0) {
            if (!creep.pos.inRangeTo(spawns[0], 5)) {
                creep.moveTo(spawns[0]);
            } else if (Game.time % 100 === 0) {
                // Reassign scouting target periodically
                creep.memory.targetRoom = null;
                creep.memory.scoutingPhase = null;
            }
        }
    }
};

module.exports = roleScout;