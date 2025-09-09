// Memory management for the Screeps bot
// Handles cleanup and optimization of memory usage

const memoryManager = {
    
    cleanup: function() {
        console.log('Running memory cleanup...');
        
        // Clean up dead creeps from memory
        for (let name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
                console.log('Cleaned up dead creep from memory:', name);
            }
        }
        
        // Clean up dead rooms from memory
        for (let roomName in Memory.rooms) {
            if (!Game.rooms[roomName]) {
                delete Memory.rooms[roomName];
                console.log('Cleaned up unvisible room from memory:', roomName);
            }
        }
        
        // Initialize global memory if not exists
        if (!Memory.rooms) Memory.rooms = {};
        if (!Memory.expansion) Memory.expansion = {};
        if (!Memory.defense) Memory.defense = {};
        if (!Memory.stats) Memory.stats = {};
    },
    
    initializeRoom: function(room) {
        if (!Memory.rooms[room.name]) {
            Memory.rooms[room.name] = {
                baseBuilt: false,
                sources: [],
                constructionSites: 0,
                energyCapacity: 0,
                lastEnergyCheck: 0,
                defenseLevel: 0,
                expansionTargets: [],
                remoteMining: []
            };
        }
        
        // Update source positions
        const sources = room.find(FIND_SOURCES);
        Memory.rooms[room.name].sources = sources.map(source => ({
            id: source.id,
            pos: source.pos,
            harvesters: 0
        }));
        
        return Memory.rooms[room.name];
    },
    
    updateRoomStats: function(room) {
        const roomMemory = this.initializeRoom(room);
        roomMemory.energyCapacity = room.energyCapacityAvailable;
        roomMemory.constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
        roomMemory.lastEnergyCheck = Game.time;
        
        // Update defense status
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        roomMemory.defenseLevel = hostiles.length;
    }
};

module.exports = memoryManager;