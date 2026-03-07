// ============================================================
// TOWER / FLOOR / WAVE MANAGER - The Inevitable Ruin
// ============================================================

const Tower = {
    floor: 1,
    wave: 1,
    totalWaves: 3,
    monsters: [],
    waveClearTimer: 0,
    floorCleared: false,
    specCheckDone: {},

    init(floor) {
        this.floor = floor || 1;
        this.wave = 1;
        this.monsters = [];
        this.floorCleared = false;
        this.specCheckDone = {};
        this.calculateWaves();
        this.spawnWave();
    },

    calculateWaves() {
        // More waves on higher floors
        if (this.floor <= 3) this.totalWaves = 3;
        else if (this.floor <= 8) this.totalWaves = 4;
        else if (this.floor <= 15) this.totalWaves = 5;
        else this.totalWaves = Math.min(7, 5 + Math.floor((this.floor - 15) / 5));
    },

    getMobCount() {
        // Base mobs scale with floor and wave
        const base = 6 + Math.floor(this.floor * 1.5);
        const waveBonus = Math.floor(this.wave * 1.0);
        return Math.min(40, base + waveBonus);
    },

    spawnWave() {
        const pool = getFloorPool(this.floor);
        const isBossWave = this.wave === this.totalWaves;

        if (isBossWave) {
            // Boss + a few adds
            const boss = createBoss(this.floor);
            this.monsters.push(boss);

            const addCount = Math.min(15, Math.floor(this.floor * 1.2));
            for (let i = 0; i < addCount; i++) {
                const typeId = pool.mobs[Math.floor(Math.random() * pool.mobs.length)];
                const pos = this.getSpawnPos();
                this.monsters.push(createMonster(typeId, this.floor, pos.x, pos.y));
            }
        } else {
            const count = this.getMobCount();
            for (let i = 0; i < count; i++) {
                const typeId = pool.mobs[Math.floor(Math.random() * pool.mobs.length)];
                const pos = this.getSpawnPos();
                this.monsters.push(createMonster(typeId, this.floor, pos.x, pos.y));
            }
        }
    },

    getSpawnPos() {
        // Spawn from edges
        const side = Math.floor(Math.random() * 4);
        const padding = 30;
        const w = Game.arenaW;
        const h = Game.arenaH;
        switch (side) {
            case 0: return { x: padding + Math.random() * (w - padding * 2), y: padding };
            case 1: return { x: padding + Math.random() * (w - padding * 2), y: h - padding };
            case 2: return { x: padding, y: padding + Math.random() * (h - padding * 2) };
            case 3: return { x: w - padding, y: padding + Math.random() * (h - padding * 2) };
        }
    },

    update(dt, player) {
        const alive = this.monsters.filter(m => !m.dead);

        // Update monsters
        for (const m of alive) {
            m.flashTimer = Math.max(0, m.flashTimer - dt);
            const result = updateMonster(m, player, dt, Game.arenaW, Game.arenaH);

            // Normalize to array (boss abilities can return arrays of actions)
            const actions = result ? (Array.isArray(result) ? result : [result]) : [];

            for (const action of actions) {
                if (action.type === 'melee_hit') {
                    player.takeDamage(action.damage, m);
                    // Thorns passive (Juggernaut)
                    if (player.hasPassive('Thorns') && !player.blocking) {
                        const reflected = action.damage * 0.3;
                        m.hp -= reflected;
                        Particles.spawn(m.x, m.y, '#667788', 3, 60);
                    }
                    // Ice Armor passive (Ice Warden) - slow attacker
                    if (player.hasPassive('Ice Armor') && !player.blocking) {
                        m.slowFactor = 0.5;
                        m.slowTimer = 2;
                        m.frozenTint = true;
                        Particles.spawn(m.x, m.y, '#88ddff', 4, 50);
                    }
                    // Stone Skin buff reflect
                    const stoneSkinBuff = player.buffs.find(b => b.id === 'stone_skin');
                    if (stoneSkinBuff) {
                        m.slowFactor = 1 - (stoneSkinBuff.attackerSlow || 0.3);
                        m.slowTimer = stoneSkinBuff.attackerSlowDuration || 2;
                        m.frozenTint = true;
                        if (stoneSkinBuff.reflectDamage) {
                            const reflected = action.damage * stoneSkinBuff.reflectDamage;
                            m.hp -= reflected;
                            Particles.spawn(m.x, m.y, '#8899aa', 3, 60);
                        }
                    }
                } else if (action.type === 'ranged_attack') {
                    Projectiles.spawnDirectional(action.x, action.y, action.targetX, action.targetY, {
                        damage: action.damage,
                        owner: 'monster',
                        color: action.color,
                        size: action.size,
                        speed: action.speed,
                        sprite: action.sprite || null,
                    });
                } else if (action.type === 'boss_ground_slam') {
                    // Create damaging ground zone
                    player.groundEffects.push({
                        x: action.x, y: action.y, radius: action.radius,
                        damage: action.damage * 0.3, color: action.color,
                        timer: action.duration, maxDuration: action.duration,
                        tickTimer: 0, tickRate: 0.5,
                        hurtPlayer: true, // this zone hurts the player
                    });
                    // Immediate damage check
                    const slamDist = Math.sqrt((player.x - action.x) ** 2 + (player.y - action.y) ** 2);
                    if (slamDist < action.radius) {
                        player.takeDamage(action.damage, m);
                    }
                    Game.screenShake = 0.3;
                } else if (action.type === 'boss_split') {
                    // Spawn mini slimes around boss
                    for (let i = 0; i < action.count; i++) {
                        const angle = (i / action.count) * Math.PI * 2;
                        const sx = action.x + Math.cos(angle) * 50;
                        const sy = action.y + Math.sin(angle) * 50;
                        this.monsters.push(createMonster('slime', action.bossFloor || this.floor, sx, sy));
                    }
                }
            }

            // Check death
            if (m.hp <= 0 && !m.dead) {
                m.dead = true;
                m.deathTime = Date.now();
                player.gainXp(m.xp);

                // Add corpse for necromancer
                player.corpses.push({
                    x: m.x, y: m.y,
                    typeId: m.typeId,
                    timer: 30, // corpse lasts 30s
                });

                // Raise Dead passive (Necromancer auto-raise)
                if (player.hasPassive('Raise Dead')) {
                    if (Math.random() < 0.3) {
                        const mDef = MonsterTypes[m.typeId];
                        const isBoss = m.boss;
                        player.minions.push({
                            x: m.x, y: m.y,
                            typeId: m.typeId,
                            boss: !!isBoss,
                            hp: isBoss ? mDef.hp * 0.4 : mDef.hp * 0.5,
                            maxHp: isBoss ? mDef.hp * 0.4 : mDef.hp * 0.5,
                            damage: isBoss ? mDef.damage * 0.3 : mDef.damage * 0.4,
                            speed: mDef.speed * 0.7,
                            size: mDef.size,
                            color: '#33cc66',
                            name: isBoss ? `Zombie ${mDef.name}` : `Risen ${mDef.name}`,
                            timer: 20,
                            atkTimer: 0,
                            dead: false,
                            targetX: 0, targetY: 0,
                        });
                        Particles.spawn(m.x, m.y, '#33cc66', 8, 80, 0.5);
                    }
                }

                // Reaper: heal on kill
                if (player.hasPassive('Execute')) {
                    player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.1);
                }

                // Divine Light passive (Paladin) - heal 2% max HP per kill
                if (player.hasPassive('Divine Light')) {
                    player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.02);
                }

                // Frenzy passive (Warlord)
                if (player.hasPassive('Frenzy')) {
                    player.buffs.push({
                        id: 'frenzy',
                        duration: 5,
                        attackSpeedBuff: 0.05,
                    });
                }

                // Firestorm passive (Pyromancer) - burning enemies explode on death
                if (player.hasPassive('Firestorm') && player.burnTargets) {
                    const burning = player.burnTargets.find(b => b.monster === m);
                    if (burning) {
                        const explosionRadius = 60;
                        const explosionDmg = player.attackDamage * 1.5;
                        for (const other of this.monsters) {
                            if (other.dead || other === m) continue;
                            const dist = Math.sqrt((m.x - other.x) ** 2 + (m.y - other.y) ** 2);
                            if (dist < explosionRadius) {
                                other.hp -= explosionDmg;
                                other.flashTimer = 0.15;
                                Particles.spawnDamageNumber(other.x, other.y - other.size, explosionDmg, '#ff4400');
                            }
                        }
                        Particles.spawn(m.x, m.y, '#ff4400', 15, 120, 0.5, 5);
                        Projectiles.spawnExplosion(m.x, m.y, explosionRadius, '#ff4400', 0.3);
                    }
                }

                // Death particles
                Particles.spawn(m.x, m.y, m.color, 12, 120, 0.5, 4);
                if (m.boss) {
                    Particles.spawn(m.x, m.y, '#ffff00', 20, 200, 0.8, 6);
                }
            }
        }

        // Check wave clear
        const allDead = this.monsters.every(m => m.dead);
        if (allDead && this.monsters.length > 0) {
            if (this.wave < this.totalWaves) {
                this.wave++;
                this.monsters = [];
                this.spawnWave();
            } else if (!this.floorCleared) {
                this.floorCleared = true;
                return 'floor_cleared';
            }
        }

        return null;
    },

    nextFloor(player) {
        this.floor++;
        this.wave = 1;
        this.monsters = [];
        this.floorCleared = false;

        // Specialization is now level-based (handled in player.gainXp)
        this.calculateWaves();
        this.spawnWave();
        return 'continue';
    },

    draw(ctx) {
        for (const m of this.monsters) {
            drawMonster(ctx, m);
        }
    },
};
