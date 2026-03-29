// ============================================================
// PROJECTILE SYSTEM - The Inevitable Ruin
// ============================================================

const Projectiles = {
    list: [],
    explosions: [], // visual-only explosion effects
    traps: [], // visible traps on the ground

    spawn(opts) {
        const isTrap = (opts.vx === 0 && opts.vy === 0 && !opts.isBullet);
        if (isTrap) {
            // Traps go into their own list with visuals
            this.traps.push({
                x: opts.x,
                y: opts.y,
                damage: opts.damage || 10,
                owner: opts.owner,
                color: opts.color || '#888844',
                size: opts.size || 8,
                stun: opts.stun || 0,
                triggerRadius: opts.size || 8,
                triggered: false,
                pulseTime: Math.random() * Math.PI * 2,
            });
            return;
        }

        this.list.push({
            x: opts.x,
            y: opts.y,
            vx: opts.vx,
            vy: opts.vy,
            speed: opts.speed || 400,
            damage: opts.damage || 10,
            owner: opts.owner,
            color: opts.color || '#fff',
            size: opts.size || 4,
            pierce: opts.pierce || false,
            aoeRadius: opts.aoeRadius || 0,
            slow: opts.slow || 0,
            slowDuration: opts.slowDuration || 0,
            stun: opts.stun || 0,
            hitTargets: new Set(),
            maxRange: opts.maxRange || 3000,
            traveled: 0,
            sprite: opts.sprite || null,
            // Relic effects
            poison: opts.poison || false,
            poisonStacks: opts.poisonStacks || 0,
            huntersMark: opts.huntersMark || false,
            bounceCount: opts.bounceCount || 0,
            bounceDamageMult: opts.bounceDamageMult || 0.4,
            // Flame Strike
            flameStrike: opts.flameStrike || false,
            flameStrikeAoe: opts.flameStrikeAoe || 0,
            flameStrikeDmg: opts.flameStrikeDmg || 0,
            // Trail tracking
            trail: [],
            trailColor: opts.color || '#fff',
        });
    },

    spawnDirectional(x, y, targetX, targetY, opts) {
        const dx = targetX - x;
        const dy = targetY - y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = opts.speed || 400;
        this.spawn({
            ...opts,
            x, y,
            vx: (dx / len) * speed,
            vy: (dy / len) * speed,
            speed,
            isBullet: true,
        });
    },

    spawnExplosion(x, y, radius, color, duration) {
        this.explosions.push({
            x, y, radius, color,
            timer: duration || 0.4,
            maxTimer: duration || 0.4,
        });
    },

    update(dt, monsters, player, minions) {
        // Update projectiles
        for (let i = this.list.length - 1; i >= 0; i--) {
            const p = this.list[i];
            const moveX = p.vx * dt;
            const moveY = p.vy * dt;
            p.x += moveX;
            p.y += moveY;
            p.traveled += Math.sqrt(moveX * moveX + moveY * moveY);

            // Store trail position
            p.trail.push({ x: p.x, y: p.y, age: 0 });
            if (p.trail.length > 8) p.trail.shift();
            for (const t of p.trail) t.age += dt;

            // Out of bounds or max range
            if (p.x < -50 || p.x > Game.arenaW + 50 || p.y < -50 || p.y > Game.arenaH + 50 || p.traveled > p.maxRange) {
                this.list.splice(i, 1);
                continue;
            }

            let hit = false;

            if (p.owner === 'player' || p.owner === 'minion') {
                for (const m of monsters) {
                    if (m.dead || p.hitTargets.has(m)) continue;
                    const dist = Math.sqrt((p.x - m.x) ** 2 + (p.y - m.y) ** 2);
                    if (dist < m.size + p.size) {
                        this.hitMonster(p, m, monsters);
                        p.hitTargets.add(m);
                        if (!p.pierce) { hit = true; break; }
                    }
                }
            } else if (p.owner === 'monster') {
                const dist = Math.sqrt((p.x - player.x) ** 2 + (p.y - player.y) ** 2);
                if (dist < player.size + p.size) {
                    this.hitPlayer(p, player);
                    hit = true;
                }
                if (!hit && minions) {
                    for (const m of minions) {
                        if (m.dead) continue;
                        const md = Math.sqrt((p.x - m.x) ** 2 + (p.y - m.y) ** 2);
                        if (md < m.size + p.size) {
                            m.hp -= p.damage;
                            Particles.spawn(m.x, m.y, m.color, 3, 50);
                            hit = true;
                            break;
                        }
                    }
                }
            }

            if (hit) {
                this.list.splice(i, 1);
            }
        }

        // Update traps - check if monsters walk over them
        for (let i = this.traps.length - 1; i >= 0; i--) {
            const trap = this.traps[i];
            trap.pulseTime += dt * 4;

            for (const m of monsters) {
                if (m.dead) continue;
                const dist = Math.sqrt((trap.x - m.x) ** 2 + (trap.y - m.y) ** 2);
                if (dist < trap.triggerRadius + m.size) {
                    // BOOM
                    m.hp -= trap.damage;
                    m.flashTimer = 0.15;
                    if (trap.stun) m.stunTimer = trap.stun;
                    Particles.spawn(trap.x, trap.y, '#ffaa00', 15, 150, 0.4, 5);
                    Particles.spawnDamageNumber(m.x, m.y - m.size, trap.damage, '#ffaa00');
                    this.spawnExplosion(trap.x, trap.y, 40, '#ffaa00', 0.3);
                    this.traps.splice(i, 1);
                    break;
                }
            }
        }

        // Update explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            this.explosions[i].timer -= dt;
            if (this.explosions[i].timer <= 0) {
                this.explosions.splice(i, 1);
            }
        }
    },

    hitMonster(proj, monster, allMonsters) {
        let dmg = proj.damage;
        // Hunter's Mark: marked targets take 8% more damage
        if (monster.huntersMark > 0) dmg *= 1.08;
        monster.hp -= dmg;
        Particles.spawn(monster.x, monster.y, proj.color, 4, 80);
        Particles.spawnDamageNumber(monster.x, monster.y - monster.size, dmg, '#fff');

        // Slow effect - also tint monster blue
        if (proj.slow && !monster.dead) {
            monster.slowFactor = 1 - proj.slow;
            monster.slowTimer = proj.slowDuration;
            monster.frozenTint = true;
            Particles.spawn(monster.x, monster.y, '#88ddff', 8, 60, 0.3, 3);
        }
        // Stun / freeze effect
        if (proj.stun && !monster.dead) {
            monster.stunTimer = proj.stun;
            monster.frozenTint = true;
            Particles.spawn(monster.x, monster.y, '#44ccff', 12, 80, 0.4, 4);
        }
        // Hunter's Mark relic: apply mark
        if (proj.huntersMark && !monster.dead) {
            monster.huntersMark = 3;
        }
        // Poison Tip relic: apply poison DoT
        if (proj.poison && !monster.dead && Game.player) {
            const pStacks = proj.poisonStacks || 1;
            const pDps = monster.maxHp * 0.03 * pStacks;
            const existing = Game.player.burnTargets.find(b => b.monster === monster && b.isPoison);
            if (existing) { existing.timer = 3; }
            else { Game.player.burnTargets.push({ monster, timer: 3, dps: pDps, tickTimer: 0, isPoison: true }); }
        }

        // Spell Leech relic: heal 5% of skill/auto damage dealt
        if (proj.owner === 'player' && Game.player && Game.player.hasRelic('spell_leech')) {
            Game.player.hp = Math.min(Game.player.maxHp, Game.player.hp + dmg * 0.05);
        }

        // Flame Strike — attach to target, explodes on death
        if (proj.flameStrike && !monster.dead) {
            monster.flameStrike = {
                aoeRadius: proj.flameStrikeAoe || 60,
                damage: proj.flameStrikeDmg || dmg,
                color: proj.color || '#ff4400',
                timer: 8,
            };
            Particles.spawn(monster.x, monster.y, '#ff6600', 8, 60, 0.3, 3);
        }

        // AoE explosion (non-flame-strike projectiles)
        if (proj.aoeRadius > 0 && !proj.flameStrike) {
            this.spawnExplosion(proj.x, proj.y, proj.aoeRadius, proj.color, 0.35);
            Particles.spawn(proj.x, proj.y, proj.color, 15, 150, 0.5, 6);
            Game.screenShake = 0.15;

            for (const m of allMonsters) {
                if (m === monster || m.dead) continue;
                const dist = Math.sqrt((proj.x - m.x) ** 2 + (proj.y - m.y) ** 2);
                if (dist < proj.aoeRadius) {
                    const aoeDmg = dmg * 0.6;
                    m.hp -= aoeDmg;
                    m.flashTimer = 0.1;
                    Particles.spawnDamageNumber(m.x, m.y - m.size, aoeDmg, '#ffa');
                }
            }
        }

        // Bounce (Chain Lightning relic, Chain Smite upgrade)
        if (proj.bounceCount > 0 && !monster.dead) {
            let nearestBounce = null;
            let nearBDist = Infinity;
            for (const m of allMonsters) {
                if (m.dead || m === monster || proj.hitTargets.has(m)) continue;
                const d = Math.sqrt((m.x - monster.x) ** 2 + (m.y - monster.y) ** 2);
                if (d < 200 && d < nearBDist) { nearBDist = d; nearestBounce = m; }
            }
            if (nearestBounce) {
                const bounceDmg = proj.damage * (proj.bounceDamageMult || 0.4);
                this.spawnDirectional(monster.x, monster.y, nearestBounce.x, nearestBounce.y, {
                    damage: bounceDmg,
                    owner: proj.owner,
                    color: proj.color,
                    size: proj.size * 0.8,
                    speed: proj.speed || 400,
                    bounceCount: proj.bounceCount - 1,
                    bounceDamageMult: proj.bounceDamageMult || 0.4,
                    slow: proj.slow,
                    slowDuration: proj.slowDuration,
                    poison: proj.poison,
                    poisonStacks: proj.poisonStacks,
                    huntersMark: proj.huntersMark,
                });
            }
        }
    },

    hitPlayer(proj, player) {
        if (player.blocking) {
            Particles.spawn(player.x, player.y, '#4488cc', 6, 100);
            return;
        }
        player.takeDamage(proj.damage);
    },

    draw(ctx) {
        if (window.USE_3D) return;
        // Draw traps on ground
        for (const trap of this.traps) {
            const pulse = Math.sin(trap.pulseTime) * 0.2 + 0.8;
            // Outer warning ring
            ctx.globalAlpha = 0.3 * pulse;
            ctx.strokeStyle = trap.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(trap.x, trap.y, trap.triggerRadius + 6, 0, Math.PI * 2);
            ctx.stroke();
            // Inner trap body
            ctx.globalAlpha = 0.6 * pulse;
            ctx.fillStyle = trap.color;
            // Draw as spiky shape
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const r = i % 2 === 0 ? trap.triggerRadius : trap.triggerRadius * 0.5;
                const px = trap.x + Math.cos(angle) * r;
                const py = trap.y + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            // Center dot
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = '#ff4400';
            ctx.beginPath();
            ctx.arc(trap.x, trap.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Draw explosions
        for (const exp of this.explosions) {
            const p = exp.timer / exp.maxTimer;
            const expandedR = exp.radius * (1.2 - p * 0.3);
            // Filled blast
            ctx.globalAlpha = p * 0.35;
            ctx.fillStyle = exp.color;
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, expandedR, 0, Math.PI * 2);
            ctx.fill();
            // Bright inner core
            ctx.globalAlpha = p * 0.5;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, expandedR * 0.3 * p, 0, Math.PI * 2);
            ctx.fill();
            // Expanding ring edge
            ctx.globalAlpha = p * 0.8;
            ctx.strokeStyle = exp.color;
            ctx.lineWidth = 4 * p;
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, expandedR, 0, Math.PI * 2);
            ctx.stroke();
            // Outer shockwave ring
            ctx.globalAlpha = p * 0.4;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(exp.x, exp.y, expandedR * 1.3 * (1 - p * 0.5), 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Draw projectiles with trails
        for (const p of this.list) {
            // Trail
            if (p.trail.length > 1) {
                for (let i = 0; i < p.trail.length - 1; i++) {
                    const t = p.trail[i];
                    const alpha = (i / p.trail.length) * 0.4;
                    const trailSize = p.size * (i / p.trail.length) * 0.6;
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = p.trailColor;
                    ctx.beginPath();
                    ctx.arc(t.x, t.y, trailSize, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            }

            // Main projectile
            if (p.sprite && Sprites.drawProjectile(ctx, p.sprite, p.x, p.y, p.vx, p.vy, p.size * 5)) {
                // Sprite drawn successfully
            } else {
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = p.size > 6 ? 15 : 8;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();

                // Big projectiles get an inner bright core
                if (p.size >= 8) {
                    ctx.fillStyle = '#fff';
                    ctx.globalAlpha = 0.6;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }
            }
        }
        ctx.shadowBlur = 0;
    },

    clear() {
        this.list = [];
        this.explosions = [];
        this.traps = [];
    },
};
