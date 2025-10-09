# Mini-Screeps v1.3 - CPU Management for Pixel Generation

## Overview
This bot is designed for **PIXEL GENERATION** while maintaining aggressive expansion. The CPU management philosophy is fundamentally different from typical Screeps bots because:

1. **We intentionally drain the bucket to 0** by calling `Game.cpu.generatePixel()` (costs 10,000 bucket)
2. **Bucket level is completely irrelevant** - it will frequently be at 0
3. **ONLY bucket recovery RATE matters** - we must stay in positive recovery

## Core Philosophy

### What We Care About: Recovery Rate (bucket/tick)
```
Recovery Rate = (current bucket - previous bucket) / ticks elapsed
```

**This is the ONLY metric that matters!**

### What We Don't Care About: Absolute Bucket Level
```
Game.cpu.bucket  // Can be 0, 5000, 10000 - doesn't matter!
```

**Bucket level is ignored completely** because we're generating pixels.

## CPU Recovery Rate Thresholds

| Recovery Rate | Status | Action | Example |
|---------------|--------|--------|---------|
| **≥ 150/tick** | ✅ OPTIMAL | Full operations | 10,000 bucket in 67 ticks from 0 |
| **50-149/tick** | ⚠️ Below target | Continue but warn | 10,000 bucket in 200 ticks from 0 |
| **1-49/tick** | ⚠️ TOO SLOW | Pause new military | 10,000 bucket in 500+ ticks from 0 |
| **≤ 0/tick** | 🚨 CRITICAL | Emergency mode | Bucket never recovers! |

### Configuration Constants
```javascript
const TARGET_BUCKET_RECOVERY_RATE = 150;  // Optimal performance
const MIN_BUCKET_RECOVERY_RATE = 50;      // Minimum acceptable (slow but positive)
const CRITICAL_RECOVERY_RATE = 0;         // Emergency - negative recovery!
```

## How It Works

### Monitoring (Every 10 ticks)
```javascript
function monitorCPUPerformance() {
    const currentBucket = Game.cpu.bucket;
    const bucketChange = currentBucket - cpuStats.lastBucket;
    const recoveryRate = bucketChange / 10; // Per tick
    
    cpuStats.samples.push({ tick, bucket, recoveryRate });
    cpuStats.averageBucketRecovery = average(last 10 samples);
}
```

### Decision Making
```javascript
function getCPUEfficiency() {
    const recoveryRate = cpuStats.averageBucketRecovery;
    
    return {
        canAffordMilitary: recoveryRate >= 50,  // Only check recovery rate!
        isCritical: recoveryRate <= 0,          // Negative recovery
        isSlow: recoveryRate > 0 && recoveryRate < 50
    };
}
```

### Military Gating
```javascript
// OLD (WRONG): if (Game.cpu.bucket < 8000) return;
// NEW (RIGHT):
if (getCPUEfficiency().averageRecovery < 50) {
    console.log('Recovery too slow - pausing military');
    return;
}
```

## Example Scenarios

### Scenario 1: Optimal Performance (Your Current State)
```
Bucket: 0 (just generated pixel!)
Recovery: 245/tick
Status: ✅ OPTIMAL

Action: Full operations, generate pixels when bucket reaches 10,000
Time to refill: 10,000 / 245 = 41 ticks
```

### Scenario 2: Heavy Expansion
```
Bucket: 2500
Recovery: 125/tick
Status: ⚠️ Below target (but acceptable)

Action: Continue operations, warn user
Time to refill: 7,500 / 125 = 60 ticks
```

### Scenario 3: Too Aggressive
```
Bucket: 100
Recovery: 25/tick
Status: ⚠️ TOO SLOW - Military paused

Action: Stop new military operations, keep economy running
Time to refill: 9,900 / 25 = 396 ticks (too slow!)
```

### Scenario 4: Critical
```
Bucket: 50
Recovery: -10/tick (NEGATIVE!)
Status: 🚨 CRITICAL

Action: Emergency mode, reduce all non-essential operations
Problem: Bucket is draining, not recovering!
```

## Console Output Examples

### Normal Operation (Bucket at 0 after pixel generation)
```
✅ CPU: Recovery 245.3/tick (OPTIMAL) | Bucket: 0
⚔️ Military: 2 warriors, 1 healers, 2 raiders
🎯 Active Assaults: 1
💰 Pixel generated! (Bucket drained from 10000 to 0)
```

### Below Target But Acceptable
```
⚠️ CPU: Recovery 125.7/tick (Below target) | Bucket: 5432
⚠️ CPU: Recovery 125.7/tick (target: 150, acceptable, continuing)
⚔️ Military: 4 warriors, 2 healers, 3 raiders
```

### Too Slow - Military Paused
```
⚠️ CPU: Recovery 45.2/tick (TOO SLOW - Military paused) | Bucket: 1234
⚠️ CPU SLOW: Recovery 45.2/tick (min: 50, too slow - scaling back)
⚠️ CPU: Recovery too slow (45.2/tick) - pausing new military operations
```

### Critical - Negative Recovery
```
🚨 CPU: Recovery -15.3/tick (CRITICAL - Negative recovery!) | Bucket: 234
🚨 CPU CRITICAL: Recovery -15.3/tick (NEGATIVE! Emergency mode)
🚨 CRITICAL: Recovery at -15.3/tick (negative!) - emergency mode
```

## Why This Approach?

### Traditional Approach (WRONG for pixel generation)
```javascript
// Most Screeps bots do this:
if (Game.cpu.bucket < 8000) {
    // Stop military
}
```
**Problem**: Bucket is at 0 most of the time when generating pixels!

### Our Approach (RIGHT for pixel generation)
```javascript
// We do this instead:
const recoveryRate = (currentBucket - lastBucket) / ticksElapsed;
if (recoveryRate < 50) {
    // Only now consider stopping military
}
```
**Benefit**: Works perfectly even when bucket = 0!

## Key Benefits

1. **Pixel Generation Compatible**: Bucket can be 0 and bot still works
2. **Recovery-Focused**: Only cares about rate of bucket refill
3. **Aggressive**: Doesn't needlessly pause at high bucket levels
4. **Predictive**: Can calculate time to refill: `ticksToFull = remainingBucket / recoveryRate`
5. **Smart**: Only stops when recovery is actually problematic

## Adjusting Thresholds

### More Conservative (Higher Recovery Requirements)
```javascript
const TARGET_BUCKET_RECOVERY_RATE = 200;  // Higher target
const MIN_BUCKET_RECOVERY_RATE = 100;     // Stop military earlier
```

### More Aggressive (Lower Recovery Requirements)
```javascript
const TARGET_BUCKET_RECOVERY_RATE = 100;  // Lower target
const MIN_BUCKET_RECOVERY_RATE = 25;      // Allow slower recovery
```

### For Testing (See All States)
```javascript
const MIN_BUCKET_RECOVERY_RATE = 150;     // High threshold
// This will trigger "too slow" warnings when below 150
```

## Troubleshooting

### "Recovery too slow - pausing military"
**Cause**: Recovery rate dropped below 50/tick
**Solution**: 
- Reduce controlled rooms
- Decrease scout range
- Wait for bucket to refill
- Check if spawning too many creeps

### "CRITICAL - Negative recovery"
**Cause**: Spending more CPU than limit provides
**Solution**:
- Emergency: Disable military immediately
- Reduce all operations
- Check for infinite loops or excessive pathfinding
- May need to abandon rooms

### Bot won't start military at bucket 0
**Expected**: This is normal! Bucket at 0 after pixel generation
**Check**: Look at recovery rate, not bucket level
**Fix**: None needed if recovery > 50/tick

## Integration with Pixel Generation

```javascript
function manageCPUForPixels() {
    if (Game.cpu.bucket === 10000) {
        // Generate pixel (costs 10,000 bucket)
        Game.cpu.generatePixel();
        console.log('💰 Pixel generated! Bucket: 10000 → 0');
        // Bucket is now 0, but recovery rate is still 245/tick
        // Bot continues normally!
    }
}
```

After pixel generation:
- Bucket: 0
- Recovery: Still 245/tick (unchanged)
- Status: ✅ OPTIMAL
- Military: Continues operating
- Time to next pixel: ~41 ticks

## Summary

**OLD THINKING**: "Don't do expensive things when bucket is low"
**NEW THINKING**: "Only do expensive things if recovery rate is positive and acceptable"

**Key Insight**: Bucket level tells you nothing about sustainability. Recovery rate tells you everything.

With 245 bucket/tick recovery, you can:
- Generate a pixel every ~41 ticks
- Run full military operations
- Control 3+ rooms
- Stay in positive CPU balance

All while the bucket fluctuates between 0 and 10,000!

