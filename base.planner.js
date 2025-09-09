// Base Planner - Automatically designs and builds optimal base layouts
// Focuses on efficiency for fast room controller growth

const basePlanner = {
    
    run: function(room) {
        if (!room.controller || !room.controller.my) return;
        
        const roomMemory = Memory.rooms[room.name];
        if (!roomMemory) return;
        
        // Plan base layout based on room controller level
        this.planBaseLayout(room);
        
        // Build structures in priority order
        this.buildStructures(room);
    },
    
    planBaseLayout: function(room) {
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) return;
        
        const roomLevel = room.controller.level;
        const spawnPos = spawn.pos;
        
        console.log(`Planning base layout for room ${room.name}, RCL ${roomLevel}`);
        
        // Plan roads first for efficient movement
        this.planRoads(room, spawnPos);
        
        // Plan structures by room level
        switch (roomLevel) {
            case 1:
                // Nothing additional needed at RCL 1
                break;
            case 2:
                this.planExtensions(room, spawnPos, 5);
                this.planContainers(room);
                break;
            case 3:
                this.planExtensions(room, spawnPos, 10);
                this.planTowers(room, spawnPos, 1);
                break;
            case 4:
                this.planExtensions(room, spawnPos, 20);
                this.planStorage(room, spawnPos);
                break;
            case 5:
                this.planExtensions(room, spawnPos, 30);
                this.planTowers(room, spawnPos, 2);
                this.planLinks(room, spawnPos);
                break;
            case 6:
                this.planExtensions(room, spawnPos, 40);
                this.planLabs(room, spawnPos);
                break;
            case 7:
                this.planExtensions(room, spawnPos, 50);
                this.planTowers(room, spawnPos, 3);
                this.planSpawns(room, spawnPos, 2);
                break;
            case 8:
                this.planExtensions(room, spawnPos, 60);
                this.planTowers(room, spawnPos, 6);
                this.planSpawns(room, spawnPos, 3);
                this.planNuker(room, spawnPos);
                this.planObserver(room, spawnPos);
                break;
        }
    },
    
    planRoads: function(room, spawnPos) {
        // Build roads to sources
        const sources = room.find(FIND_SOURCES);
        for (let source of sources) {
            const path = spawnPos.findPathTo(source);
            for (let step of path) {
                this.planStructure(room, step.x, step.y, STRUCTURE_ROAD);
            }
        }
        
        // Build road to controller
        if (room.controller) {
            const path = spawnPos.findPathTo(room.controller);
            for (let step of path) {
                this.planStructure(room, step.x, step.y, STRUCTURE_ROAD);
            }
        }
    },
    
    planExtensions: function(room, spawnPos, maxExtensions) {
        const existingExtensions = room.find(FIND_STRUCTURES, {
            filter: { structureType: STRUCTURE_EXTENSION }
        }).length;
        
        const plannedExtensions = room.find(FIND_CONSTRUCTION_SITES, {
            filter: { structureType: STRUCTURE_EXTENSION }
        }).length;
        
        const totalExtensions = existingExtensions + plannedExtensions;
        
        if (totalExtensions >= maxExtensions) return;
        
        // Place extensions in a compact grid around spawn
        const positions = this.getExtensionPositions(spawnPos, maxExtensions);
        let placed = 0;
        
        for (let pos of positions) {
            if (totalExtensions + placed >= maxExtensions) break;
            
            if (this.planStructure(room, pos.x, pos.y, STRUCTURE_EXTENSION)) {
                placed++;
            }
        }
    },
    
    getExtensionPositions: function(spawnPos, count) {
        const positions = [];
        
        // Create a spiral pattern around spawn
        for (let radius = 2; radius <= 5 && positions.length < count; radius++) {
            for (let dx = -radius; dx <= radius && positions.length < count; dx++) {
                for (let dy = -radius; dy <= radius && positions.length < count; dy++) {
                    if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                        const x = spawnPos.x + dx;
                        const y = spawnPos.y + dy;
                        if (x >= 0 && x < 50 && y >= 0 && y < 50) {
                            positions.push({x: x, y: y});
                        }
                    }
                }
            }
        }
        
        return positions;
    },
    
    planTowers: function(room, spawnPos, maxTowers) {
        const existingTowers = room.find(FIND_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        }).length;
        
        if (existingTowers >= maxTowers) return;
        
        // Place towers at strategic defensive positions
        const positions = [
            {x: spawnPos.x - 3, y: spawnPos.y - 3},
            {x: spawnPos.x + 3, y: spawnPos.y - 3},
            {x: spawnPos.x - 3, y: spawnPos.y + 3},
            {x: spawnPos.x + 3, y: spawnPos.y + 3},
            {x: spawnPos.x, y: spawnPos.y - 4},
            {x: spawnPos.x, y: spawnPos.y + 4}
        ];
        
        let placed = existingTowers;
        for (let pos of positions) {
            if (placed >= maxTowers) break;
            if (this.planStructure(room, pos.x, pos.y, STRUCTURE_TOWER)) {
                placed++;
            }
        }
    },
    
    planStorage: function(room, spawnPos) {
        const existingStorage = room.find(FIND_STRUCTURES, {
            filter: { structureType: STRUCTURE_STORAGE }
        }).length;
        
        if (existingStorage > 0) return;
        
        // Place storage near spawn
        this.planStructure(room, spawnPos.x + 2, spawnPos.y + 2, STRUCTURE_STORAGE);
    },
    
    planContainers: function(room) {
        const sources = room.find(FIND_SOURCES);
        
        for (let source of sources) {
            const existingContainers = source.pos.findInRange(FIND_STRUCTURES, 2, {
                filter: { structureType: STRUCTURE_CONTAINER }
            }).length;
            
            if (existingContainers === 0) {
                // Find best position for container near source
                const positions = source.pos.findInRange(FIND_EMPTY_TERRAIN, 1);
                if (positions.length > 0) {
                    const pos = positions[0];
                    this.planStructure(room, pos.x, pos.y, STRUCTURE_CONTAINER);
                }
            }
        }
    },
    
    planLinks: function(room, spawnPos) {
        // Plan links for efficient energy transport (RCL 5+)
        const existingLinks = room.find(FIND_STRUCTURES, {
            filter: { structureType: STRUCTURE_LINK }
        }).length;
        
        if (existingLinks < 2) {
            // Link near controller
            const controllerPos = room.controller.pos;
            this.planStructure(room, controllerPos.x + 1, controllerPos.y + 1, STRUCTURE_LINK);
            
            // Link near spawn
            this.planStructure(room, spawnPos.x + 1, spawnPos.y, STRUCTURE_LINK);
        }
    },
    
    planLabs: function(room, spawnPos) {
        // Plan labs for mineral processing (RCL 6+)
        const existingLabs = room.find(FIND_STRUCTURES, {
            filter: { structureType: STRUCTURE_LAB }
        }).length;
        
        if (existingLabs < 3) {
            // Place labs in a cluster
            const positions = [
                {x: spawnPos.x - 4, y: spawnPos.y},
                {x: spawnPos.x - 5, y: spawnPos.y},
                {x: spawnPos.x - 4, y: spawnPos.y + 1}
            ];
            
            for (let pos of positions) {
                this.planStructure(room, pos.x, pos.y, STRUCTURE_LAB);
            }
        }
    },
    
    planSpawns: function(room, spawnPos, maxSpawns) {
        const existingSpawns = room.find(FIND_STRUCTURES, {
            filter: { structureType: STRUCTURE_SPAWN }
        }).length;
        
        if (existingSpawns >= maxSpawns) return;
        
        // Additional spawns for higher RCL
        const positions = [
            {x: spawnPos.x + 4, y: spawnPos.y},
            {x: spawnPos.x, y: spawnPos.y + 4}
        ];
        
        let placed = existingSpawns;
        for (let pos of positions) {
            if (placed >= maxSpawns) break;
            if (this.planStructure(room, pos.x, pos.y, STRUCTURE_SPAWN)) {
                placed++;
            }
        }
    },
    
    planNuker: function(room, spawnPos) {
        const existingNuker = room.find(FIND_STRUCTURES, {
            filter: { structureType: STRUCTURE_NUKER }
        }).length;
        
        if (existingNuker === 0) {
            this.planStructure(room, spawnPos.x - 6, spawnPos.y, STRUCTURE_NUKER);
        }
    },
    
    planObserver: function(room, spawnPos) {
        const existingObserver = room.find(FIND_STRUCTURES, {
            filter: { structureType: STRUCTURE_OBSERVER }
        }).length;
        
        if (existingObserver === 0) {
            this.planStructure(room, spawnPos.x + 6, spawnPos.y, STRUCTURE_OBSERVER);
        }
    },
    
    planStructure: function(room, x, y, structureType) {
        // Check if position is valid and available
        if (x < 0 || x > 49 || y < 0 || y > 49) return false;
        
        const pos = new RoomPosition(x, y, room.name);
        
        // Check for existing structures or construction sites
        const existingStructures = pos.look();
        for (let item of existingStructures) {
            if (item.type === 'structure' || item.type === 'constructionSite') {
                return false;
            }
            if (item.type === 'terrain' && item.terrain === 'wall') {
                return false;
            }
        }
        
        // Create construction site
        const result = room.createConstructionSite(x, y, structureType);
        if (result === OK) {
            console.log(`Planned ${structureType} at ${x},${y} in room ${room.name}`);
            return true;
        }
        
        return false;
    },
    
    buildStructures: function(room) {
        // Building is handled by builder creeps, just ensure we have construction sites
        const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        console.log(`Room ${room.name} has ${constructionSites.length} construction sites`);
    }
};

module.exports = basePlanner;