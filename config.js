// Configuration settings for the Mini Screeps Bot
// Adjust these values to fine-tune bot behavior

const config = {
    
    // Creep spawning ratios and limits
    creeps: {
        harvesters: {
            perSource: 2,           // Harvesters per energy source
            maxTotal: 8             // Maximum total harvesters per room
        },
        upgraders: {
            baseCount: 2,           // Minimum upgraders
            perRoomLevel: 1,        // Additional upgraders per RCL
            maxTotal: 6             // Maximum upgraders per room
        },
        builders: {
            perConstructionSite: 1, // Builders per construction site
            maxTotal: 3             // Maximum builders per room
        },
        repairers: {
            baseCount: 1,           // Minimum repairers
            maxTotal: 2             // Maximum repairers per room
        },
        defenders: {
            perHostile: 2,          // Defenders per hostile creep
            maxTotal: 4             // Maximum defenders per room
        },
        scouts: {
            minRoomLevel: 3,        // Start scouting at this RCL
            maxTotal: 1             // Maximum scouts per room
        },
        remoteHarvesters: {
            perRemoteSource: 2,     // Remote harvesters per remote source
            maxPerRoom: 4           // Maximum remote harvesters per target room
        }
    },
    
    // Base building settings
    base: {
        extensionSpacing: 2,        // Minimum spacing between extensions
        roadPriority: true,         // Build roads first for efficiency
        defensiveStructures: true, // Prioritize towers and ramparts
        compactLayout: true         // Use compact base layouts
    },
    
    // Energy management
    energy: {
        reserveForUpgrading: 0.3,   // Fraction of energy reserved for upgrading
        emergencyThreshold: 200,    // Spawn emergency harvester below this energy
        towerReserve: 500,          // Keep this much energy in towers for repairs
        maxCreepEnergy: 1500        // Maximum energy to spend on a single creep
    },
    
    // Expansion settings
    expansion: {
        startRoomLevel: 3,          // Begin expansion at this RCL
        scoutingInterval: 1000,     // Re-scout rooms every N ticks
        maxRemoteRooms: 3,          // Maximum remote mining rooms per base
        expansionPotentialMin: 25,  // Minimum score for room expansion
        claimRoomLevel: 8           // Claim new rooms only at this RCL
    },
    
    // Defense settings
    defense: {
        towerAutoAttack: true,      // Towers automatically attack hostiles
        towerAutoHeal: true,        // Towers automatically heal damaged creeps
        towerAutoRepair: true,      // Towers repair structures when idle
        defenderPatrol: true,       // Defenders patrol when no threats
        rampartThreshold: 0.5       // Repair ramparts below this ratio
    },
    
    // Memory management
    memory: {
        cleanupInterval: 1000,      // Clean memory every N ticks
        keepRoomData: 5000,         // Keep room data for N ticks
        keepScoutData: 10000        // Keep scouting data for N ticks
    },
    
    // Performance settings
    performance: {
        pathReuseTicks: 10,         // Reuse paths for N ticks
        maxCpuPerTick: 0.9,         // Use max % of available CPU
        logLevel: 'info'            // Logging level: 'debug', 'info', 'warn', 'error'
    },
    
    // Room controller focus settings (for fast RCL growth)
    controller: {
        upgraderPriority: 'high',   // Priority for upgrader creeps
        linkUpgrading: true,        // Use links for upgrading when available
        upgradeBoosts: true,        // Use boosts for upgrading when available
        maxUpgradeEnergy: 15        // Maximum work parts for upgrading per tick
    }
};

module.exports = config;