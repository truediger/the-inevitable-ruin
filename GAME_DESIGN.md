# The Inevitable Ruin

## Game Design Document

---

## Overview

**Genre:** Top-down arena action RPG / Endless tower crawler
**Platform:** HTML5 Browser (Canvas-based)
**Perspective:** Top-down
**Core Loop:** Fight waves of monsters -> Level up -> Specialize your class -> Climb the tower

An endless tower of monsters. Each floor has multiple waves of enemies followed by a boss. As you climb, you level up, gain new skills, specialize your class, and face increasingly dangerous foes. There is no rest. There is no shop. There is only **The Inevitable Ruin**.

---

## Controls

| Input | Action |
|-------|--------|
| WASD / Arrow Keys | Move (all 4 directions, arena-style) |
| 1, 2, 3, 4 | Use skills (mapped to skill slots) |
| Auto | Character auto-attacks the nearest enemy in range |

---

## Core Systems

### Combat
- **Real-time** arena combat (top-down)
- **Auto-attack** fires at nearest enemy within range
  - Melee: Swings in a 108-degree arc, hitting all enemies in the cone, with knockback
  - Ranged: Fires a projectile at nearest target
- **Skills** are activated with number keys, have cooldowns
- **Dodge by movement** - no dodge button, positioning is survival
- Melee classes have **8% base lifesteal** on all hits
- Melee classes have **0.5s invulnerability frames** after taking damage
- All melee hits apply **knockback** to enemies

### Progression
- **XP** earned from killing monsters
- **Level up** grants 3 attribute points to distribute
- **New skills** offered at levels 3, 6, 9 (pick 1 of 2)
- **Skill upgrades** offered at levels 12, 18, 24, 30 (pick a skill, then pick path A or B)
- **Class specialization** at Floor 5 (Tier 2) and Floor 15 (Tier 3)
- XP formula: `80 * 1.15^(level - 1)`

### Tower Structure
- Each floor has multiple waves + a boss wave
  - Floors 1-3: 3 waves
  - Floors 4-8: 4 waves
  - Floors 9-15: 5 waves
  - Floor 16+: Up to 7 waves
- Wave mob count: `4 + floor + wave bonus` (max 24 per wave)
- Boss wave: 1 boss + scaling number of adds
- Monster stats scale +12% per floor (HP and damage, not speed)
- Clearing all waves + boss advances to the next floor

### Save System
- Up to **10 save slots** stored in localStorage
- **Auto-save** every 30 seconds and on floor clear
- Save stores: class, level, XP, attributes, skills, floor, wave
- Multiple characters can be played simultaneously

---

## Attributes

| Attribute | Effect | Best For |
|-----------|--------|----------|
| **Strength (STR)** | +2.0 attack damage (melee) / +0.3 (ranged) | Melee classes |
| **Agility (AGI)** | +5 move speed, +0.8% attack speed, +0.5% crit chance per point | Everyone (secondary) |
| **Vitality (VIT)** | +12 max HP per point | Survivability |
| **Mind (MND)** | +2.0 attack damage (ranged) / +0.3 (melee) | Ranged/Magic classes |

---

## Class System

### Tier 1 - Starting Classes (Floor 1)

| Class | Type | Base Stats | Speed | Description |
|-------|------|-----------|-------|-------------|
| **Brawler** | Melee | STR 7, AGI 5, VIT 8, MND 2 | 280 | Fast fists, iron will. Wide melee swings with lifesteal. |
| **Ranger** | Ranged | STR 3, AGI 7, VIT 4, MND 6 | 210 | Precision from distance. Kiting and positioning. |

### Tier 2 - First Specialization (Floor 5)

**Brawler evolves into:**

| Class | Stats | Speed | Passive | Description |
|-------|-------|-------|---------|-------------|
| **Berserker** | STR 10, AGI 6, VIT 7, MND 2 | 290 | **Fury:** +1% damage per 1% missing HP | Glass cannon melee. More damage the closer to death. |
| **Guardian** | STR 6, AGI 4, VIT 14, MND 3 | 250 | **Fortify:** Take 15% less damage | Immovable wall. Absorb and punish. |

**Ranger evolves into:**

| Class | Stats | Speed | Passive | Description |
|-------|-------|-------|---------|-------------|
| **Sharpshooter** | STR 4, AGI 10, VIT 3, MND 6 | 220 | **Precision:** +20% crit chance | Every shot counts. Critical hit specialist. |
| **Mage** | STR 2, AGI 5, VIT 4, MND 12 | 200 | **Arcane Power:** Skills deal +15% damage | Elemental AoE destruction. |

### Tier 3 - Deep Specialization (Floor 15)

**Berserker evolves into:**

| Class | Passive | Description |
|-------|---------|-------------|
| **Warlord** | **Frenzy:** Each kill grants +5% attack speed for 5s (stacks) | Cleave hordes, frenzy stacks fuel devastation |
| **Reaper** | **Execute:** Enemies below 20% HP take double damage. Kills heal 10% max HP | Death incarnate, execute the wounded |

**Guardian evolves into:**

| Class | Passive | Description |
|-------|---------|-------------|
| **Paladin** | **Divine Shield:** Blocking heals 5% max HP. +25% damage to bosses | Holy warrior, block to heal |
| **Juggernaut** | **Thorns:** Reflect 30% melee damage. Immune to knockback | Unstoppable force, punish attackers |

**Sharpshooter evolves into:**

| Class | Passive | Description |
|-------|---------|-------------|
| **Deadeye** | **Ricochet:** Auto-attacks bounce to 1 nearby enemy for 50% damage | One shot, one kill, bullets bounce |
| **Artillery** | **Blast Radius:** All projectiles explode on impact (small AoE) | Area denial, everything explodes |

**Mage evolves into:**

| Class | Passive | Description |
|-------|---------|-------------|
| **Warlock** | **Siphon:** 10% of all damage dealt returned as HP | Dark sorcery, drain life from enemies |
| **Necromancer** | **Raise Dead:** 30% chance slain enemies rise as minions for 20s. Bosses become Zombie Bosses at 40% power | Master of death, army of the fallen |

---

## Skills

### Melee Skills

| Skill | Level | CD | Damage | Effect | Upgrade A | Upgrade B |
|-------|-------|----|--------|--------|-----------|-----------|
| **Cleave** | 3 | 3s | 1.5x | Wide arc swing hitting all enemies in front, knockback | **Great Cleave** - Wider arc, +50% dmg | **Whirlwind** - Full 360 spin |
| **Charge** | 3 | 5s | 2.0x | Dash forward, damage + stun enemies in path | **Stampede** - Longer range, +50% dmg | **Shield Bash** - Shorter, stun 2.5x longer |
| **Slam** | 6 | 6s | 2.5x | AoE ground smash, knockback all nearby | **Earthquake** - Bigger radius, leaves fire zone (4s, ticks 30% dmg/0.5s) | **Shockwave** - Massive knockback |
| **War Cry** | 6 | 12s | - | +50% attack speed buff for 5s | **Battle Fury** - Also +30% damage | **Rallying Cry** - 8s duration + move speed |
| **Shield Block** | 9 | 8s | - | Block all damage for 1.5s | **Reflect Shield** - Reflects projectiles | **Bulwark** - Lasts 3s |

### Ranged Skills

| Skill | Level | CD | Damage | Effect | Upgrade A | Upgrade B |
|-------|-------|----|--------|--------|-----------|-----------|
| **Multishot** | 3 | 4s | 0.8x | Fire 5 projectiles in a spread | **Arrow Storm** - 8 projectiles, wider | **Focused Volley** - Tight spread, +80% dmg |
| **Piercing Shot** | 3 | 3s | 2.5x | Passes through all enemies | **Railgun** - +100% dmg, faster | **Chain Lightning** - Splits into 3 on hit |
| **Frost Bolt** | 6 | 4s | 1.5x | Slows enemy 50% for 3s, freezes visually | **Blizzard** - AoE slow on impact | **Deep Freeze** - 2s stun instead |
| **Fireball** | 6 | 5s | 3.0x | Explosive AoE (60 radius), screen shake | **Meteor** - Huge radius/dmg, longer CD | **Rapid Fire** - 0.5x dmg but 1.5s CD |
| **Trap** | 9 | 8s | 2.0x | Place visible trap, stuns 2s on trigger | **Mine Field** - Place 3 traps | **Bear Trap** - 4s root, double damage |

### Necromancer Special

| Skill | Level | CD | Effect | Upgrade A | Upgrade B |
|-------|-------|----|--------|-----------|-----------|
| **Raise Dead** | 6 | 15s | Raise all nearby corpses as minions for 25s. No minion limit. | **Army of the Dead** - 40s duration, +50% minion dmg | **Zombie Explosion** - Minions explode on death (3x AoE dmg) |

**Necromancer Minion Rules:**
- No cap on number of minions
- Minions expire after timer (timer pauses during menus)
- Regular enemies raised at 60% HP, 50% damage
- Bosses raised as **Zombie Bosses** at 40% HP and power
- Passive Raise Dead: 30% chance on any kill, 20s duration
- Active Raise Dead skill: raises all corpses in radius

---

## Monsters

### Regular Enemies

| Monster | Type | Base HP | Base Dmg | Speed | XP |
|---------|------|---------|----------|-------|-----|
| Slime | Melee | 30 | 5 | 180 | 15 |
| Goblin | Melee | 45 | 8 | 270 | 20 |
| Skeleton | Melee | 55 | 10 | 225 | 25 |
| Orc | Melee | 90 | 15 | 210 | 35 |
| Troll | Melee | 150 | 20 | 150 | 50 |
| Demon | Melee | 200 | 25 | 255 | 65 |
| Imp | Ranged | 20 | 6 | 165 | 18 |
| Archer | Ranged | 35 | 12 | 195 | 28 |
| Dark Mage | Ranged | 50 | 18 | 135 | 40 |
| Fire Elemental | Ranged | 80 | 22 | 165 | 55 |

### Bosses

| Boss | Type | Base HP | Base Dmg | Speed | XP | Floors |
|------|------|---------|----------|-------|----|--------|
| Slime King | Melee | 200 | 12 | 120 | 100 | 1-3 |
| Skeleton Lord | Melee | 400 | 18 | 165 | 200 | 4-6 |
| Dragon | Ranged | 800 | 30 | 150 | 400 | 7-10 |
| Lich | Ranged | 600 | 35 | 120 | 350 | 11-15 |
| Demon Lord | Melee | 1200 | 40 | 195 | 600 | 16+ |

### Monster AI
- **Melee monsters:** Charge directly at the player, attack when in range
- **Ranged monsters:** Maintain preferred distance (~70% of attack range), strafe, shoot projectiles
- **Bosses:** Same AI as their type but with hexagonal body, extra HP scaling on repeat encounters
- All monster HP/damage scales +12% per floor (speed does not scale)

### Floor Monster Pools

| Floors | Monster Pool | Boss |
|--------|-------------|------|
| 1-3 | Slime, Imp | Slime King |
| 4-6 | Slime, Goblin, Imp, Archer | Skeleton Lord |
| 7-10 | Goblin, Skeleton, Archer, Dark Mage | Dragon |
| 11-15 | Skeleton, Orc, Dark Mage, Fire Elemental | Lich |
| 16+ | Orc, Troll, Demon, Fire Elemental, Dark Mage | Demon Lord |

---

## Visual Effects

| Element | Visual |
|---------|--------|
| Melee auto-attack | Colored arc slash (108 degrees) in facing direction |
| Cleave | Large colored arc slash (144+ degrees), lingers longer |
| Charge | Glowing trail line from start to end + impact circle |
| Slam | Expanding shockwave ring |
| Earthquake (Slam A) | Pulsing fire zone on ground with flickering flame particles, 4s duration |
| War Cry | Initial expanding rings + persistent fire aura with orbiting flame wisps |
| Shield Block | Pulsing blue shield bubble for duration |
| Fireball | Large glowing projectile with trail + explosion ring with bright core + screen shake |
| Frost Bolt | Blue projectile + ice burst on hit, frozen enemies turn blue with orbiting ice crystals |
| Piercing Shot | Large fast projectile with fading trail |
| Multishot | Muzzle flash + fan of glowing projectiles with trails |
| Trap | Pulsing spiky shape on ground with red center, explodes when triggered |
| All projectiles | Fading trails, large projectiles have white inner core glow |
| Damage numbers | Float up and fade out, crits shown in yellow |
| Monster death | Burst of colored particles, bosses get extra gold particle explosion |
| Player hit | Red particles + brief flash white + damage number |

---

## Technical Details

### Architecture
```
the-inevitable-ruin/
├── index.html           # Entry point
├── css/style.css        # Dark theme UI
└── js/
    ├── classes.js       # Class + skill definitions (data)
    ├── input.js         # Keyboard + mouse input handler
    ├── particles.js     # Particle effects + damage numbers
    ├── save.js          # localStorage save/load system
    ├── projectiles.js   # Projectile, trap, and explosion system
    ├── monsters.js      # Monster definitions, AI, rendering
    ├── player.js        # Player entity, skills, minions, ground effects
    ├── tower.js         # Floor/wave management
    ├── ui.js            # HUD, menus, skill selection screens
    └── main.js          # Game loop, state machine, rendering
```

### Game States
- `menu` - Main menu with save slots
- `playing` - Active gameplay
- `paused` - Floor cleared, level-up screen, skill selection, specialization
- `dead` - Game over screen

### Rendering
- HTML5 Canvas 2D
- Full-screen responsive (fills browser window)
- Simple geometric shapes (diamonds, triangles, circles, hexagons)
- Glow effects via canvas shadowBlur
- Screen shake on explosions

### Performance
- requestAnimationFrame game loop
- Delta time capped at 50ms to prevent physics explosions
- Particle system with auto-cleanup
- Max 24 monsters per wave

---

## Future Roadmap

- **Gear / Loot system** - Drops from bosses, equippable items with stat bonuses
- **Rest stops / Shop** - Between floors, spend gold on consumables or gear
- **Environmental hazards** - Traps, lava, moving obstacles on certain floors
- **More classes** - Additional Tier 1 starter options beyond Melee/Ranged
- **Sprite art** - Replace geometric shapes with pixel art sprites
- **Sound effects and music**
- **Leaderboards** - Track highest floor reached per class
- **Challenge modifiers** - Speed run mode, hardcore (1 life), boss rush
- **Mobile touch controls**
- **Multiplayer / Co-op** (far future)
