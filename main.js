// Mini Screeps Bot - Fast Growing Room Controller Bot
// Main entry point for the Screeps bot

const roleHarvester = require('role.harvester');
const roleUpgrader = require('role.upgrader');
const roleBuilder = require('role.builder');
const roleRepairer = require('role.repairer');
const roleDefender = require('role.defender');
const roleRemoteHarvester = require('role.remoteharvester');
const roleScout = require('role.scout');
const basePlanner = require('base.planner');
const roomManager = require('room.manager');
const memoryManager = require('memory.manager');
const expansionManager = require('expansion.manager');

module.exports.loop = function () {
    console.log('=== Tick ' + Game.time + ' ===');
    
    // Clean up memory every 1000 ticks
    if (Game.time % 1000 === 0) {
        memoryManager.cleanup();
    }
    
    // Manage all owned rooms
    for (let roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        
        if (room.controller && room.controller.my) {
            console.log('Managing room:', roomName, 'RCL:', room.controller.level);
            
            // Manage room operations
            roomManager.run(room);
            
            // Plan and build base structures
            basePlanner.run(room);
            
            // Handle expansion to nearby rooms
            expansionManager.run(room);
        }
    }
    
    // Manage all creeps
    for (let name in Game.creeps) {
        const creep = Game.creeps[name];
        
        if (creep.spawning) continue;
        
        switch (creep.memory.role) {
            case 'harvester':
                roleHarvester.run(creep);
                break;
            case 'upgrader':
                roleUpgrader.run(creep);
                break;
            case 'builder':
                roleBuilder.run(creep);
                break;
            case 'repairer':
                roleRepairer.run(creep);
                break;
            case 'defender':
                roleDefender.run(creep);
                break;
            case 'remoteharvester':
                roleRemoteHarvester.run(creep);
                break;
            case 'scout':
                roleScout.run(creep);
                break;
            default:
                console.log('Unknown role for creep:', name, creep.memory.role);
        }
    }
    
    // Handle tower operations
    for (let roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (room.controller && room.controller.my) {
            const towers = room.find(FIND_MY_STRUCTURES, {
                filter: { structureType: STRUCTURE_TOWER }
            });
            
            for (let tower of towers) {
                // Defend against hostiles
                const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
                if (closestHostile) {
                    tower.attack(closestHostile);
                    continue;
                }
                
                // Heal damaged creeps
                const closestDamagedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
                    filter: (creep) => creep.hits < creep.hitsMax
                });
                if (closestDamagedCreep) {
                    tower.heal(closestDamagedCreep);
                    continue;
                }
                
                // Repair damaged structures
                const closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (structure) => structure.hits < structure.hitsMax && structure.structureType !== STRUCTURE_WALL
                });
                if (closestDamagedStructure && tower.store[RESOURCE_ENERGY] > 500) {
                    tower.repair(closestDamagedStructure);
                }
            }
        }
    }
};