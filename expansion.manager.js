// Expansion Manager - Handles room expansion and remote mining operations
// Coordinates scouts and remote harvesters for maximum energy income

const expansionManager = {
    
    run: function(room) {
        if (!room.controller || !room.controller.my) return;
        
        const roomLevel = room.controller.level;
        
        // Only start expansion operations at RCL 3+
        if (roomLevel < 3) return;
        
        // Initialize expansion memory
        this.initializeExpansionMemory();
        
        // Analyze scouting data and identify expansion targets
        this.analyzeExpansionTargets(room);
        
        // Manage remote mining operations
        this.manageRemoteMining(room);
        
        // Plan future expansion (actual room claiming at RCL 8)
        if (roomLevel >= 8) {
            this.planRoomExpansion(room);
        }
    },
    
    initializeExpansionMemory: function() {
        if (!Memory.expansion) {
            Memory.expansion = {
                targets: {},
                remoteMining: {},
                claimTargets: []
            };
        }
    },
    
    analyzeExpansionTargets: function(room) {
        if (!Memory.scouting || !Memory.scouting.scoutedRooms) return;
        
        const homeRoomName = room.name;
        const scoutedRooms = Memory.scouting.scoutedRooms;
        
        // Analyze each scouted room for expansion potential
        for (let roomName in scoutedRooms) {
            const roomData = scoutedRooms[roomName];
            
            // Skip if room data is too old
            if (Game.time - roomData.lastScouted > 5000) continue;
            
            // Calculate if room is suitable for remote mining
            const isGoodForRemoteMining = this.evaluateRemoteMining(roomData, homeRoomName);
            
            if (isGoodForRemoteMining) {
                if (!Memory.expansion.targets[roomName]) {
                    Memory.expansion.targets[roomName] = {
                        homeRoom: homeRoomName,
                        type: 'remoteMining',
                        sources: roomData.sources,
                        established: false,
                        lastCheck: Game.time
                    };
                    console.log(`Added remote mining target: ${roomName} from ${homeRoomName}`);
                }
            }
            
            // Evaluate for future room claiming
            const isGoodForClaiming = this.evaluateForClaiming(roomData);
            if (isGoodForClaiming && !Memory.expansion.claimTargets.includes(roomName)) {
                Memory.expansion.claimTargets.push(roomName);
                console.log(`Added claiming target: ${roomName}`);
            }
        }
    },
    
    evaluateRemoteMining: function(roomData, homeRoomName) {
        // Room must have sources
        if (!roomData.sources || roomData.sources.length === 0) return false;
        
        // Room should not be owned or reserved by others
        if (roomData.controller && roomData.controller.owner) return false;
        if (roomData.controller && roomData.controller.reservation && 
            roomData.controller.reservation.username !== 'azcoigreach') return false;
        
        // Should not have too many hostiles
        if (roomData.hostileCreeps > 2 || roomData.hostileStructures > 5) return false;
        
        // Check distance (should be adjacent)
        const distance = Game.map.getRoomLinearDistance(homeRoomName, roomData.lastScouted);
        if (distance > 2) return false;
        
        return true;
    },
    
    evaluateForClaiming: function(roomData) {
        // Room must have controller and not be owned
        if (!roomData.controller || roomData.controller.owner) return false;
        
        // Should have multiple sources
        if (!roomData.sources || roomData.sources.length < 2) return false;
        
        // Should have high expansion potential
        if (roomData.expansionPotential < 25) return false;
        
        // Should not have significant hostile presence
        if (roomData.hostileCreeps > 0 || roomData.hostileStructures > 0) return false;
        
        return true;
    },
    
    manageRemoteMining: function(room) {
        const homeRoomName = room.name;
        const remoteTargets = Object.keys(Memory.expansion.targets).filter(
            targetRoom => Memory.expansion.targets[targetRoom].homeRoom === homeRoomName &&
                         Memory.expansion.targets[targetRoom].type === 'remoteMining'
        );
        
        for (let targetRoom of remoteTargets) {
            this.manageRemoteMiningOperation(room, targetRoom);
        }
    },
    
    manageRemoteMiningOperation: function(room, targetRoomName) {
        const targetData = Memory.expansion.targets[targetRoomName];
        if (!targetData) return;
        
        // Count existing remote harvesters for this target
        const remoteHarvesters = Object.values(Game.creeps).filter(creep => 
            creep.memory.role === 'remoteharvester' && 
            creep.memory.targetRoom === targetRoomName
        );
        
        console.log(`Remote mining ${targetRoomName}: ${remoteHarvesters.length} harvesters active`);
        
        // Determine if we need more remote harvesters
        const sourcesCount = targetData.sources ? targetData.sources.length : 1;
        const targetHarvesters = Math.min(sourcesCount * 2, 4); // 2 per source, max 4
        
        if (remoteHarvesters.length < targetHarvesters) {
            // Request more remote harvesters through memory
            if (!Memory.expansion.remoteMining[targetRoomName]) {
                Memory.expansion.remoteMining[targetRoomName] = {
                    requestedHarvesters: targetHarvesters,
                    currentHarvesters: remoteHarvesters.length,
                    lastRequest: Game.time
                };
            } else {
                Memory.expansion.remoteMining[targetRoomName].requestedHarvesters = targetHarvesters;
                Memory.expansion.remoteMining[targetRoomName].currentHarvesters = remoteHarvesters.length;
            }
        }
        
        // Check if remote mining operation is successful
        if (remoteHarvesters.length > 0) {
            targetData.established = true;
            targetData.lastCheck = Game.time;
        }
        
        // Periodically reassess the target room
        if (Game.time - targetData.lastCheck > 1000) {
            this.reassessRemoteTarget(targetRoomName);
        }
    },
    
    reassessRemoteTarget: function(targetRoomName) {
        // Re-scout the room to update information
        const scoutedData = Memory.scouting.scoutedRooms[targetRoomName];
        if (!scoutedData) return;
        
        const targetData = Memory.expansion.targets[targetRoomName];
        
        // Check if room is still viable
        const stillViable = this.evaluateRemoteMining(scoutedData, targetData.homeRoom);
        
        if (!stillViable) {
            console.log(`Abandoning remote mining target: ${targetRoomName} (no longer viable)`);
            delete Memory.expansion.targets[targetRoomName];
            delete Memory.expansion.remoteMining[targetRoomName];
            
            // Reassign remote harvesters
            const remoteHarvesters = Object.values(Game.creeps).filter(creep => 
                creep.memory.role === 'remoteharvester' && 
                creep.memory.targetRoom === targetRoomName
            );
            
            for (let creep of remoteHarvesters) {
                creep.memory.targetRoom = null; // Will be reassigned
            }
        }
    },
    
    planRoomExpansion: function(room) {
        // Only actually claim rooms when we have excess energy and are at RCL 8
        if (room.controller.level < 8) return;
        if (room.energyAvailable < room.energyCapacityAvailable * 0.8) return;
        
        const claimTargets = Memory.expansion.claimTargets;
        if (claimTargets.length === 0) return;
        
        // Check if we already have enough rooms
        const ownedRooms = Object.keys(Game.rooms).filter(roomName => {
            const r = Game.rooms[roomName];
            return r.controller && r.controller.my;
        });
        
        if (ownedRooms.length >= 3) return; // Limit to 3 rooms for now
        
        // Find the best claim target
        const bestTarget = this.findBestClaimTarget(room, claimTargets);
        
        if (bestTarget) {
            console.log(`Planning to claim room: ${bestTarget}`);
            // TODO: Implement claimer creep spawning and room claiming logic
            // This would involve spawning claimer creeps and sending them to claim the room
        }
    },
    
    findBestClaimTarget: function(homeRoom, claimTargets) {
        let bestTarget = null;
        let bestScore = 0;
        
        for (let targetRoom of claimTargets) {
            const roomData = Memory.scouting.scoutedRooms[targetRoom];
            if (!roomData) continue;
            
            // Calculate distance penalty
            const distance = Game.map.getRoomLinearDistance(homeRoom.name, targetRoom);
            const distancePenalty = distance * 5;
            
            // Calculate score
            const score = roomData.expansionPotential - distancePenalty;
            
            if (score > bestScore) {
                bestScore = score;
                bestTarget = targetRoom;
            }
        }
        
        return bestTarget;
    },
    
    getExpansionStatus: function(roomName) {
        // Utility function to get expansion status for a room
        const targets = Memory.expansion ? Memory.expansion.targets : {};
        const remoteMining = Memory.expansion ? Memory.expansion.remoteMining : {};
        
        return {
            targets: Object.keys(targets).filter(t => targets[t].homeRoom === roomName),
            remoteMining: Object.keys(remoteMining),
            claimTargets: Memory.expansion ? Memory.expansion.claimTargets : []
        };
    }
};

module.exports = expansionManager;