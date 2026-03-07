// ============================================================
// CLASS DEFINITIONS - The Inevitable Ruin (v2 - Level-Based Specs)
// ============================================================

const CLASS_DATA = {
    // ================================================================
    // TIER 1: STARTING CLASSES
    // ================================================================
    brawler: {
        name: 'Brawler',
        tier: 1,
        type: 'melee',
        description: 'A close-quarters fighter. Fast fists and iron will.',
        baseStats: { str: 7, agi: 5, vit: 8, mnd: 2 },
        attackRange: 55,
        attackSpeed: 0.35,
        attackDamage: 9,
        moveSpeed: 280,
        color: '#e85530',
        size: 16,
        specOptions: ['berserker', 'guardian', 'paladin'],
        specLevel: 6,
        startingSkills: ['punch'],
        autoAttack: 'punch',
    },
    mage: {
        name: 'Mage',
        tier: 1,
        type: 'ranged',
        description: 'A wielder of arcane forces. Destruction from afar.',
        baseStats: { str: 2, agi: 6, vit: 5, mnd: 9 },
        attackRange: 250,
        attackSpeed: 0.7,
        attackDamage: 10,
        moveSpeed: 200,
        color: '#9944ff',
        size: 14,
        specOptions: ['frost_mage', 'fire_mage', 'arcane_mage'],
        specLevel: 6,
        startingSkills: ['arcane_bolt'],
        autoAttack: 'arcane_bolt',
    },

    // ================================================================
    // TIER 2: BRAWLER SPECIALIZATIONS (Level 6)
    // ================================================================
    berserker: {
        name: 'Berserker',
        tier: 2,
        type: 'melee',
        description: 'Unbridled fury. More damage the lower your health.',
        baseStats: { str: 10, agi: 6, vit: 7, mnd: 2 },
        attackRange: 60,
        attackSpeed: 0.3,
        attackDamage: 14,
        moveSpeed: 290,
        color: '#ff3300',
        size: 18,
        specOptions: ['warlord', 'reaper'],
        specLevel: 15,
        startingSkills: [],
        autoAttack: 'punch',
        passive: 'Fury: +1% damage per 1% missing HP',
        freeSkill: 'war_cry',
    },
    guardian: {
        name: 'Guardian',
        tier: 2,
        type: 'melee',
        description: 'An immovable wall. Absorb hits and punish enemies.',
        baseStats: { str: 6, agi: 4, vit: 14, mnd: 3 },
        attackRange: 55,
        attackSpeed: 0.45,
        attackDamage: 10,
        moveSpeed: 250,
        color: '#4488cc',
        size: 20,
        specOptions: ['juggernaut', 'sentinel'],
        specLevel: 15,
        startingSkills: [],
        autoAttack: 'punch',
        passive: 'Fortify: Take 15% less damage',
        freeSkill: 'shield_block',
    },
    paladin: {
        name: 'Paladin',
        tier: 2,
        type: 'melee',
        description: 'Holy warrior. Smite the unworthy, protect the faithful.',
        baseStats: { str: 8, agi: 4, vit: 10, mnd: 6 },
        attackRange: 55,
        attackSpeed: 0.4,
        attackDamage: 11,
        moveSpeed: 260,
        color: '#ffdd44',
        size: 18,
        specOptions: ['crusader', 'templar'],
        specLevel: 15,
        startingSkills: [],
        autoAttack: 'smite',
        passive: 'Divine Light: +25% damage to bosses. Heal 2% max HP per kill',
        freeSkill: 'consecrate',
    },

    // ================================================================
    // TIER 2: MAGE SPECIALIZATIONS (Level 6)
    // ================================================================
    frost_mage: {
        name: 'Frost Mage',
        tier: 2,
        type: 'ranged',
        description: 'Master of ice. Freeze your enemies and shatter them.',
        baseStats: { str: 2, agi: 7, vit: 5, mnd: 11 },
        attackRange: 250,
        attackSpeed: 0.7,
        attackDamage: 12,
        moveSpeed: 200,
        color: '#44ccff',
        size: 14,
        specOptions: ['cryomancer', 'ice_warden'],
        specLevel: 15,
        startingSkills: [],
        autoAttack: 'frost_bolt_auto',
        passive: 'Chill: Auto-attacks slow enemies 30% for 2s',
        freeSkill: 'blizzard',
    },
    fire_mage: {
        name: 'Fire Mage',
        tier: 2,
        type: 'ranged',
        description: 'Harness the flames. Burn everything to ash.',
        baseStats: { str: 2, agi: 5, vit: 4, mnd: 13 },
        attackRange: 240,
        attackSpeed: 0.65,
        attackDamage: 14,
        moveSpeed: 195,
        color: '#ff4400',
        size: 14,
        specOptions: ['pyromancer', 'inferno_mage'],
        specLevel: 15,
        startingSkills: [],
        autoAttack: 'fire_bolt_auto',
        passive: 'Ignite: Auto-attacks 25% chance to burn (30% atk dmg/s for 3s)',
        freeSkill: 'fireball',
    },
    arcane_mage: {
        name: 'Arcane Mage',
        tier: 2,
        type: 'ranged',
        description: 'Pure arcane power. Raw magical devastation.',
        baseStats: { str: 2, agi: 5, vit: 4, mnd: 12 },
        attackRange: 260,
        attackSpeed: 0.65,
        attackDamage: 13,
        moveSpeed: 200,
        color: '#aa55ff',
        size: 14,
        specOptions: ['warlock', 'necromancer'],
        specLevel: 15,
        startingSkills: [],
        autoAttack: 'arcane_bolt_plus',
        passive: 'Arcane Power: Skills deal +15% damage',
        freeSkill: 'arcane_blast',
    },

    // ================================================================
    // TIER 3: BERSERKER DEEP SPECS (Level 15)
    // ================================================================
    warlord: {
        name: 'Warlord',
        tier: 3,
        type: 'melee',
        description: 'Cleave through hordes. Frenzy stacks fuel devastation.',
        baseStats: { str: 14, agi: 7, vit: 6, mnd: 2 },
        attackRange: 55,
        attackSpeed: 0.3,
        attackDamage: 16,
        moveSpeed: 210,
        color: '#ff2200',
        size: 20,
        specOptions: [],
        specLevel: null,
        startingSkills: [],
        autoAttack: 'punch',
        passive: 'Frenzy: Each kill grants +5% attack speed for 5s (stacks)',
        freeSkill: 'talon_strike',
    },
    reaper: {
        name: 'Reaper',
        tier: 3,
        type: 'melee',
        description: 'Death incarnate. Execute wounded foes and steal their life.',
        baseStats: { str: 11, agi: 9, vit: 5, mnd: 4 },
        attackRange: 50,
        attackSpeed: 0.35,
        attackDamage: 14,
        moveSpeed: 220,
        color: '#880044',
        size: 17,
        specOptions: [],
        specLevel: null,
        startingSkills: [],
        autoAttack: 'punch',
        passive: 'Execute: Enemies below 20% HP take double damage. Kills heal 10% max HP.',
        freeSkill: 'soul_reap',
    },

    // ================================================================
    // TIER 3: GUARDIAN DEEP SPECS (Level 15)
    // ================================================================
    juggernaut: {
        name: 'Juggernaut',
        tier: 3,
        type: 'melee',
        description: 'Unstoppable force. Reflect damage and crush everything.',
        baseStats: { str: 9, agi: 3, vit: 15, mnd: 2 },
        attackRange: 45,
        attackSpeed: 0.55,
        attackDamage: 9,
        moveSpeed: 140,
        color: '#667788',
        size: 24,
        specOptions: [],
        specLevel: null,
        startingSkills: [],
        autoAttack: 'punch',
        passive: 'Thorns: Reflect 30% of melee damage taken. Immune to knockback.',
        freeSkill: 'unstoppable',
    },
    sentinel: {
        name: 'Sentinel',
        tier: 3,
        type: 'melee',
        description: 'The last line of defense. Unbreakable when it matters most.',
        baseStats: { str: 7, agi: 4, vit: 16, mnd: 3 },
        attackRange: 50,
        attackSpeed: 0.5,
        attackDamage: 10,
        moveSpeed: 160,
        color: '#5599aa',
        size: 22,
        specOptions: [],
        specLevel: null,
        startingSkills: [],
        autoAttack: 'punch',
        passive: 'Last Stand: When below 30% HP, take 50% less damage.',
        freeSkill: 'rally',
    },

    // ================================================================
    // TIER 3: PALADIN DEEP SPECS (Level 15)
    // ================================================================
    crusader: {
        name: 'Crusader',
        tier: 3,
        type: 'melee',
        description: 'Holy fury unleashed. Crits devastate, bosses tremble.',
        baseStats: { str: 10, agi: 5, vit: 8, mnd: 8 },
        attackRange: 50,
        attackSpeed: 0.4,
        attackDamage: 13,
        moveSpeed: 180,
        color: '#ffcc22',
        size: 19,
        specOptions: [],
        specLevel: null,
        startingSkills: [],
        autoAttack: 'smite',
        passive: 'Holy Fury: Crits deal AoE holy damage around target.',
        freeSkill: 'judgment',
    },
    templar: {
        name: 'Templar',
        tier: 3,
        type: 'melee',
        description: 'Sacred protector. Consecrate heals, holy light endures.',
        baseStats: { str: 7, agi: 4, vit: 12, mnd: 9 },
        attackRange: 50,
        attackSpeed: 0.45,
        attackDamage: 10,
        moveSpeed: 165,
        color: '#eedd66',
        size: 20,
        specOptions: [],
        specLevel: null,
        startingSkills: [],
        autoAttack: 'smite',
        passive: 'Aegis: Consecrate radius doubled. Heal 3% max HP when hit (5s internal CD).',
        freeSkill: 'holy_nova',
    },

    // ================================================================
    // TIER 3: FROST MAGE DEEP SPECS (Level 15)
    // ================================================================
    cryomancer: {
        name: 'Cryomancer',
        tier: 3,
        type: 'ranged',
        description: 'Absolute zero. Frozen enemies shatter under your power.',
        baseStats: { str: 2, agi: 8, vit: 5, mnd: 14 },
        attackRange: 260,
        attackSpeed: 0.65,
        attackDamage: 14,
        moveSpeed: 195,
        color: '#22aaff',
        size: 15,
        specOptions: [],
        specLevel: null,
        startingSkills: [],
        autoAttack: 'frost_bolt_auto',
        passive: 'Shatter: Slowed/frozen enemies take 40% more damage from all sources.',
        freeSkill: 'frozen_orb',
    },
    ice_warden: {
        name: 'Ice Warden',
        tier: 3,
        type: 'ranged',
        description: 'Fortress of ice. Untouchable, unyielding cold.',
        baseStats: { str: 2, agi: 6, vit: 8, mnd: 12 },
        attackRange: 240,
        attackSpeed: 0.7,
        attackDamage: 12,
        moveSpeed: 185,
        color: '#66ddff',
        size: 16,
        specOptions: [],
        specLevel: null,
        startingSkills: [],
        autoAttack: 'frost_bolt_auto',
        passive: 'Ice Armor: Take 20% less damage. Enemies that hit you are slowed 50% for 2s.',
        freeSkill: 'ice_barrier',
    },

    // ================================================================
    // TIER 3: FIRE MAGE DEEP SPECS (Level 15)
    // ================================================================
    pyromancer: {
        name: 'Pyromancer',
        tier: 3,
        type: 'ranged',
        description: 'Master of destruction. Burning enemies fuel the inferno.',
        baseStats: { str: 3, agi: 6, vit: 4, mnd: 16 },
        attackRange: 250,
        attackSpeed: 0.6,
        attackDamage: 16,
        moveSpeed: 190,
        color: '#ff2200',
        size: 15,
        specOptions: [],
        specLevel: null,
        startingSkills: [],
        autoAttack: 'fire_bolt_auto',
        passive: 'Firestorm: Burning enemies explode on death (AoE fire damage).',
        freeSkill: 'meteor',
    },
    inferno_mage: {
        name: 'Inferno',
        tier: 3,
        type: 'ranged',
        description: 'Everything burns. Fire spreads, enemies fall.',
        baseStats: { str: 2, agi: 5, vit: 5, mnd: 15 },
        attackRange: 240,
        attackSpeed: 0.65,
        attackDamage: 14,
        moveSpeed: 185,
        color: '#ff6600',
        size: 15,
        specOptions: [],
        specLevel: null,
        startingSkills: [],
        autoAttack: 'fire_bolt_auto',
        passive: 'Wildfire: All fire skills leave burning ground for 3s.',
        freeSkill: 'living_bomb',
    },

    // ================================================================
    // TIER 3: ARCANE MAGE DEEP SPECS (Level 15)
    // ================================================================
    warlock: {
        name: 'Warlock',
        tier: 3,
        type: 'ranged',
        description: 'Dark sorcery. Curses, drains, and forbidden power.',
        baseStats: { str: 3, agi: 5, vit: 6, mnd: 15 },
        attackRange: 240,
        attackSpeed: 0.75,
        attackDamage: 14,
        moveSpeed: 155,
        color: '#6622aa',
        size: 15,
        specOptions: [],
        specLevel: null,
        startingSkills: [],
        autoAttack: 'arcane_bolt_plus',
        passive: 'Siphon: 10% of all damage dealt is returned as HP.',
        freeSkill: 'life_drain',
    },
    necromancer: {
        name: 'Necromancer',
        tier: 3,
        type: 'ranged',
        description: 'Master of death. Raise fallen enemies to serve you.',
        baseStats: { str: 2, agi: 4, vit: 5, mnd: 16 },
        attackRange: 220,
        attackSpeed: 0.85,
        attackDamage: 12,
        moveSpeed: 145,
        color: '#33cc66',
        size: 15,
        specOptions: [],
        specLevel: null,
        startingSkills: [],
        autoAttack: 'arcane_bolt_plus',
        passive: 'Raise Dead: Slain enemies have a 30% chance to rise as your minion for 20s. Bosses rise as Zombie Bosses at 40% power.',
        freeSkill: 'raise_dead',
    },
};

// ============================================================
// SKILL DEFINITIONS
// ============================================================

const SKILL_DATA = {
    // ================================================================
    // AUTO-ATTACKS (not selectable, granted by class/spec)
    // ================================================================
    punch: {
        name: 'Punch',
        type: 'auto',
        description: 'Melee auto-attack',
        cooldown: 0,
        damage: 1.0,
        range: 40,
        projectile: false,
    },
    arcane_bolt: {
        name: 'Arcane Bolt',
        type: 'auto',
        description: 'Ranged arcane auto-attack',
        cooldown: 0,
        damage: 1.0,
        range: 250,
        projectile: true,
        projSpeed: 650,
        projColor: '#bb88ff',
        projSize: 4,
        projSprite: 'proj_purple_bolt',
    },
    frost_bolt_auto: {
        name: 'Frost Bolt',
        type: 'auto',
        description: 'Ranged frost auto-attack. Slows enemies.',
        cooldown: 0,
        damage: 1.0,
        range: 250,
        projectile: true,
        projSpeed: 600,
        projColor: '#44ccff',
        projSize: 5,
        slow: 0.3,
        slowDuration: 2,
        projSprite: 'proj_frostbolt',
    },
    fire_bolt_auto: {
        name: 'Fire Bolt',
        type: 'auto',
        description: 'Ranged fire auto-attack. Chance to ignite.',
        cooldown: 0,
        damage: 1.0,
        range: 240,
        projectile: true,
        projSpeed: 650,
        projColor: '#ff6633',
        projSize: 5,
        burnChance: 0.25,
        burnDamage: 0.3, // 30% of attack damage per second
        burnDuration: 3,
        projSprite: 'proj_firebolt',
    },
    arcane_bolt_plus: {
        name: 'Arcane Surge Bolt',
        type: 'auto',
        description: 'Enhanced arcane auto-attack. Faster, stronger.',
        cooldown: 0,
        damage: 1.2, // +20% damage
        range: 260,
        projectile: true,
        projSpeed: 800, // faster
        projColor: '#cc77ff',
        projSize: 5,
        projSprite: 'proj_purple_bolt',
    },
    smite: {
        name: 'Smite',
        type: 'auto',
        description: 'Holy melee attack. Bonus damage to bosses.',
        cooldown: 0,
        damage: 1.0,
        range: 45,
        projectile: false,
        bossDamageBonus: 0.25, // +25% damage to bosses
    },

    // ================================================================
    // GENERIC MELEE SKILLS (Level 3 — Brawler picks 1)
    // ================================================================
    cleave: {
        name: 'Cleave',
        type: 'active',
        description: 'Wide swing hitting all enemies in front of you.',
        cooldown: 3,
        damage: 1.5,
        range: 60,
        arc: Math.PI * 0.8,
        icon: 'C',
        color: '#ff6633',
        upgrades: {
            a: { name: 'Great Cleave', description: 'Wider arc, +50% damage', arcMult: 1.5, damageMult: 1.5 },
            b: { name: 'Whirlwind', description: 'Full 360 spin', arc: Math.PI * 2, damageMult: 1.2 },
        },
    },
    charge: {
        name: 'Charge',
        type: 'active',
        description: 'Rush forward, damaging and stunning enemies in path.',
        cooldown: 5,
        damage: 2.0,
        range: 200,
        dashSpeed: 800,
        stunDuration: 1.0,
        icon: '>',
        color: '#ffaa00',
        upgrades: {
            a: { name: 'Stampede', description: 'Longer range, more damage', rangeMult: 1.5, damageMult: 1.5 },
            b: { name: 'Shield Bash', description: 'Shorter but stuns longer', rangeMult: 0.7, stunMult: 2.5 },
        },
    },

    // ================================================================
    // GENERIC RANGED SKILLS (Level 3 — Mage picks 1)
    // ================================================================
    multishot: {
        name: 'Multishot',
        type: 'active',
        description: 'Fire 5 projectiles in a spread.',
        cooldown: 4,
        damage: 0.8,
        projectileCount: 5,
        spread: Math.PI * 0.4,
        projSpeed: 650,
        icon: 'M',
        color: '#33ff66',
        projSprite: 'proj_arrow',
        upgrades: {
            a: { name: 'Arrow Storm', description: '8 projectiles, wider spread', projectileCount: 8, spreadMult: 1.5 },
            b: { name: 'Focused Volley', description: '5 tight projectiles, +80% damage', damageMult: 1.8, spreadMult: 0.5 },
        },
    },
    piercing_shot: {
        name: 'Piercing Shot',
        type: 'active',
        description: 'A powerful shot that passes through enemies.',
        cooldown: 3,
        damage: 2.5,
        pierce: true,
        projSpeed: 800,
        icon: 'P',
        color: '#ffdd44',
        projSprite: 'proj_arrow',
        upgrades: {
            a: { name: 'Railgun', description: '+100% damage, faster', damageMult: 2.0, projSpeedMult: 1.5 },
            b: { name: 'Chain Lightning', description: 'Splits into 3 bolts on first hit', splitCount: 3 },
        },
    },

    // ================================================================
    // TIER 2 FREE SKILLS — BRAWLER SPECS
    // ================================================================
    war_cry: {
        name: 'War Cry',
        type: 'active',
        description: 'Boost attack speed by 50% for 5 seconds.',
        cooldown: 12,
        duration: 5,
        attackSpeedBuff: 0.5,
        icon: 'W',
        color: '#ff4444',
        upgrades: {
            a: { name: 'Battle Fury', description: 'Also boosts damage by 30%', damageBuff: 0.3 },
            b: { name: 'Rallying Cry', description: 'Lasts 8 seconds, also boosts move speed', durationMult: 1.6, moveSpeedBuff: 0.3 },
        },
    },
    shield_block: {
        name: 'Shield Block',
        type: 'active',
        description: 'Block all damage for 1.5 seconds.',
        cooldown: 8,
        duration: 1.5,
        icon: 'B',
        color: '#4488cc',
        upgrades: {
            a: { name: 'Reflect Shield', description: 'Reflects projectiles back at enemies', reflect: true },
            b: { name: 'Bulwark', description: 'Lasts 3 seconds', durationMult: 2.0 },
        },
    },
    consecrate: {
        name: 'Consecrate',
        type: 'active',
        description: 'Create holy ground that damages enemies for 5s.',
        cooldown: 10,
        damage: 1.0,
        radius: 80,
        duration: 5,
        tickRate: 0.5,
        icon: 'H',
        color: '#ffdd44',
        upgrades: {
            a: { name: 'Holy Fire', description: 'Radius +50%, also burns enemies', radiusMult: 1.5 },
            b: { name: 'Sanctuary', description: 'Also heals player 1% max HP per tick', healsPlayer: true },
        },
    },

    // ================================================================
    // TIER 2 FREE SKILLS — MAGE SPECS
    // ================================================================
    blizzard: {
        name: 'Blizzard',
        type: 'active',
        description: 'Create a frost zone that slows and damages enemies for 4s.',
        cooldown: 10,
        damage: 1.0,
        radius: 80,
        duration: 4,
        tickRate: 0.5,
        slow: 0.5,
        icon: 'B',
        color: '#44ccff',
        upgrades: {
            a: { name: 'Permafrost', description: 'Enemies take +10% more dmg per sec in zone', stackingDamage: true },
            b: { name: 'Flash Freeze', description: '25% chance to stun 1s per tick', freezeChance: 0.25 },
        },
    },
    fireball: {
        name: 'Fireball',
        type: 'active',
        description: 'Explosive fireball dealing AoE damage.',
        cooldown: 5,
        damage: 3.0,
        aoeRadius: 60,
        projSpeed: 600,
        icon: 'F',
        color: '#ff4400',
        projSprite: 'proj_firebolt',
        upgrades: {
            a: { name: 'Pyroblast', description: 'Huge radius, huge damage, longer cooldown', aoeRadiusMult: 2, damageMult: 1.5, cooldownMult: 1.5 },
            b: { name: 'Rapid Fire', description: 'Lower damage but 1.5s cooldown', damageMult: 0.5, cooldownOverride: 1.5 },
        },
    },
    arcane_blast: {
        name: 'Arcane Blast',
        type: 'active',
        description: 'AoE arcane explosion that damages and knocks back enemies.',
        cooldown: 6,
        damage: 2.0,
        radius: 70,
        knockback: 100,
        icon: 'A',
        color: '#aa55ff',
        upgrades: {
            a: { name: 'Arcane Explosion', description: 'Radius +50%, +30% damage', radiusMult: 1.5, damageMult: 1.3 },
            b: { name: 'Arcane Surge', description: 'No knockback, but reduces all CDs by 2s', noKnockback: true, cdReduction: 2 },
        },
    },

    // ================================================================
    // LEVEL 9 SPEC SKILLS — BERSERKER
    // ================================================================
    slam: {
        name: 'Slam',
        type: 'active',
        description: 'Smash the ground, dealing AoE damage around you.',
        cooldown: 6,
        damage: 2.5,
        radius: 80,
        icon: 'S',
        color: '#cc4400',
        upgrades: {
            a: { name: 'Earthquake', description: 'Larger radius, leaves fire', radiusMult: 1.5, dot: true },
            b: { name: 'Shockwave', description: 'Sends out a wave that knocks back', knockback: 200 },
        },
    },
    bloodlust: {
        name: 'Bloodlust',
        type: 'active',
        description: 'For 6s: lifesteal increased to 20%, +15% attack speed.',
        cooldown: 15,
        duration: 6,
        lifestealBuff: 0.20,
        attackSpeedBuff: 0.15,
        icon: 'L',
        color: '#cc0000',
        upgrades: {
            a: { name: 'Blood Frenzy', description: '10s duration, +20% move speed', durationMult: 1.67, moveSpeedBuff: 0.2 },
            b: { name: 'Crimson Rage', description: 'Lifesteal 30% but take 15% more damage', lifestealOverride: 0.30, selfDamageIncrease: 0.15 },
        },
    },

    // ================================================================
    // LEVEL 9 SPEC SKILLS — GUARDIAN
    // ================================================================
    // (Slam is shared — defined above)
    stone_skin: {
        name: 'Stone Skin',
        type: 'active',
        description: 'For 5s, take 40% less damage. Melee attackers are slowed.',
        cooldown: 12,
        duration: 5,
        damageReduction: 0.4,
        attackerSlow: 0.3,
        attackerSlowDuration: 2,
        icon: 'K',
        color: '#8899aa',
        upgrades: {
            a: { name: 'Diamond Skin', description: 'Take 60% less damage, 7s duration', damageReductionOverride: 0.6, durationMult: 1.4 },
            b: { name: 'Thorned Skin', description: 'Also reflect 25% melee damage', reflectDamage: 0.25 },
        },
    },

    // ================================================================
    // LEVEL 9 SPEC SKILLS — PALADIN
    // ================================================================
    holy_bolt: {
        name: 'Holy Bolt',
        type: 'active',
        description: 'Ranged holy projectile. Stuns for 1s.',
        cooldown: 4,
        damage: 2.0,
        stunDuration: 1.0,
        projSpeed: 700,
        icon: 'H',
        color: '#ffee66',
        projSprite: 'proj_frostbolt',
        upgrades: {
            a: { name: 'Smiting Bolt', description: '+100% damage to bosses, pierces enemies', bossDamageMult: 2.0, pierce: true },
            b: { name: 'Chain Smite', description: 'Bounces to 2 nearby enemies for 60% damage', bounceCount: 2, bounceDamageMult: 0.6 },
        },
    },
    lay_on_hands: {
        name: 'Lay on Hands',
        type: 'active',
        description: 'Instantly heal 30% of your max HP.',
        cooldown: 20,
        healPercent: 0.30,
        icon: 'L',
        color: '#66ff88',
        upgrades: {
            a: { name: 'Divine Restoration', description: 'Heal 50% max HP', healPercentOverride: 0.50 },
            b: { name: 'Grace', description: 'Heal 25%, immune to damage for 2s', healPercentOverride: 0.25, invulnDuration: 2.0 },
        },
    },

    // ================================================================
    // LEVEL 9 SPEC SKILLS — FROST MAGE
    // ================================================================
    frost_trap: {
        name: 'Frost Trap',
        type: 'active',
        description: 'Place a trap that creates a frost zone, freezing enemies.',
        cooldown: 8,
        damage: 2.0,
        stunDuration: 2.0,
        triggerRadius: 40,
        frostZoneRadius: 50,
        icon: 'T',
        color: '#44ccff',
        upgrades: {
            a: { name: 'Frost Mine Field', description: 'Place 3 frost traps', trapCount: 3 },
            b: { name: 'Glacial Trap', description: 'Freeze 4s, +100% damage', stunMult: 2.0, damageMult: 2.0 },
        },
    },
    frost_nova: {
        name: 'Frost Nova',
        type: 'active',
        description: 'Instant AoE freeze around self. Stuns 2s.',
        cooldown: 8,
        damage: 1.5,
        radius: 100,
        stunDuration: 2.0,
        icon: 'N',
        color: '#88ddff',
        upgrades: {
            a: { name: 'Ice Age', description: 'Radius 150, stun 3s', radiusMult: 1.5, stunMult: 1.5 },
            b: { name: 'Snap Freeze', description: '4s CD, smaller radius (60)', cooldownOverride: 4, radiusMult: 0.6 },
        },
    },

    // ================================================================
    // LEVEL 9 SPEC SKILLS — FIRE MAGE
    // ================================================================
    flame_strike: {
        name: 'Flame Strike',
        type: 'active',
        description: 'Delayed fire AoE at target location. Leaves burn zone.',
        cooldown: 7,
        damage: 2.5,
        radius: 80,
        delay: 1.0,
        burnDuration: 2,
        icon: 'S',
        color: '#ff6600',
        upgrades: {
            a: { name: 'Infernal Strike', description: 'Radius 120, burn zone 4s', radiusMult: 1.5, burnDurationMult: 2 },
            b: { name: 'Quick Cast', description: 'No delay, radius 60, 4s CD', noDelay: true, radiusMult: 0.75, cooldownOverride: 4 },
        },
    },
    fire_wall: {
        name: 'Fire Wall',
        type: 'active',
        description: 'Create a line of fire for 4s. Burns enemies passing through.',
        cooldown: 10,
        damage: 1.5,
        wallWidth: 400,
        duration: 4,
        tickRate: 0.3,
        icon: 'W',
        color: '#ff3300',
        upgrades: {
            a: { name: 'Blazing Wall', description: '6s duration, wider (600)', durationMult: 1.5, widthMult: 1.5 },
            b: { name: 'Searing Wall', description: 'Enemies touching it are stunned 1s (once each)', stunOnTouch: 1.0 },
        },
    },

    // ================================================================
    // LEVEL 9 SPEC SKILLS — ARCANE MAGE
    // ================================================================
    teleport: {
        name: 'Teleport',
        type: 'active',
        description: 'Instant blink to target location. Brief invulnerability.',
        cooldown: 6,
        blinkRange: 250,
        invulnDuration: 0.3,
        icon: 'T',
        color: '#cc77ff',
        upgrades: {
            a: { name: 'Phase Shift', description: 'Leave arcane explosion at origin (2x damage)', explosionDamage: 2.0 },
            b: { name: 'Warp', description: '3s CD, range 150', cooldownOverride: 3, blinkRangeOverride: 150 },
        },
    },
    mana_shield: {
        name: 'Mana Shield',
        type: 'active',
        description: 'Absorb 25% max HP in damage. Explodes when depleted.',
        cooldown: 12,
        absorbPercent: 0.25,
        explosionDamageMult: 1.5,
        explosionRadius: 60,
        icon: 'S',
        color: '#9966ff',
        upgrades: {
            a: { name: 'Arcane Barrier', description: 'Absorbs 40% max HP', absorbPercentOverride: 0.40 },
            b: { name: 'Volatile Shield', description: 'Explosion radius doubled, applies 2s stun', radiusMult: 2.0, explosionStun: 2.0 },
        },
    },

    // ================================================================
    // TIER 3 FREE SKILLS — BRAWLER TREE
    // ================================================================
    talon_strike: {
        name: 'Talon Strike',
        type: 'active',
        description: 'Sustained rapid AoE slashing for 5 seconds.',
        cooldown: 10,
        damage: 0.8,
        duration: 5,
        radius: 65,
        tickRate: 0.25,
        icon: 'T',
        color: '#ff4422',
        upgrades: {
            a: { name: 'Endless Talons', description: '8s duration, each hit heals 1% max HP', durationMult: 1.6, healsPerHit: 0.01 },
            b: { name: 'Devastating Talons', description: 'Damage ramps +15% per second (up to +60%)', rampingDamage: 0.15 },
        },
    },
    soul_reap: {
        name: 'Soul Reap',
        type: 'active',
        description: 'Dash through enemies. Enemies below 20% HP are killed instantly.',
        cooldown: 12,
        damage: 3.0,
        dashRange: 250,
        executeThreshold: 0.2,
        icon: 'R',
        color: '#880044',
        upgrades: {
            a: { name: 'Harvest', description: 'Range 350, kills heal 15% max HP each', dashRangeMult: 1.4, killHealPercent: 0.15 },
            b: { name: 'Death Scythe', description: '8s CD, also applies bleed (50% dmg over 3s)', cooldownOverride: 8, bleedDamage: 0.5, bleedDuration: 3 },
        },
    },
    unstoppable: {
        name: 'Unstoppable',
        type: 'active',
        description: 'Charge forward immune to all CC, damaging enemies in path.',
        cooldown: 15,
        damage: 2.0,
        dashRange: 300,
        immuneToCC: true,
        icon: 'U',
        color: '#667788',
        upgrades: {
            a: { name: 'Battering Ram', description: 'Stuns all hit for 2s, +50% damage', stunDuration: 2.0, damageMult: 1.5 },
            b: { name: 'Iron Charge', description: 'Take 0 damage during charge, shorter range', immuneToDamage: true, dashRangeOverride: 200 },
        },
    },
    rally: {
        name: 'Rally',
        type: 'active',
        description: 'Create buff zone: +20% damage reduction, +10% damage for 5s.',
        cooldown: 15,
        radius: 120,
        duration: 5,
        damageReduction: 0.2,
        damageBuff: 0.1,
        icon: 'R',
        color: '#5599aa',
        upgrades: {
            a: { name: 'Fortification', description: '8s duration, also +15% attack speed', durationMult: 1.6, attackSpeedBuff: 0.15 },
            b: { name: 'Bastion', description: 'Radius 180, also regenerate 2% max HP/s', radiusMult: 1.5, regenPercent: 0.02 },
        },
    },
    judgment: {
        name: 'Judgment',
        type: 'active',
        description: 'Ranged holy bolt. Stuns 2s. +50% damage to bosses.',
        cooldown: 10,
        damage: 4.0,
        stunDuration: 2.0,
        bossDamageMult: 1.5,
        projSpeed: 800,
        icon: 'J',
        color: '#ffcc22',
        upgrades: {
            a: { name: 'Divine Judgment', description: 'AoE on impact (radius 60), +100% boss damage', aoeRadius: 60, bossDamageMultOverride: 2.0 },
            b: { name: 'Swift Justice', description: '6s CD, 2.5x damage, pierces enemies', cooldownOverride: 6, damageOverride: 2.5, pierce: true },
        },
    },
    holy_nova: {
        name: 'Holy Nova',
        type: 'active',
        description: 'AoE burst: damage enemies + heal 15% max HP.',
        cooldown: 12,
        damage: 2.0,
        radius: 100,
        healPercent: 0.15,
        icon: 'N',
        color: '#eedd66',
        upgrades: {
            a: { name: 'Divine Nova', description: 'Radius 150, heal 25% max HP', radiusMult: 1.5, healPercentOverride: 0.25 },
            b: { name: 'Purifying Nova', description: 'Removes debuffs, enemies slowed 50% for 3s', cleanse: true, slow: 0.5, slowDuration: 3 },
        },
    },

    // ================================================================
    // TIER 3 FREE SKILLS — MAGE TREE
    // ================================================================
    frozen_orb: {
        name: 'Frozen Orb',
        type: 'active',
        description: 'Launch slow-moving orb that damages and freezes everything in path.',
        cooldown: 10,
        damage: 1.0,
        orbSpeed: 150,
        orbRange: 400,
        orbRadius: 50,
        duration: 4,
        tickRate: 0.3,
        slow: 0.5,
        slowDuration: 2,
        icon: 'O',
        color: '#22aaff',
        upgrades: {
            a: { name: 'Glacial Orb', description: 'Wider orb, +50% damage, stronger slow', orbRadiusMult: 1.5, damageMult: 1.5 },
            b: { name: 'Shatter Orb', description: 'Explodes at end for 3x AoE + 3s freeze', explodeAtEnd: true, explosionDamage: 3.0, freezeDuration: 3 },
        },
    },
    ice_barrier: {
        name: 'Ice Barrier',
        type: 'active',
        description: 'Shield absorbing 30% max HP. Explodes in frost AoE when broken.',
        cooldown: 15,
        absorbPercent: 0.30,
        explosionRadius: 80,
        freezeDuration: 2,
        icon: 'I',
        color: '#66ddff',
        upgrades: {
            a: { name: 'Permafrost Barrier', description: 'Absorbs 50%, slows nearby enemies passively', absorbPercentOverride: 0.50, passiveSlow: true },
            b: { name: 'Glacial Shatter', description: 'Explosion radius 120, 3s freeze, 3x damage', radiusMult: 1.5, freezeDurationOverride: 3, explosionDamage: 3.0 },
        },
    },
    meteor: {
        name: 'Meteor',
        type: 'active',
        description: 'Huge delayed AoE. Massive damage + burning ground.',
        cooldown: 15,
        damage: 5.0,
        radius: 120,
        delay: 2.0,
        burnDuration: 4,
        icon: 'M',
        color: '#ff2200',
        upgrades: {
            a: { name: 'Apocalypse', description: 'Radius 180, +50% damage, 6s burn zone', radiusMult: 1.5, damageMult: 1.5, burnDurationMult: 1.5 },
            b: { name: 'Meteor Shower', description: '3 smaller meteors (2x dmg each, radius 60)', meteorCount: 3, damageOverride: 2.0, radiusOverride: 60 },
        },
    },
    living_bomb: {
        name: 'Living Bomb',
        type: 'active',
        description: 'Mark enemy. After 3s they explode, damaging nearby. Spreads to 1.',
        cooldown: 8,
        damage: 3.0,
        fuseTime: 3.0,
        explosionRadius: 80,
        spreadCount: 1,
        icon: 'B',
        color: '#ff6600',
        upgrades: {
            a: { name: 'Pandemic', description: 'Spreads to 3 enemies, chain reaction', spreadCountOverride: 3 },
            b: { name: 'Volatile Bomb', description: '1.5s fuse, +50% damage, no spread', fuseTimeOverride: 1.5, damageMult: 1.5, spreadCountOverride: 0 },
        },
    },
    life_drain: {
        name: 'Life Drain',
        type: 'active',
        description: 'Channel for 3s: damage target, heal self for 100% of damage.',
        cooldown: 10,
        damage: 1.0,
        channelDuration: 3,
        healPercent: 1.0,
        channelRange: 200,
        tickRate: 0.3,
        icon: 'D',
        color: '#6622aa',
        upgrades: {
            a: { name: 'Soul Siphon', description: 'Channel 5s, also drains 50% move speed', channelDurationOverride: 5, drainSpeed: 0.5 },
            b: { name: 'Mass Drain', description: 'Hits all enemies in radius 80, 50% heal', aoeRadius: 80, healPercentOverride: 0.5 },
        },
    },
    raise_dead: {
        name: 'Raise Dead',
        type: 'active',
        description: 'Raise all nearby corpses as minions for 25s.',
        cooldown: 15,
        minionDuration: 25,
        raiseRadius: 200,
        icon: 'R',
        color: '#33cc66',
        upgrades: {
            a: { name: 'Army of the Dead', description: 'Minions last 40s and deal +50% damage', durationMult: 1.6, minionDamageMult: 1.5 },
            b: { name: 'Zombie Explosion', description: 'Minions explode on death dealing AoE damage', explodeOnDeath: true, explosionDamage: 3.0 },
        },
    },
};

// ============================================================
// SKILL POOLS — What skills are offered at which levels, by spec
// ============================================================

// Generic level 3 skills (offered based on class type)
const GENERIC_SKILL_POOLS = {
    melee: ['cleave', 'charge'],
    ranged: ['multishot', 'piercing_shot'],
};

// Spec-specific skill pools (offered at level 9)
const SPEC_SKILL_POOLS = {
    berserker: { 9: ['slam', 'bloodlust'] },
    guardian: { 9: ['slam', 'stone_skin'] },
    paladin: { 9: ['holy_bolt', 'lay_on_hands'] },
    frost_mage: { 9: ['frost_trap', 'frost_nova'] },
    fire_mage: { 9: ['flame_strike', 'fire_wall'] },
    arcane_mage: { 9: ['teleport', 'mana_shield'] },
    // Tier 3 specs inherit their Tier 2 pool (no new picks after spec)
};

// Levels at which skill upgrades are offered (pick one of your existing skills to upgrade)
const UPGRADE_LEVELS = [12, 18, 24, 30];

// Levels at which generic new skills are offered (pre-spec)
const SKILL_LEVELS = [3];

// Levels at which specialization is offered
const SPEC_LEVELS = [6, 15];

// Level at which spec-specific skills are offered
const SPEC_SKILL_LEVELS = [9];

// XP required per level (scales)
function xpForLevel(level) {
    return Math.floor(80 * Math.pow(1.15, level - 1));
}

// Attribute points per level up
const ATTR_POINTS_PER_LEVEL = 3;
