// ============================================================
// MONSTER SYSTEM - The Inevitable Ruin
// ============================================================

const MonsterTypes = {
    // Melee monsters - charge at player
    slime: {
        name: 'Slime',
        hp: 45, damage: 6, speed: 170, size: 12,
        color: '#44cc44', type: 'melee', xp: 15,
        attackSpeed: 1.0, attackRange: 28,
    },
    goblin: {
        name: 'Goblin',
        hp: 65, damage: 10, speed: 260, size: 11,
        color: '#88aa33', type: 'melee', xp: 20,
        attackSpeed: 0.6, attackRange: 28,
    },
    skeleton: {
        name: 'Skeleton',
        hp: 140, damage: 22, speed: 260, size: 13,
        color: '#ccccaa', type: 'melee', xp: 25,
        attackSpeed: 0.55, attackRange: 30,
    },
    orc: {
        name: 'Orc',
        hp: 240, damage: 30, speed: 240, size: 16,
        color: '#558833', type: 'melee', xp: 35,
        attackSpeed: 0.7, attackRange: 32,
    },
    troll: {
        name: 'Troll',
        hp: 400, damage: 40, speed: 185, size: 22,
        color: '#667744', type: 'melee', xp: 50,
        attackSpeed: 0.9, attackRange: 38,
    },
    demon: {
        name: 'Demon',
        hp: 500, damage: 50, speed: 290, size: 18,
        color: '#cc2222', type: 'melee', xp: 65,
        attackSpeed: 0.55, attackRange: 34,
    },

    // Ranged monsters - keep distance, shoot
    imp: {
        name: 'Imp',
        hp: 30, damage: 8, speed: 160, size: 10,
        color: '#ff6644', type: 'ranged', xp: 18,
        attackSpeed: 1.2, attackRange: 220,
        projSpeed: 320, projColor: '#ff4422', projSize: 4,
        projSprite: 'proj_firebolt',
    },
    archer: {
        name: 'Archer',
        hp: 80, damage: 22, speed: 220, size: 12,
        color: '#aa8855', type: 'ranged', xp: 28,
        attackSpeed: 1.0, attackRange: 280,
        projSpeed: 450, projColor: '#ddbb66', projSize: 4,
        projSprite: 'proj_arrow',
    },
    mage_mob: {
        name: 'Dark Mage',
        hp: 110, damage: 32, speed: 165, size: 13,
        color: '#9944dd', type: 'ranged', xp: 40,
        attackSpeed: 1.3, attackRange: 300,
        projSpeed: 350, projColor: '#bb66ff', projSize: 6,
        projSprite: 'proj_purple_bolt',
    },
    fire_elemental: {
        name: 'Fire Elemental',
        hp: 180, damage: 38, speed: 195, size: 15,
        color: '#ff6600', type: 'ranged', xp: 55,
        attackSpeed: 0.7, attackRange: 240,
        projSpeed: 400, projColor: '#ff4400', projSize: 6,
        projSprite: 'proj_firebolt',
    },

    // Bosses
    boss_slime_king: {
        name: 'Slime King',
        hp: 800, damage: 25, speed: 160, size: 35,
        color: '#22ff44', type: 'melee', xp: 100,
        attackSpeed: 0.8, attackRange: 50,
        boss: true,
        ability: {
            name: 'Split',
            cooldown: 3.5,
            type: 'split',
            count: 5,
        },
    },
    boss_skeleton_lord: {
        name: 'Skeleton Lord',
        hp: 1400, damage: 35, speed: 200, size: 30,
        color: '#ffffcc', type: 'melee', xp: 200,
        attackSpeed: 0.6, attackRange: 44,
        boss: true,
        ability: {
            name: 'Bone Storm',
            cooldown: 3,
            type: 'nova',
            projCount: 18,
            projDamage: 0.9,
            projSpeed: 320,
            projColor: '#ffffaa',
            projSize: 5,
        },
    },
    boss_dragon: {
        name: 'Dragon',
        hp: 2400, damage: 55, speed: 185, size: 38,
        color: '#ff3300', type: 'ranged', xp: 400,
        attackSpeed: 1.0, attackRange: 320,
        projSpeed: 380, projColor: '#ff6600', projSize: 9,
        boss: true,
        ability: {
            name: 'Fire Breath',
            cooldown: 3.5,
            type: 'breath',
            projCount: 12,
            projDamage: 0.8,
            projSpeed: 440,
            projColor: '#ff4400',
            projSize: 7,
            spread: 0.9,
        },
    },
    boss_lich: {
        name: 'Lich',
        hp: 1800, damage: 60, speed: 155, size: 28,
        color: '#6633cc', type: 'ranged', xp: 350,
        attackSpeed: 1.2, attackRange: 300,
        projSpeed: 340, projColor: '#9955ff', projSize: 8,
        boss: true,
        ability: {
            name: 'Dark Ritual',
            cooldown: 4,
            type: 'teleport_nova',
            projCount: 20,
            projDamage: 0.9,
            projSpeed: 300,
            projColor: '#bb66ff',
            projSize: 6,
        },
    },
    boss_demon_lord: {
        name: 'Demon Lord',
        hp: 3500, damage: 70, speed: 230, size: 40,
        color: '#aa0000', type: 'melee', xp: 600,
        attackSpeed: 0.5, attackRange: 55,
        boss: true,
        ability: {
            name: 'Hellfire Slam',
            cooldown: 3.5,
            type: 'ground_slam',
            radius: 160,
            damage: 1.8,
            duration: 4,
            color: '#ff2200',
        },
    },
};

// Floor-based monster pool selection
const FLOOR_POOLS = [
    { minFloor: 1, maxFloor: 3, mobs: ['slime', 'imp'], boss: 'boss_slime_king' },
    { minFloor: 4, maxFloor: 6, mobs: ['slime', 'goblin', 'imp', 'archer'], boss: 'boss_skeleton_lord' },
    { minFloor: 7, maxFloor: 10, mobs: ['goblin', 'skeleton', 'archer', 'mage_mob'], boss: 'boss_dragon' },
    { minFloor: 11, maxFloor: 15, mobs: ['skeleton', 'orc', 'mage_mob', 'fire_elemental'], boss: 'boss_lich' },
    { minFloor: 16, maxFloor: 999, mobs: ['orc', 'troll', 'demon', 'fire_elemental', 'mage_mob'], boss: 'boss_demon_lord' },
];

function getFloorPool(floor) {
    for (let i = FLOOR_POOLS.length - 1; i >= 0; i--) {
        if (floor >= FLOOR_POOLS[i].minFloor) return FLOOR_POOLS[i];
    }
    return FLOOR_POOLS[0];
}

function createMonster(typeId, floor, x, y) {
    const def = MonsterTypes[typeId];
    // Scaling ramps up: 25% per floor early, accelerating after floor 10 and 20
    let scale = 1 + (floor - 1) * 0.25;
    if (floor > 10) scale += (floor - 10) * 0.15;
    if (floor > 20) scale += (floor - 20) * 0.20;
    return {
        typeId,
        name: def.name,
        x, y,
        hp: Math.round(def.hp * scale),
        maxHp: Math.round(def.hp * scale),
        damage: Math.round(def.damage * scale),
        speed: def.speed * (1 + Math.max(0, floor - 10) * 0.015),
        size: def.size,
        color: def.color,
        type: def.type,
        xp: Math.round(def.xp * scale),
        attackSpeed: def.attackSpeed,
        attackRange: def.attackRange,
        attackTimer: 0,
        projSpeed: def.projSpeed || 0,
        projColor: def.projColor || def.color,
        projSize: def.projSize || 4,
        projSprite: def.projSprite || null,
        boss: def.boss || false,
        ability: def.ability || null,
        abilityTimer: def.ability ? def.ability.cooldown * 0.5 : 0, // first ability fires faster
        dead: false,
        deathTime: 0, // for corpse tracking (necromancer)
        slowFactor: 1,
        slowTimer: 0,
        stunTimer: 0,
        flashTimer: 0,
        frozenTint: false,
        abilityFlash: 0, // visual telegraph timer
    };
}

function createBoss(floor) {
    const pool = getFloorPool(floor);
    // For higher floors, cycle through bosses with increasing power
    const bossScale = Math.max(1, Math.floor(floor / 5));
    const boss = createMonster(pool.boss, floor);

    // Place boss in center-ish of arena
    boss.x = 400 + Math.random() * 200;
    boss.y = 150 + Math.random() * 100;
    boss._floor = floor;

    // Extra boss scaling for repeated encounters
    if (bossScale > 1) {
        boss.hp = Math.round(boss.hp * (1 + bossScale * 0.3));
        boss.maxHp = boss.hp;
        boss.damage = Math.round(boss.damage * (1 + bossScale * 0.2));
    }
    return boss;
}

function updateMonster(monster, player, dt, arenaW, arenaH) {
    if (monster.dead) return;

    // Stun
    if (monster.stunTimer > 0) {
        monster.stunTimer -= dt;
        return;
    }

    // Slow
    if (monster.slowTimer > 0) {
        monster.slowTimer -= dt;
        if (monster.slowTimer <= 0) {
            monster.slowFactor = 1;
            monster.frozenTint = false;
        }
    }
    if (monster.stunTimer <= 0 && monster.slowTimer <= 0) {
        monster.frozenTint = false;
    }

    const dx = player.x - monster.x;
    const dy = player.y - monster.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (monster.type === 'melee') {
        // Move toward player
        if (dist > monster.attackRange) {
            const speed = monster.speed * monster.slowFactor;
            monster.x += (dx / dist) * speed * dt;
            monster.y += (dy / dist) * speed * dt;
        }

        // Attack if in range
        monster.attackTimer -= dt;
        if (dist <= monster.attackRange + player.size && monster.attackTimer <= 0) {
            monster.attackTimer = monster.attackSpeed;
            return { type: 'melee_hit', damage: monster.damage };
        }
    } else if (monster.type === 'ranged') {
        // Keep distance: move to preferred range
        const preferredDist = monster.attackRange * 0.7;
        const speed = monster.speed * monster.slowFactor;

        // Check if near arena edge (margin = 40px)
        const margin = 40;
        const nearWall = monster.x < margin || monster.x > arenaW - margin ||
                         monster.y < margin || monster.y > arenaH - margin;

        if (nearWall && dist > monster.attackRange * 0.8) {
            // Near wall and far from player — move toward player
            monster.x += (dx / dist) * speed * 0.7 * dt;
            monster.y += (dy / dist) * speed * 0.7 * dt;
        } else if (dist < preferredDist * 0.6 && !nearWall) {
            // Too close, back away (but not into walls)
            monster.x -= (dx / dist) * speed * dt;
            monster.y -= (dy / dist) * speed * dt;
        } else if (dist < preferredDist * 0.6 && nearWall) {
            // Too close but near wall — strafe instead of backing up
            monster.x += (-dy / dist) * speed * 0.6 * dt;
            monster.y += (dx / dist) * speed * 0.6 * dt;
        } else if (dist > monster.attackRange) {
            // Too far, close in
            monster.x += (dx / dist) * speed * 0.7 * dt;
            monster.y += (dy / dist) * speed * 0.7 * dt;
        } else {
            // Strafe slightly
            monster.x += (-dy / dist) * speed * 0.3 * dt;
            monster.y += (dx / dist) * speed * 0.3 * dt;
        }

        // Shoot
        monster.attackTimer -= dt;
        if (dist <= monster.attackRange && monster.attackTimer <= 0) {
            monster.attackTimer = monster.attackSpeed;
            return {
                type: 'ranged_attack',
                x: monster.x, y: monster.y,
                targetX: player.x, targetY: player.y,
                damage: monster.damage,
                speed: monster.projSpeed,
                color: monster.projColor,
                size: monster.projSize,
                sprite: monster.projSprite,
            };
        }
    }

    // Boss ability
    if (monster.ability && monster.boss && !monster.dead) {
        if (monster.abilityFlash > 0) monster.abilityFlash -= dt;
        monster.abilityTimer -= dt;
        if (monster.abilityTimer <= 0) {
            monster.abilityTimer = monster.ability.cooldown;
            monster.abilityFlash = 0.5; // telegraph flash

            const ab = monster.ability;

            if (ab.type === 'nova') {
                // Ring of projectiles outward
                const actions = [];
                for (let i = 0; i < ab.projCount; i++) {
                    const angle = (i / ab.projCount) * Math.PI * 2;
                    const tx = monster.x + Math.cos(angle) * 300;
                    const ty = monster.y + Math.sin(angle) * 300;
                    actions.push({
                        type: 'ranged_attack',
                        x: monster.x, y: monster.y,
                        targetX: tx, targetY: ty,
                        damage: Math.round(monster.damage * (ab.projDamage || 1)),
                        speed: ab.projSpeed || 200,
                        color: ab.projColor || monster.color,
                        size: ab.projSize || 5,
                    });
                }
                Particles.spawn(monster.x, monster.y, ab.projColor || monster.color, 15, 100, 0.4);

                // Keep in bounds
                monster.x = Math.max(monster.size, Math.min(arenaW - monster.size, monster.x));
                monster.y = Math.max(monster.size, Math.min(arenaH - monster.size, monster.y));
                return actions;

            } else if (ab.type === 'breath') {
                // Cone of projectiles toward player
                const actions = [];
                const baseAngle = Math.atan2(dy, dx);
                const spread = ab.spread || 0.6;
                for (let i = 0; i < ab.projCount; i++) {
                    const angle = baseAngle - spread / 2 + (i / (ab.projCount - 1)) * spread;
                    const tx = monster.x + Math.cos(angle) * 400;
                    const ty = monster.y + Math.sin(angle) * 400;
                    actions.push({
                        type: 'ranged_attack',
                        x: monster.x, y: monster.y,
                        targetX: tx, targetY: ty,
                        damage: Math.round(monster.damage * (ab.projDamage || 1)),
                        speed: ab.projSpeed || 300,
                        color: ab.projColor || monster.color,
                        size: ab.projSize || 5,
                    });
                }
                Particles.spawn(monster.x, monster.y, ab.projColor || '#ff4400', 12, 80, 0.3);

                monster.x = Math.max(monster.size, Math.min(arenaW - monster.size, monster.x));
                monster.y = Math.max(monster.size, Math.min(arenaH - monster.size, monster.y));
                return actions;

            } else if (ab.type === 'teleport_nova') {
                // Teleport near player, then nova
                const offsetAngle = Math.random() * Math.PI * 2;
                const offsetDist = 80 + Math.random() * 60;
                monster.x = player.x + Math.cos(offsetAngle) * offsetDist;
                monster.y = player.y + Math.sin(offsetAngle) * offsetDist;
                monster.x = Math.max(monster.size, Math.min(arenaW - monster.size, monster.x));
                monster.y = Math.max(monster.size, Math.min(arenaH - monster.size, monster.y));

                Particles.spawn(monster.x, monster.y, ab.projColor || '#bb66ff', 20, 120, 0.5);

                const actions = [];
                for (let i = 0; i < ab.projCount; i++) {
                    const angle = (i / ab.projCount) * Math.PI * 2;
                    const tx = monster.x + Math.cos(angle) * 300;
                    const ty = monster.y + Math.sin(angle) * 300;
                    actions.push({
                        type: 'ranged_attack',
                        x: monster.x, y: monster.y,
                        targetX: tx, targetY: ty,
                        damage: Math.round(monster.damage * (ab.projDamage || 1)),
                        speed: ab.projSpeed || 180,
                        color: ab.projColor || monster.color,
                        size: ab.projSize || 5,
                    });
                }
                return actions;

            } else if (ab.type === 'ground_slam') {
                // AoE damage zone centered on boss
                Particles.spawn(monster.x, monster.y, ab.color || '#ff2200', 20, ab.radius || 120, 0.6, 5);
                if (typeof Game !== 'undefined') Game.screenShake = 0.3;

                monster.x = Math.max(monster.size, Math.min(arenaW - monster.size, monster.x));
                monster.y = Math.max(monster.size, Math.min(arenaH - monster.size, monster.y));
                return {
                    type: 'boss_ground_slam',
                    x: monster.x, y: monster.y,
                    radius: ab.radius || 120,
                    damage: Math.round(monster.damage * (ab.damage || 1)),
                    duration: ab.duration || 3,
                    color: ab.color || '#ff2200',
                };

            } else if (ab.type === 'split') {
                // Spawn mini slimes
                Particles.spawn(monster.x, monster.y, monster.color, 15, 80, 0.4);

                monster.x = Math.max(monster.size, Math.min(arenaW - monster.size, monster.x));
                monster.y = Math.max(monster.size, Math.min(arenaH - monster.size, monster.y));
                return {
                    type: 'boss_split',
                    x: monster.x, y: monster.y,
                    count: ab.count || 3,
                    bossFloor: monster._floor || 1,
                };
            }
        }
    }

    // Flame Strike timer
    if (monster.flameStrike) {
        monster.flameStrike.timer -= dt;
        if (monster.flameStrike.timer <= 0) {
            monster.flameStrike = null; // fizzles out
        }
    }

    // Keep in bounds
    monster.x = Math.max(monster.size, Math.min(arenaW - monster.size, monster.x));
    monster.y = Math.max(monster.size, Math.min(arenaH - monster.size, monster.y));

    return null;
}

function drawMonster(ctx, monster) {
    if (monster.dead) return;

    const flash = monster.flashTimer > 0;

    // Boss sprite sheets
    const bossSheetKey = monster.typeId; // e.g. 'boss_demon_lord', 'boss_dragon', etc.
    if (monster.boss && Sprites.sheets[bossSheetKey]) {
        const player = Game.player;
        let fx = 0, fy = 1;
        if (player) {
            fx = player.x - monster.x;
            fy = player.y - monster.y;
        }

        // Determine state: walk if moving, idle if in attack range
        const dist = Math.sqrt(fx * fx + fy * fy);
        const isMoving = dist > (monster.attackRange || 50) + 10;
        const state = isMoving ? 'walk' : 'idle';

        Sprites.drawBoss(ctx, bossSheetKey, monster.x, monster.y, fx, fy, state, monster.size * 7, flash);
        drawMonsterOverlays(ctx, monster);
        return;
    }

    // Mob sprite rendering (same 9x6 layout as bosses)
    const mobSpriteKey = monster.typeId === 'slime' ? 'slime_minion' : monster.typeId;
    if (!monster.boss && Sprites.sheets[mobSpriteKey] && Sprites.bossFrameData[mobSpriteKey]) {
        const player = Game.player;
        let fx = 0, fy = 1;
        if (player) {
            fx = player.x - monster.x;
            fy = player.y - monster.y;
        }

        // Determine state: walk if moving toward player, idle if in attack range
        const dist = Math.sqrt(fx * fx + fy * fy);
        const isMoving = dist > (monster.attackRange || 28) + 10;
        const state = isMoving ? 'walk' : 'idle';

        Sprites.drawMob(ctx, mobSpriteKey, monster.x, monster.y, fx, fy, state, monster.size * 7, flash);
        drawMonsterOverlays(ctx, monster);
        return;
    }

    // Body - frozen monsters turn blue/white
    const isFrozen = monster.frozenTint;
    ctx.fillStyle = flash ? '#fff' : (isFrozen ? '#88ccff' : monster.color);
    ctx.beginPath();

    if (monster.boss) {
        // Bosses get a hexagonal shape
        const sides = 6;
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
            const px = monster.x + Math.cos(angle) * monster.size;
            const py = monster.y + Math.sin(angle) * monster.size;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Boss glow
        ctx.shadowColor = monster.color;
        ctx.shadowBlur = 15;
        ctx.strokeStyle = monster.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
    } else {
        // Regular monsters are circles
        ctx.arc(monster.x, monster.y, monster.size, 0, Math.PI * 2);
        ctx.fill();
    }

    drawMonsterOverlays(ctx, monster);
}

function drawMonsterOverlays(ctx, monster) {
    const isFrozen = monster.frozenTint;

    // Frozen / stunned visual
    if (isFrozen) {
        ctx.strokeStyle = '#88ddff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        const iceR = monster.size + 5;
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + performance.now() / 2000;
            const cx = monster.x + Math.cos(a) * iceR;
            const cy = monster.y + Math.sin(a) * iceR;
            ctx.fillStyle = '#aaeeff';
            ctx.beginPath();
            ctx.moveTo(cx, cy - 4);
            ctx.lineTo(cx + 2, cy);
            ctx.lineTo(cx, cy + 4);
            ctx.lineTo(cx - 2, cy);
            ctx.closePath();
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        ctx.strokeStyle = '#44ccff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#44ccff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(monster.x, monster.y, monster.size + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    } else if (monster.stunTimer > 0) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(monster.x, monster.y, monster.size + 4, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Ability telegraph flash
    if (monster.boss && monster.abilityFlash > 0) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 20;
        ctx.globalAlpha = monster.abilityFlash * 2;
        ctx.beginPath();
        ctx.arc(monster.x, monster.y, monster.size + 8 + Math.sin(performance.now() / 50) * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    // Boss ability cooldown indicator
    if (monster.boss && monster.ability && !monster.dead) {
        const ab = monster.ability;
        const pct = 1 - (monster.abilityTimer / ab.cooldown);
        if (pct > 0.5) {
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 2;
            ctx.globalAlpha = (pct - 0.5) * 0.6;
            ctx.beginPath();
            ctx.arc(monster.x, monster.y, monster.size + 6, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    // Flame Strike visual — burning flames on the monster
    if (monster.flameStrike) {
        const t = performance.now() / 150;
        ctx.globalAlpha = 0.7;
        for (let i = 0; i < 5; i++) {
            const a = t + (i / 5) * Math.PI * 2;
            const r = monster.size * 0.7 + Math.sin(t * 2 + i) * 3;
            const fx = monster.x + Math.cos(a) * r;
            const fy = monster.y + Math.sin(a) * r - Math.abs(Math.sin(t + i)) * 6;
            const fsize = 3 + Math.sin(t * 3 + i * 2) * 2;
            ctx.fillStyle = i % 2 === 0 ? '#ff4400' : '#ff8800';
            ctx.beginPath();
            ctx.arc(fx, fy, fsize, 0, Math.PI * 2);
            ctx.fill();
        }
        // Glow ring
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(monster.x, monster.y, monster.size + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    // HP bar
    if (monster.hp < monster.maxHp) {
        const barW = monster.size * 2;
        const barH = 4;
        const barX = monster.x - barW / 2;
        const barY = monster.y - monster.size - 8;
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = monster.boss ? '#ff4444' : '#44cc44';
        ctx.fillRect(barX, barY, barW * (monster.hp / monster.maxHp), barH);
    }
}
