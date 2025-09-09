# Mini Screeps Bot - Fast Growing Room Controller Bot

A sophisticated Screeps bot designed to rapidly grow room controllers to level 8 through automated base building, efficient energy harvesting, remote mining operations, and intelligent defense systems.

## Features

### 🏗️ Automated Base Building
- **Smart Base Planning**: Automatically designs optimal base layouts based on room controller level
- **Progressive Construction**: Builds structures in priority order for maximum efficiency
- **Resource Optimization**: Places structures for optimal energy flow and minimal travel time

### ⚡ Energy Management
- **Multi-Role Creep System**: Specialized creeps for harvesting, upgrading, building, and repair
- **Efficient Logistics**: Optimized energy collection and distribution pathways
- **Dynamic Scaling**: Adjusts creep production based on room needs and available energy

### 🌍 Room Expansion
- **Intelligent Scouting**: Explores adjacent rooms to identify expansion opportunities
- **Remote Mining**: Establishes energy harvesting operations in nearby rooms
- **Resource Assessment**: Evaluates rooms based on sources, threats, and strategic value

### 🛡️ Defense Systems
- **Automated Defense**: Towers automatically engage hostiles and heal damaged units
- **Mobile Defense**: Defender creeps patrol and respond to threats
- **Threat Detection**: Early warning system for hostile activities

### 🎯 Optimization for Speed
- **Room Controller Focus**: Prioritizes rapid room controller upgrading
- **Efficient Body Parts**: Optimizes creep designs for available energy
- **Smart Memory Management**: Minimal memory usage with regular cleanup

## Architecture

### Core Modules

1. **main.js** - Main game loop and coordination
2. **room.manager.js** - Room operations and creep spawning
3. **memory.manager.js** - Memory optimization and cleanup
4. **base.planner.js** - Automated base design and construction
5. **expansion.manager.js** - Room expansion and remote operations

### Creep Roles

1. **Harvester** (`role.harvester.js`) - Energy collection and delivery
2. **Upgrader** (`role.upgrader.js`) - Room controller upgrading
3. **Builder** (`role.builder.js`) - Structure construction
4. **Repairer** (`role.repairer.js`) - Structure maintenance
5. **Defender** (`role.defender.js`) - Base defense and security
6. **Remote Harvester** (`role.remoteharvester.js`) - Remote energy collection
7. **Scout** (`role.scout.js`) - Room exploration and intelligence

## Strategy

### Early Game (RCL 1-3)
- Focus on basic infrastructure (spawn, extensions, containers)
- Establish efficient harvesting operations
- Build defensive capabilities

### Mid Game (RCL 4-6)
- Expand energy capacity with more extensions
- Implement remote mining operations
- Advanced structures (storage, towers, links)

### Late Game (RCL 7-8)
- Maximum energy throughput
- Multiple spawns for rapid creep production
- Advanced structures (labs, nuker, observer)
- Room expansion for multi-room empire

## Usage

1. **Upload to Screeps**: Copy all files to your Screeps codebase
2. **Initialize**: The bot will automatically start building and managing your room
3. **Monitor**: Watch the console for status updates and strategic decisions
4. **Scale**: Bot automatically expands to adjacent rooms when ready

## Configuration

The bot is designed to work out-of-the-box with minimal configuration. Key behaviors can be adjusted through constants in the respective modules:

- **Creep limits**: Adjust spawning ratios in `room.manager.js`
- **Base layout**: Modify structure placement in `base.planner.js`
- **Expansion strategy**: Configure expansion criteria in `expansion.manager.js`

## Performance

This bot is optimized for:
- **Fast RCL Growth**: Efficient energy management maximizes controller upgrading
- **Low CPU Usage**: Smart pathfinding and memory management
- **Scalability**: Handles multiple rooms and complex operations
- **Resilience**: Automatic recovery from attacks and resource depletion

## Requirements

- Screeps game account
- Basic understanding of Screeps mechanics
- Access to upload code to Screeps servers

The bot will handle all aspects of room management automatically, from initial spawn placement through reaching room controller level 8 and beyond.