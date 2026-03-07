// ============================================================
// PLAYER - The Inevitable Ruin (v2 - Level-Based Specs)
// ============================================================

class Player {
    constructor(classId) {
        const cls = CLASS_DATA[classId];
        this.className = classId;
        this.classHistory = [classId];
        this.classData = cls;

        // Position
        this.x = 0;
        this.y = 0;
        this.size = cls.size;
        this.color = cls.color;

        // Stats
        this.level = 1;
        this.xp = 0;
        this.xpToNext = xpForLevel(2);

        this.attrs = { ...cls.baseStats };
        this.skillPoints = 0;

        // Derived stats (recalculated)
        this.maxHp = 0;
        this.hp = 0;
        this.attackDamage = 0;
        this.attackSpeed = 0;
        this.attackRange = 0;
        this.moveSpeed = 0;
        this.critChance = 0.05;
        this.critMulti = 2.0;

        // Combat state
        this.attackTimer = 0;
        this.facing = { x: 0, y: -1 };
        this.swingTimer = 0;
        this.swingAngle = 0;
        this.swingArc = 0;
        this.swingColor = '';
        this.swingReach = 0;
        this.skillEffect = null;
        this.groundEffects = [];
        this.blocking = false;
        this.blockTimer = 0;
        this.invulnTimer = 0;
        this.flashTimer = 0;

        // Shield absorb (Mana Shield / Ice Barrier)
        this.shieldAbsorb = 0;
        this.shieldType = null; // 'mana_shield' or 'ice_barrier'

        // Channeling state (Life Drain)
        this.channeling = null; // { skillId, timer, target, ... }

        // Talon Strike state
        this.talonStrike = null; // { timer, tickTimer, damage, radius, ... }

        // Burn DoTs on monsters (tracked here for Fire passives)
        this.burnTargets = []; // { monster, timer, dps }

        // Buffs
        this.buffs = [];

        // Skills
        this.skills = [];
        this.skillCooldowns = {};

        // Init starting skills
        for (const sid of cls.startingSkills) {
            this.skills.push({ id: sid, upgraded: null });
        }

        // Minions (for Necromancer)
        this.minions = [];
        this.corpses = [];

        // Pending level-ups
        this.pendingLevelUps = [];
        this.pendingSkillSelections = [];
        this.pendingUpgrades = [];
        this.pendingSpecs = [];

        // Aegis heal cooldown (Templar)
        this.aegisHealTimer = 0;

        // Endless scaling (milestones after level 30)
        this.endlessScaling = 0;

        this.recalcStats();
        this.hp = this.maxHp;
    }

    recalcStats() {
        const cls = this.classData;
        const str = this.attrs.str;
        const agi = this.attrs.agi;
        const vit = this.attrs.vit;
        const mnd = this.attrs.mnd;

        this.maxHp = 60 + vit * 8 + this.level * 3;
        if (cls.type === 'melee') {
            this.attackDamage = cls.attackDamage + str * 1.2 + mnd * 0.2;
        } else {
            this.attackDamage = cls.attackDamage + mnd * 1.2 + str * 0.2;
        }
        this.attackSpeed = cls.attackSpeed * (1 - agi * 0.008);
        this.attackRange = cls.attackRange;
        this.moveSpeed = cls.moveSpeed + agi * 5;
        this.critChance = 0.05 + agi * 0.005;

        // Endless scaling bonuses (every 5 levels after 30)
        const es = this.endlessScaling || 0;
        if (es > 0) {
            this.maxHp = Math.round(this.maxHp * (1 + es * 0.03)); // +3% HP per milestone
            this.attackDamage = Math.round(this.attackDamage * (1 + es * 0.02)); // +2% dmg per milestone
            this.moveSpeed += es * 3; // +3 speed per milestone
            this.critChance += es * 0.005; // +0.5% crit per milestone
        }

        // Passive: Arcane Power (+15% skill damage applied in useSkill, but also buffs auto for arcane_bolt_plus)
        // No stat-modifying passives in recalcStats anymore — they're applied contextually

        this.size = cls.size;
        this.color = cls.color;
    }

    hasPassive(passiveName) {
        for (const cid of this.classHistory) {
            const c = CLASS_DATA[cid];
            if (c.passive && c.passive.startsWith(passiveName.split(':')[0])) return true;
        }
        return false;
    }

    getAutoAttack() {
        return SKILL_DATA[this.classData.autoAttack] || SKILL_DATA['punch'];
    }

    specialize(newClassId) {
        const cls = CLASS_DATA[newClassId];
        this.className = newClassId;
        this.classHistory.push(newClassId);
        this.classData = cls;

        // Gain base stat bonuses from new class
        this.attrs.str += Math.max(0, cls.baseStats.str - 5);
        this.attrs.agi += Math.max(0, cls.baseStats.agi - 5);
        this.attrs.vit += Math.max(0, cls.baseStats.vit - 5);
        this.attrs.mnd += Math.max(0, cls.baseStats.mnd - 5);

        // Swap auto-attack
        if (cls.autoAttack) {
            const autoIdx = this.skills.findIndex(s => SKILL_DATA[s.id] && SKILL_DATA[s.id].type === 'auto');
            if (autoIdx >= 0) {
                this.skills[autoIdx] = { id: cls.autoAttack, upgraded: null };
            }
        }

        // Grant free skill
        if (cls.freeSkill) {
            this.addSkill(cls.freeSkill);
        }

        this.recalcStats();
        this.hp = this.maxHp; // Full heal on spec
    }

    gainXp(amount) {
        this.xp += amount;
        while (this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this.level++;
            this.xpToNext = xpForLevel(this.level + 1);
            this.skillPoints += ATTR_POINTS_PER_LEVEL;

            this.pendingLevelUps.push(this.level);

            // Level 3: Generic skill selection
            if (SKILL_LEVELS.includes(this.level)) {
                const pool = GENERIC_SKILL_POOLS[this.classData.type];
                if (pool) {
                    this.pendingSkillSelections.push({ level: this.level, options: pool });
                }
            }

            // Level 6, 15: Specialization
            if (SPEC_LEVELS.includes(this.level)) {
                if (this.classData.specOptions && this.classData.specOptions.length > 0) {
                    this.pendingSpecs.push(this.level);
                }
            }

            // Level 9: Spec-specific skill selection
            if (SPEC_SKILL_LEVELS.includes(this.level)) {
                const specPool = SPEC_SKILL_POOLS[this.className];
                if (specPool && specPool[this.level]) {
                    this.pendingSkillSelections.push({ level: this.level, options: specPool[this.level] });
                }
            }

            // Skill upgrades at 12, 18, 24, 30
            const autoIds = Object.keys(SKILL_DATA).filter(id => SKILL_DATA[id].type === 'auto');
            if (UPGRADE_LEVELS.includes(this.level) &&
                this.skills.filter(s => !autoIds.includes(s.id) && !s.upgraded && SKILL_DATA[s.id] && SKILL_DATA[s.id].upgrades).length > 0) {
                this.pendingUpgrades.push(this.level);
            }

            // Endless scaling: bonus stats every 5 levels after 30
            if (this.level > 30 && this.level % 5 === 0) {
                this.skillPoints += 2; // extra 2 attr points on top of the normal 3
                // Flat bonuses: +3% max HP, +2% damage per milestone
                this.endlessScaling = (this.endlessScaling || 0) + 1;
            }
        }
    }

    addSkill(skillId) {
        if (!this.skills.find(s => s.id === skillId)) {
            this.skills.push({ id: skillId, upgraded: null });
            this.skillCooldowns[skillId] = 0;
        }
    }

    upgradeSkill(skillId, path) {
        const skill = this.skills.find(s => s.id === skillId);
        if (skill) skill.upgraded = path;
    }

    getActiveSkills() {
        return this.skills.filter(s => SKILL_DATA[s.id] && SKILL_DATA[s.id].type === 'active');
    }

    update(dt, arenaW, arenaH, monsters) {
        // Movement (disabled while channeling)
        const move = this.channeling ? { x: 0, y: 0 } : Input.getMovement();
        if (move.x !== 0 || move.y !== 0) {
            this.facing = { x: move.x, y: move.y };
        }

        let speed = this.moveSpeed;
        for (const b of this.buffs) {
            if (b.moveSpeedBuff) speed *= (1 + b.moveSpeedBuff);
        }

        this.x += move.x * speed * dt;
        this.y += move.y * speed * dt;
        this.x = Math.max(this.size, Math.min(arenaW - this.size, this.x));
        this.y = Math.max(this.size, Math.min(arenaH - this.size, this.y));

        // Timers
        if (this.invulnTimer > 0) this.invulnTimer -= dt;
        if (this.flashTimer > 0) this.flashTimer -= dt;
        if (this.swingTimer > 0) this.swingTimer -= dt;
        if (this.aegisHealTimer > 0) this.aegisHealTimer -= dt;
        if (this.skillEffect) {
            this.skillEffect.timer -= dt;
            if (this.skillEffect.timer <= 0) this.skillEffect = null;
        }
        if (this.blockTimer > 0) {
            this.blockTimer -= dt;
            if (this.blockTimer <= 0) this.blocking = false;
        }

        // Buffs
        for (let i = this.buffs.length - 1; i >= 0; i--) {
            this.buffs[i].duration -= dt;
            if (this.buffs[i].duration <= 0) this.buffs.splice(i, 1);
        }

        // Cooldowns
        for (const sid in this.skillCooldowns) {
            if (this.skillCooldowns[sid] > 0) this.skillCooldowns[sid] -= dt;
        }

        // Channeling (Life Drain)
        if (this.channeling) {
            this.channeling.timer -= dt;
            this.channeling.tickTimer -= dt;
            if (this.channeling.timer <= 0 || !this.channeling.target || this.channeling.target.dead) {
                this.channeling = null;
            } else if (this.channeling.tickTimer <= 0) {
                this.channeling.tickTimer = 0.3;
                const t = this.channeling.target;
                const d = Math.sqrt((t.x - this.x) ** 2 + (t.y - this.y) ** 2);
                if (d < this.channeling.range + 50) {
                    t.hp -= this.channeling.dps * 0.3;
                    t.flashTimer = 0.08;
                    const healAmt = this.channeling.dps * 0.3 * this.channeling.healPercent;
                    this.hp = Math.min(this.maxHp, this.hp + healAmt);
                    Particles.spawn(t.x, t.y, '#6622aa', 3, 50);
                    Particles.spawnDamageNumber(t.x, t.y - t.size, this.channeling.dps * 0.3, '#bb66ff');
                } else {
                    this.channeling = null;
                }
            }
        }

        // Talon Strike (sustained AoE)
        if (this.talonStrike) {
            this.talonStrike.timer -= dt;
            this.talonStrike.tickTimer -= dt;
            if (this.talonStrike.timer <= 0) {
                this.talonStrike = null;
            } else if (this.talonStrike.tickTimer <= 0) {
                this.talonStrike.tickTimer = this.talonStrike.tickRate;
                let tDmg = this.talonStrike.damage;
                // Devastating Talons: ramping damage
                if (this.talonStrike.rampingDamage) {
                    const elapsed = this.talonStrike.maxDuration - this.talonStrike.timer;
                    tDmg *= (1 + this.talonStrike.rampingDamage * elapsed);
                }
                for (const m of monsters) {
                    if (m.dead) continue;
                    const d = Math.sqrt((m.x - this.x) ** 2 + (m.y - this.y) ** 2);
                    if (d < this.talonStrike.radius + m.size) {
                        m.hp -= tDmg;
                        m.flashTimer = 0.08;
                        Particles.spawn(m.x, m.y, '#ff4422', 2, 40, 0.15);
                        Particles.spawnDamageNumber(m.x, m.y - m.size, tDmg, '#ff4422');
                        // Knockback
                        const kx = m.x - this.x;
                        const ky = m.y - this.y;
                        const kd = Math.sqrt(kx * kx + ky * ky) || 1;
                        m.x += (kx / kd) * 10;
                        m.y += (ky / kd) * 10;
                    }
                }
                // Endless Talons: heal per hit
                if (this.talonStrike.healsPerHit) {
                    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.talonStrike.healsPerHit);
                }
            }
        }

        // Burn DoTs
        for (let i = this.burnTargets.length - 1; i >= 0; i--) {
            const b = this.burnTargets[i];
            b.timer -= dt;
            b.tickTimer -= dt;
            if (b.timer <= 0 || b.monster.dead) {
                this.burnTargets.splice(i, 1);
                continue;
            }
            if (b.tickTimer <= 0) {
                b.tickTimer = 0.5;
                b.monster.hp -= b.dps * 0.5;
                b.monster.flashTimer = 0.05;
                Particles.spawn(b.monster.x, b.monster.y, '#ff6600', 2, 30, 0.15);
            }
        }

        // Auto-attack
        this.attackTimer -= dt;
        let atkSpeed = this.attackSpeed;
        for (const b of this.buffs) {
            if (b.attackSpeedBuff) atkSpeed *= (1 - b.attackSpeedBuff);
        }

        // Damage multipliers
        let damageMultiplier = 1;
        if (this.hasPassive('Fury')) {
            damageMultiplier += 1 - (this.hp / this.maxHp);
        }
        // Shatter: +40% to slowed/frozen enemies (applied per-target below)
        for (const b of this.buffs) {
            if (b.damageBuff) damageMultiplier *= (1 + b.damageBuff);
        }

        if (this.attackTimer <= 0 && monsters.length > 0 && !this.channeling) {
            let nearest = null;
            let nearDist = Infinity;
            for (const m of monsters) {
                if (m.dead) continue;
                const d = Math.sqrt((m.x - this.x) ** 2 + (m.y - this.y) ** 2);
                if (d < nearDist) { nearDist = d; nearest = m; }
            }

            if (nearest && nearDist <= this.attackRange + nearest.size) {
                this.attackTimer = atkSpeed;
                const autoDef = this.getAutoAttack();
                let dmg = this.attackDamage * (autoDef.damage || 1.0) * damageMultiplier;

                // Crit
                let isCrit = false;
                if (Math.random() < this.critChance) {
                    dmg *= this.critMulti;
                    isCrit = true;
                }

                if (!autoDef.projectile) {
                    // MELEE auto-attack (punch, smite)
                    const swingArc = Math.PI * 0.6;
                    this.swingAngle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
                    this.swingTimer = 0.15;
                    this.swingArc = swingArc;
                    this.swingColor = this.color;
                    this.swingReach = this.attackRange;

                    const stealPct = this.hasPassive('Siphon') ? 0.08 : 0;
                    let totalDmgDealt = 0;
                    // Bloodlust buff lifesteal override
                    let lifestealPct = stealPct;
                    const blBuff = this.buffs.find(b => b.id === 'bloodlust');
                    if (blBuff) lifestealPct = blBuff.lifestealBuff || lifestealPct;

                    for (const m of monsters) {
                        if (m.dead) continue;
                        const d = Math.sqrt((m.x - this.x) ** 2 + (m.y - this.y) ** 2);
                        if (d > this.attackRange + m.size) continue;
                        const angleToM = Math.atan2(m.y - this.y, m.x - this.x);
                        let angleDiff = angleToM - this.swingAngle;
                        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                        if (Math.abs(angleDiff) > swingArc / 2) continue;

                        let hitDmg = dmg;
                        // Smite: boss damage bonus
                        if (autoDef.bossDamageBonus && m.boss) {
                            hitDmg *= (1 + autoDef.bossDamageBonus);
                        }
                        // Shatter passive: +40% to slowed/frozen
                        if (this.hasPassive('Shatter') && (m.slowTimer > 0 || m.stunTimer > 0)) {
                            hitDmg *= 1.4;
                        }

                        m.hp -= hitDmg;
                        m.flashTimer = 0.1;
                        totalDmgDealt += hitDmg;
                        Particles.spawn(m.x, m.y, this.color, 3, 60);
                        Particles.spawnDamageNumber(m.x, m.y - m.size, hitDmg, isCrit ? '#ffff00' : undefined);

                        // Knockback
                        const kbx = m.x - this.x;
                        const kby = m.y - this.y;
                        const kbLen = Math.sqrt(kbx * kbx + kby * kby) || 1;
                        m.x += (kbx / kbLen) * 25;
                        m.y += (kby / kbLen) * 25;

                        // Holy Fury: crits deal AoE holy around target
                        if (isCrit && this.hasPassive('Holy Fury')) {
                            for (const m2 of monsters) {
                                if (m2.dead || m2 === m) continue;
                                const d2 = Math.sqrt((m2.x - m.x) ** 2 + (m2.y - m.y) ** 2);
                                if (d2 < 60) {
                                    const holyDmg = hitDmg * 0.5;
                                    m2.hp -= holyDmg;
                                    m2.flashTimer = 0.1;
                                    Particles.spawn(m2.x, m2.y, '#ffdd44', 4, 60);
                                    Particles.spawnDamageNumber(m2.x, m2.y - m2.size, holyDmg, '#ffdd44');
                                }
                            }
                        }
                    }

                    if (totalDmgDealt > 0) {
                        this.hp = Math.min(this.maxHp, this.hp + totalDmgDealt * lifestealPct);
                    }
                } else {
                    // RANGED auto-attack (arcane_bolt, frost_bolt_auto, fire_bolt_auto, arcane_bolt_plus)
                    const projOpts = {
                        damage: dmg,
                        owner: 'player',
                        color: autoDef.projColor || this.color,
                        size: autoDef.projSize || 5,
                        speed: autoDef.projSpeed || 650,
                        sprite: autoDef.projSprite || null,
                    };

                    // Frost Bolt auto: slow on hit
                    if (autoDef.slow) {
                        projOpts.slow = autoDef.slow;
                        projOpts.slowDuration = autoDef.slowDuration;
                    }

                    // Shatter passive bonus (applied when projectile hits — simplified: just boost damage to slowed targets)
                    if (this.hasPassive('Shatter') && (nearest.slowTimer > 0 || nearest.stunTimer > 0)) {
                        projOpts.damage *= 1.4;
                    }

                    Projectiles.spawnDirectional(this.x, this.y, nearest.x, nearest.y, projOpts);

                    // Fire Bolt auto: burn chance (Ignite passive)
                    if (autoDef.burnChance && Math.random() < autoDef.burnChance) {
                        const burnDps = this.attackDamage * (autoDef.burnDamage || 0.3);
                        // Check if already burning
                        const existing = this.burnTargets.find(b => b.monster === nearest);
                        if (existing) {
                            existing.timer = autoDef.burnDuration || 3;
                        } else {
                            this.burnTargets.push({
                                monster: nearest,
                                timer: autoDef.burnDuration || 3,
                                dps: burnDps,
                                tickTimer: 0,
                            });
                        }
                    }

                    // Siphon passive
                    if (this.hasPassive('Siphon')) {
                        this.hp = Math.min(this.maxHp, this.hp + dmg * 0.1);
                    }
                }

                // Execute passive (Reaper) — applies to both melee and ranged
                if (this.hasPassive('Execute') && nearest.hp > 0 && nearest.hp / nearest.maxHp < 0.2) {
                    nearest.hp -= dmg;
                    Particles.spawnDamageNumber(nearest.x, nearest.y - nearest.size - 15, dmg, '#ff00ff');
                }
            }
        }

        // Update minions
        for (let i = this.minions.length - 1; i >= 0; i--) {
            const minion = this.minions[i];
            minion.timer -= dt;
            if (minion.timer <= 0 || minion.hp <= 0) {
                // Zombie Explosion on death
                if (minion.explodeOnDeath) {
                    for (const m of monsters) {
                        if (m.dead) continue;
                        const d = Math.sqrt((m.x - minion.x) ** 2 + (m.y - minion.y) ** 2);
                        if (d < 60) {
                            m.hp -= minion.explosionDamage || 30;
                            m.flashTimer = 0.1;
                            Particles.spawnDamageNumber(m.x, m.y - m.size, minion.explosionDamage || 30, '#33cc66');
                        }
                    }
                    Particles.spawn(minion.x, minion.y, '#33cc66', 15, 100, 0.5);
                }
                minion.dead = true;
                this.minions.splice(i, 1);
                continue;
            }
            let nearMon = null;
            let nDist = Infinity;
            for (const m of monsters) {
                if (m.dead) continue;
                const d = Math.sqrt((m.x - minion.x) ** 2 + (m.y - minion.y) ** 2);
                if (d < nDist) { nDist = d; nearMon = m; }
            }
            if (nearMon) {
                const dx = nearMon.x - minion.x;
                const dy = nearMon.y - minion.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                minion.targetX = nearMon.x;
                minion.targetY = nearMon.y;
                if (dist > 30) {
                    minion.x += (dx / dist) * minion.speed * dt;
                    minion.y += (dy / dist) * minion.speed * dt;
                }
                minion.atkTimer -= dt;
                if (dist < 35 && minion.atkTimer <= 0) {
                    minion.atkTimer = 0.8;
                    nearMon.hp -= minion.damage;
                    nearMon.flashTimer = 0.1;
                    Particles.spawn(nearMon.x, nearMon.y, '#33cc66', 2, 40);
                    Particles.spawnDamageNumber(nearMon.x, nearMon.y - nearMon.size, minion.damage, '#66ff88');
                }
            }
        }

        // Corpse timers
        for (let i = this.corpses.length - 1; i >= 0; i--) {
            this.corpses[i].timer -= dt;
            if (this.corpses[i].timer <= 0) this.corpses.splice(i, 1);
        }

        // Ground effects
        for (let i = this.groundEffects.length - 1; i >= 0; i--) {
            const gfx = this.groundEffects[i];
            gfx.timer -= dt;
            gfx.tickTimer -= dt;

            if (gfx.timer <= 0) {
                this.groundEffects.splice(i, 1);
                continue;
            }

            if (gfx.tickTimer <= 0) {
                gfx.tickTimer = gfx.tickRate;

                // Buff zones (Rally) — apply to player
                if (gfx.buffZone) {
                    const pd = Math.sqrt((this.x - gfx.x) ** 2 + (this.y - gfx.y) ** 2);
                    if (pd < gfx.radius) {
                        // Regen
                        if (gfx.regenPercent) {
                            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * gfx.regenPercent * gfx.tickRate);
                        }
                    }
                }

                // Damage zones — hurt monsters
                if (gfx.damage) {
                    for (const m of monsters) {
                        if (m.dead) continue;
                        const d = Math.sqrt((m.x - gfx.x) ** 2 + (m.y - gfx.y) ** 2);
                        if (d < gfx.radius + m.size) {
                            let tickDmg = gfx.damage;
                            // Stacking damage (Permafrost)
                            if (gfx.stackingDamage) {
                                const elapsed = gfx.maxDuration - gfx.timer;
                                tickDmg *= (1 + elapsed * 0.1);
                            }
                            m.hp -= tickDmg;
                            m.flashTimer = 0.08;
                            Particles.spawn(m.x, m.y, gfx.color, 2, 40, 0.2, 2);
                            Particles.spawnDamageNumber(m.x, m.y - m.size, tickDmg, gfx.color);
                            // Slow from frost zones
                            if (gfx.slow) {
                                m.slowFactor = 1 - gfx.slow;
                                m.slowTimer = Math.max(m.slowTimer, 1);
                                m.frozenTint = true;
                            }
                            // Flash Freeze upgrade: chance to stun
                            if (gfx.freezeChance && Math.random() < gfx.freezeChance) {
                                m.stunTimer = Math.max(m.stunTimer, 1);
                            }
                        }
                    }
                    // Sanctuary: heal player
                    if (gfx.healsPlayer) {
                        const pd = Math.sqrt((this.x - gfx.x) ** 2 + (this.y - gfx.y) ** 2);
                        if (pd < gfx.radius) {
                            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.01);
                        }
                    }
                }

                // Boss ground effects that hurt the player
                if (gfx.hurtPlayer && gfx.damage) {
                    const pd = Math.sqrt((this.x - gfx.x) ** 2 + (this.y - gfx.y) ** 2);
                    if (pd < gfx.radius) {
                        this.takeDamage(gfx.damage);
                        Particles.spawn(this.x, this.y, gfx.color, 3, 40, 0.2);
                    }
                }
            }
        }
    }

    useSkill(skillIndex, monsters) {
        const activeSkills = this.getActiveSkills();
        if (skillIndex >= activeSkills.length) return;

        const skill = activeSkills[skillIndex];
        const skillDef = SKILL_DATA[skill.id];
        if (!skillDef || skillDef.type !== 'active') return;

        const cd = this.skillCooldowns[skill.id];
        if (cd > 0) return;

        // Get effective cooldown
        let cooldown = skillDef.cooldown;
        if (skill.upgraded) {
            const upg = skillDef.upgrades[skill.upgraded];
            if (upg.cooldownOverride) cooldown = upg.cooldownOverride;
            if (upg.cooldownMult) cooldown *= upg.cooldownMult;
        }
        this.skillCooldowns[skill.id] = cooldown;

        // Calculate damage
        let dmg = this.attackDamage * (skillDef.damage || 1);
        if (skill.upgraded && skillDef.upgrades[skill.upgraded]) {
            if (skillDef.upgrades[skill.upgraded].damageMult) dmg *= skillDef.upgrades[skill.upgraded].damageMult;
            if (skillDef.upgrades[skill.upgraded].damageOverride) dmg = this.attackDamage * skillDef.upgrades[skill.upgraded].damageOverride;
        }
        if (this.hasPassive('Arcane Power')) dmg *= 1.15;

        // Find nearest for targeting
        let nearest = null;
        let nearDist = Infinity;
        for (const m of monsters) {
            if (m.dead) continue;
            const d = Math.sqrt((m.x - this.x) ** 2 + (m.y - this.y) ** 2);
            if (d < nearDist) { nearDist = d; nearest = m; }
        }
        const targetX = nearest ? nearest.x : this.x + this.facing.x * 100;
        const targetY = nearest ? nearest.y : this.y + this.facing.y * 100;

        // ============================================================
        // SKILL IMPLEMENTATIONS
        // ============================================================

        if (skill.id === 'cleave') {
            let arc = skillDef.arc;
            if (skill.upgraded === 'b') arc = Math.PI * 2;
            else if (skill.upgraded === 'a') arc *= 1.5;
            const range = skillDef.range;
            const facingAngle = Math.atan2(targetY - this.y, targetX - this.x);
            this.swingAngle = facingAngle;
            this.swingTimer = 0.3;
            this.swingArc = arc;
            this.swingColor = skillDef.color;
            this.swingReach = range + 15;

            for (const m of monsters) {
                if (m.dead) continue;
                const d = Math.sqrt((m.x - this.x) ** 2 + (m.y - this.y) ** 2);
                if (d > range + m.size) continue;
                const angle = Math.atan2(m.y - this.y, m.x - this.x);
                let diff = angle - facingAngle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                if (Math.abs(diff) <= arc / 2) {
                    m.hp -= dmg;
                    m.flashTimer = 0.1;
                    Particles.spawn(m.x, m.y, skillDef.color, 6, 100);
                    Particles.spawnDamageNumber(m.x, m.y - m.size, dmg, skillDef.color);
                    const kx = m.x - this.x, ky = m.y - this.y;
                    const kd = Math.sqrt(kx * kx + ky * ky) || 1;
                    m.x += (kx / kd) * 35; m.y += (ky / kd) * 35;
                }
            }
            Particles.spawn(this.x, this.y, skillDef.color, 10, 120, 0.4);

        } else if (skill.id === 'charge' || skill.id === 'unstoppable' || skill.id === 'soul_reap') {
            // Dash-type skills
            let range = skillDef.range || skillDef.dashRange || 200;
            if (skill.upgraded === 'a' && skillDef.upgrades.a.rangeMult) range *= skillDef.upgrades.a.rangeMult;
            if (skill.upgraded === 'a' && skillDef.upgrades.a.dashRangeMult) range *= skillDef.upgrades.a.dashRangeMult;
            if (skill.upgraded === 'b' && skillDef.upgrades.b.rangeMult) range *= skillDef.upgrades.b.rangeMult;
            if (skill.upgraded === 'b' && skillDef.upgrades.b.dashRangeOverride) range = skillDef.upgrades.b.dashRangeOverride;
            const dx = targetX - this.x, dy = targetY - this.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const dirX = dx / len, dirY = dy / len;
            const startX = this.x, startY = this.y;
            this.x += dirX * range;
            this.y += dirY * range;
            // Bounds
            this.x = Math.max(this.size, Math.min(Game.arenaW - this.size, this.x));
            this.y = Math.max(this.size, Math.min(Game.arenaH - this.size, this.y));

            this.skillEffect = { type: 'charge', timer: 0.4, maxTimer: 0.4, color: skillDef.color, startX, startY };

            // Spawn dust/impact particles along the charge path
            const chargeDist = Math.sqrt((this.x - startX) ** 2 + (this.y - startY) ** 2);
            const steps = Math.floor(chargeDist / 30);
            for (let s = 0; s <= steps; s++) {
                const t = s / Math.max(1, steps);
                const px = startX + (this.x - startX) * t;
                const py = startY + (this.y - startY) * t;
                Particles.spawn(px, py, skillDef.color, 3, 40, 0.3, 2);
            }

            // Iron Charge: immune to damage during
            if (skill.id === 'unstoppable' && skill.upgraded === 'b') {
                this.invulnTimer = Math.max(this.invulnTimer, 0.5);
            }

            let stunDur = skillDef.stunDuration || 0;
            if (skill.upgraded === 'b' && skillDef.upgrades.b.stunMult) stunDur *= skillDef.upgrades.b.stunMult;
            if (skill.upgraded === 'a' && skillDef.upgrades.a.stunDuration) stunDur = skillDef.upgrades.a.stunDuration;

            // Hit enemies along the entire charge path, not just at endpoint
            const endX = this.x, endY = this.y;
            for (const m of monsters) {
                if (m.dead) continue;
                // Point-to-line-segment distance from monster to charge path
                const mx = m.x - startX, my = m.y - startY;
                const px = endX - startX, py = endY - startY;
                const pathLen = Math.sqrt(px * px + py * py) || 1;
                const t = Math.max(0, Math.min(1, (mx * px + my * py) / (pathLen * pathLen)));
                const closestX = startX + t * px, closestY = startY + t * py;
                const d = Math.sqrt((m.x - closestX) ** 2 + (m.y - closestY) ** 2);
                if (d < 60) {
                    let hitDmg = dmg;
                    // Soul Reap: execute threshold
                    if (skill.id === 'soul_reap' && m.hp / m.maxHp < (skillDef.executeThreshold || 0.2)) {
                        hitDmg = m.hp + 1; // instant kill
                        Particles.spawn(m.x, m.y, '#880044', 10, 120);
                        if (skill.upgraded === 'a' && skillDef.upgrades.a.killHealPercent) {
                            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * skillDef.upgrades.a.killHealPercent);
                        }
                    }
                    m.hp -= hitDmg;
                    if (stunDur > 0) m.stunTimer = stunDur;
                    m.flashTimer = 0.15;
                    Particles.spawn(m.x, m.y, skillDef.color, 8, 120);
                    Particles.spawnDamageNumber(m.x, m.y - m.size, hitDmg, skillDef.color);
                    // Soul Reap bleed
                    if (skill.id === 'soul_reap' && skill.upgraded === 'b') {
                        this.burnTargets.push({
                            monster: m, timer: 3, dps: dmg * 0.5 / 3, tickTimer: 0,
                        });
                    }
                }
            }
            Particles.spawn(this.x, this.y, skillDef.color, 12, 150, 0.5);

        } else if (skill.id === 'slam' || skill.id === 'frost_nova' || skill.id === 'arcane_blast' || skill.id === 'holy_nova') {
            // AoE around self (or target for arcane_blast)
            let radius = skillDef.radius;
            if (skill.upgraded === 'a' && skillDef.upgrades.a.radiusMult) radius *= skillDef.upgrades.a.radiusMult;
            if (skill.upgraded === 'b' && skillDef.upgrades.b.radiusMult) radius *= skillDef.upgrades.b.radiusMult;

            const cx = (skill.id === 'arcane_blast') ? targetX : this.x;
            const cy = (skill.id === 'arcane_blast') ? targetY : this.y;

            this.skillEffect = { type: 'slam', timer: 0.4, maxTimer: 0.4, color: skillDef.color, radius };

            let stunDur = skillDef.stunDuration || 0;
            if (skill.upgraded === 'a' && skillDef.upgrades.a.stunMult) stunDur *= skillDef.upgrades.a.stunMult;

            for (const m of monsters) {
                if (m.dead) continue;
                const d = Math.sqrt((m.x - cx) ** 2 + (m.y - cy) ** 2);
                if (d < radius + m.size) {
                    m.hp -= dmg;
                    m.flashTimer = 0.15;
                    Particles.spawnDamageNumber(m.x, m.y - m.size, dmg, skillDef.color);
                    if (stunDur > 0) { m.stunTimer = stunDur; m.frozenTint = skill.id === 'frost_nova'; }
                    // Knockback (slam, arcane_blast)
                    const useKnockback = skill.id !== 'frost_nova' && skill.id !== 'holy_nova' &&
                        !(skill.id === 'arcane_blast' && skill.upgraded === 'b');
                    if (useKnockback) {
                        const kx = m.x - cx, ky = m.y - cy;
                        const kd = Math.sqrt(kx * kx + ky * ky) || 1;
                        const kbDist = (skill.id === 'slam' && skill.upgraded === 'b') ? 200 :
                            (skillDef.knockback || 80);
                        m.x += (kx / kd) * kbDist; m.y += (ky / kd) * kbDist;
                    }
                    // Holy Nova slow (Purifying Nova)
                    if (skill.id === 'holy_nova' && skill.upgraded === 'b') {
                        m.slowFactor = 0.5; m.slowTimer = 3; m.frozenTint = false;
                    }
                }
            }
            Particles.spawn(cx, cy, skillDef.color, 20, 180, 0.5, 5);

            // Slam Earthquake: fire zone
            if (skill.id === 'slam' && skill.upgraded === 'a') {
                this.groundEffects.push({
                    x: this.x, y: this.y, radius, damage: dmg * 0.3,
                    color: '#ff4400', timer: 4, maxDuration: 4, tickTimer: 0, tickRate: 0.5,
                });
            }

            // Holy Nova: self heal
            if (skill.id === 'holy_nova') {
                let healPct = skillDef.healPercent || 0.15;
                if (skill.upgraded === 'a' && skillDef.upgrades.a.healPercentOverride) healPct = skillDef.upgrades.a.healPercentOverride;
                this.hp = Math.min(this.maxHp, this.hp + this.maxHp * healPct);
            }

            // Arcane Surge: reduce all cooldowns
            if (skill.id === 'arcane_blast' && skill.upgraded === 'b') {
                for (const sid in this.skillCooldowns) {
                    if (sid !== skill.id) this.skillCooldowns[sid] = Math.max(0, this.skillCooldowns[sid] - 2);
                }
            }

        } else if (skill.id === 'war_cry' || skill.id === 'bloodlust' || skill.id === 'stone_skin') {
            // Buff skills
            let dur = skillDef.duration;
            if (skill.upgraded === 'b' && skillDef.upgrades.b.durationMult) dur *= skillDef.upgrades.b.durationMult;
            if (skill.upgraded === 'a' && skillDef.upgrades.a.durationMult) dur *= skillDef.upgrades.a.durationMult;

            const buff = { id: skill.id, duration: dur };

            if (skill.id === 'war_cry') {
                buff.attackSpeedBuff = skillDef.attackSpeedBuff;
                if (skill.upgraded === 'a') buff.damageBuff = 0.3;
                if (skill.upgraded === 'b') buff.moveSpeedBuff = 0.3;
            } else if (skill.id === 'bloodlust') {
                buff.lifestealBuff = skill.upgraded === 'b' ? 0.30 : (skillDef.lifestealBuff || 0.20);
                buff.attackSpeedBuff = skillDef.attackSpeedBuff || 0.15;
                if (skill.upgraded === 'a') buff.moveSpeedBuff = 0.2;
            } else if (skill.id === 'stone_skin') {
                buff.damageReduction = skill.upgraded === 'a' ? 0.6 : (skillDef.damageReduction || 0.4);
                buff.attackerSlow = skillDef.attackerSlow;
                buff.attackerSlowDuration = skillDef.attackerSlowDuration;
                if (skill.upgraded === 'b') buff.reflectDamage = 0.25;
            }

            this.buffs.push(buff);
            this.skillEffect = { type: 'war_cry', timer: 0.6, maxTimer: 0.6, color: skillDef.color };
            Particles.spawn(this.x, this.y, skillDef.color, 15, 100, 0.6, 4);

        } else if (skill.id === 'shield_block') {
            let dur = skillDef.duration;
            if (skill.upgraded === 'b') dur *= 2.0;
            this.blocking = true;
            this.blockTimer = dur;
            this.skillEffect = { type: 'block', timer: dur, maxTimer: dur, color: skillDef.color };
            Particles.spawn(this.x, this.y, skillDef.color, 10, 60, 0.4);

        } else if (skill.id === 'multishot') {
            let count = skillDef.projectileCount;
            let spread = skillDef.spread;
            if (skill.upgraded === 'a') { count = 8; spread *= 1.5; }
            if (skill.upgraded === 'b') { spread *= 0.5; }
            const baseAngle = Math.atan2(targetY - this.y, targetX - this.x);
            Particles.spawn(this.x, this.y, skillDef.color, 8, 80, 0.2, 3);
            for (let i = 0; i < count; i++) {
                const angle = baseAngle + (i / (count - 1) - 0.5) * spread;
                Projectiles.spawn({
                    x: this.x, y: this.y,
                    vx: Math.cos(angle) * skillDef.projSpeed,
                    vy: Math.sin(angle) * skillDef.projSpeed,
                    damage: dmg, owner: 'player',
                    color: skillDef.color || this.color, size: 6,
                    sprite: skillDef.projSprite || null,
                    isBullet: true,
                });
            }

        } else if (skill.id === 'piercing_shot' || skill.id === 'holy_bolt' || skill.id === 'judgment') {
            // Projectile skills
            const projOpts = {
                damage: dmg, owner: 'player',
                color: skillDef.color, size: skill.id === 'piercing_shot' ? 8 : 10,
                speed: skillDef.projSpeed * (skill.upgraded === 'a' && skillDef.upgrades.a.projSpeedMult ? skillDef.upgrades.a.projSpeedMult : 1),
                sprite: skillDef.projSprite || null,
            };
            if (skillDef.pierce || (skill.upgraded === 'a' && skillDef.upgrades.a.pierce) || (skill.upgraded === 'b' && skillDef.upgrades.b.pierce)) {
                projOpts.pierce = true;
            }
            if (skillDef.stunDuration) projOpts.stun = skillDef.stunDuration;
            // Boss damage bonus
            if (skill.id === 'judgment') {
                let bossMult = skillDef.bossDamageMult || 1.5;
                if (skill.upgraded === 'a' && skillDef.upgrades.a.bossDamageMultOverride) bossMult = skillDef.upgrades.a.bossDamageMultOverride;
                if (nearest && nearest.boss) projOpts.damage *= bossMult;
                if (skill.upgraded === 'a') projOpts.aoeRadius = 60;
            }
            // Holy Bolt boss bonus
            if (skill.id === 'holy_bolt' && skill.upgraded === 'a' && nearest && nearest.boss) {
                projOpts.damage *= 2.0;
            }
            // Chain Smite (Holy Bolt upgrade b)
            if (skill.id === 'holy_bolt' && skill.upgraded === 'b') {
                projOpts.bounceCount = 2;
                projOpts.bounceDamageMult = 0.6;
            }
            Particles.spawn(this.x, this.y, skillDef.color, 6, 60, 0.15, 2);
            Projectiles.spawnDirectional(this.x, this.y, targetX, targetY, projOpts);

        } else if (skill.id === 'fireball') {
            let aoeR = skillDef.aoeRadius;
            if (skill.upgraded === 'a') aoeR *= 2;
            Particles.spawn(this.x, this.y, skillDef.color, 10, 80, 0.25, 4);
            Projectiles.spawnDirectional(this.x, this.y, targetX, targetY, {
                damage: dmg, owner: 'player', color: skillDef.color,
                size: 12, speed: skillDef.projSpeed,
                flameStrike: true, // attach to target, explode on death
                flameStrikeAoe: aoeR,
                flameStrikeDmg: dmg,
                sprite: skillDef.projSprite || null,
            });

        } else if (skill.id === 'frost_trap') {
            const count = skill.upgraded === 'a' ? 3 : 1;
            const stunDur = (skillDef.stunDuration || 2) * (skill.upgraded === 'b' ? 2 : 1);
            for (let i = 0; i < count; i++) {
                const tx = this.x + (Math.random() - 0.5) * 60;
                const ty = this.y + (Math.random() - 0.5) * 60;
                Projectiles.spawn({
                    x: tx, y: ty, vx: 0, vy: 0,
                    damage: dmg, owner: 'player',
                    color: skillDef.color, size: 8,
                    maxRange: 999999, stun: stunDur,
                    slow: 0.5, slowDuration: 3,
                });
            }

        } else if (skill.id === 'flame_strike') {
            // Delayed AoE at target
            let radius = skillDef.radius || 80;
            if (skill.upgraded === 'a' && skillDef.upgrades.a.radiusMult) radius *= skillDef.upgrades.a.radiusMult;
            if (skill.upgraded === 'b' && skillDef.upgrades.b.radiusMult) radius *= skillDef.upgrades.b.radiusMult;
            const delay = (skill.upgraded === 'b' && skillDef.upgrades.b.noDelay) ? 0 : (skillDef.delay || 1.0);

            // Visual warning circle
            this.groundEffects.push({
                x: targetX, y: targetY, radius, damage: 0,
                color: '#ff660044', timer: delay, maxDuration: delay, tickTimer: 999, tickRate: 999,
                isWarning: true,
            });

            const self = this;
            setTimeout(() => {
                // Deal damage
                for (const m of Tower.monsters) {
                    if (m.dead) continue;
                    const d = Math.sqrt((m.x - targetX) ** 2 + (m.y - targetY) ** 2);
                    if (d < radius + m.size) {
                        m.hp -= dmg;
                        m.flashTimer = 0.15;
                        Particles.spawnDamageNumber(m.x, m.y - m.size, dmg, '#ff6600');
                    }
                }
                Particles.spawn(targetX, targetY, '#ff6600', 20, 150, 0.5, 5);
                Game.screenShake = 0.2;

                // Leave burn zone
                let burnDur = skillDef.burnDuration || 2;
                if (skill.upgraded === 'a' && skillDef.upgrades.a.burnDurationMult) burnDur *= skillDef.upgrades.a.burnDurationMult;
                // Wildfire passive: extend burn zones
                if (self.hasPassive('Wildfire')) burnDur += 3;
                self.groundEffects.push({
                    x: targetX, y: targetY, radius: radius * 0.8,
                    damage: dmg * 0.2, color: '#ff4400',
                    timer: burnDur, maxDuration: burnDur, tickTimer: 0, tickRate: 0.5,
                });
            }, delay * 1000);

        } else if (skill.id === 'fire_wall') {
            let wallWidth = skillDef.wallWidth || 200;
            let dur = skillDef.duration || 4;
            if (skill.upgraded === 'a') { dur *= 1.5; wallWidth *= 1.5; }
            const angle = Math.atan2(targetY - this.y, targetX - this.x);
            // Create wall as overlapping ground effects filling the full width
            const segmentSpacing = 30; // overlap slightly (radius 25, spacing 30)
            const segments = Math.max(5, Math.ceil(wallWidth / segmentSpacing));
            for (let i = 0; i < segments; i++) {
                const offset = (i / (segments - 1) - 0.5) * wallWidth;
                const wx = this.x + Math.cos(angle) * 80 + Math.cos(angle + Math.PI / 2) * offset;
                const wy = this.y + Math.sin(angle) * 80 + Math.sin(angle + Math.PI / 2) * offset;
                let wallDur = dur;
                if (this.hasPassive('Wildfire')) wallDur += 3;
                this.groundEffects.push({
                    x: wx, y: wy, radius: 25,
                    damage: dmg * 0.3, color: '#ff3300',
                    timer: wallDur, maxDuration: wallDur, tickTimer: 0, tickRate: skillDef.tickRate || 0.3,
                    sprite: 'proj_firebolt',
                });
            }
            Particles.spawn(this.x, this.y, '#ff3300', 10, 80, 0.3);

        } else if (skill.id === 'teleport') {
            let blinkRange = skillDef.blinkRange || 250;
            if (skill.upgraded === 'b' && skillDef.upgrades.b.blinkRangeOverride) blinkRange = skillDef.upgrades.b.blinkRangeOverride;
            const dx = targetX - this.x, dy = targetY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const range = Math.min(dist, blinkRange);
            const originX = this.x, originY = this.y;

            this.x += (dx / (dist || 1)) * range;
            this.y += (dy / (dist || 1)) * range;
            this.x = Math.max(this.size, Math.min(Game.arenaW - this.size, this.x));
            this.y = Math.max(this.size, Math.min(Game.arenaH - this.size, this.y));
            this.invulnTimer = Math.max(this.invulnTimer, skillDef.invulnDuration || 0.3);

            Particles.spawn(originX, originY, skillDef.color, 12, 80, 0.3);
            Particles.spawn(this.x, this.y, skillDef.color, 12, 80, 0.3);

            // Phase Shift: explosion at origin
            if (skill.upgraded === 'a') {
                const expDmg = this.attackDamage * (skillDef.upgrades.a.explosionDamage || 2.0);
                for (const m of monsters) {
                    if (m.dead) continue;
                    const d = Math.sqrt((m.x - originX) ** 2 + (m.y - originY) ** 2);
                    if (d < 60) {
                        m.hp -= expDmg;
                        m.flashTimer = 0.1;
                        Particles.spawnDamageNumber(m.x, m.y - m.size, expDmg, skillDef.color);
                    }
                }
                Particles.spawn(originX, originY, skillDef.color, 20, 120, 0.5);
            }

        } else if (skill.id === 'mana_shield' || skill.id === 'ice_barrier') {
            let absorbPct = skillDef.absorbPercent || 0.25;
            if (skill.upgraded === 'a') {
                const override = skillDef.upgrades.a.absorbPercentOverride;
                if (override) absorbPct = override;
            }
            this.shieldAbsorb = this.maxHp * absorbPct;
            this.shieldType = skill.id;
            this.shieldSkillUpgrade = skill.upgraded;
            this.skillEffect = { type: 'block', timer: 30, maxTimer: 30, color: skillDef.color };
            Particles.spawn(this.x, this.y, skillDef.color, 10, 60, 0.4);

        } else if (skill.id === 'lay_on_hands') {
            let healPct = skillDef.healPercent || 0.3;
            if (skill.upgraded === 'a' && skillDef.upgrades.a.healPercentOverride) healPct = skillDef.upgrades.a.healPercentOverride;
            if (skill.upgraded === 'b' && skillDef.upgrades.b.healPercentOverride) healPct = skillDef.upgrades.b.healPercentOverride;
            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * healPct);
            if (skill.upgraded === 'b') this.invulnTimer = Math.max(this.invulnTimer, 2.0);
            Particles.spawn(this.x, this.y, '#66ff88', 15, 80, 0.5);

        } else if (skill.id === 'consecrate' || skill.id === 'blizzard' || skill.id === 'rally') {
            // Ground zone skills
            let radius = skillDef.radius || 80;
            let dur = skillDef.duration || 5;
            if (skill.upgraded === 'a' && skillDef.upgrades.a.radiusMult) radius *= skillDef.upgrades.a.radiusMult;
            if (skill.upgraded === 'b' && skillDef.upgrades.b.radiusMult) radius *= skillDef.upgrades.b.radiusMult;
            if (skill.upgraded === 'a' && skillDef.upgrades.a.durationMult) dur *= skillDef.upgrades.a.durationMult;

            // Templar Aegis: double consecrate radius
            if (skill.id === 'consecrate' && this.hasPassive('Aegis')) radius *= 2;

            const zone = {
                x: this.x, y: this.y, radius,
                damage: dmg * (skillDef.tickRate || 0.5),
                color: skillDef.color,
                timer: dur, maxDuration: dur,
                tickTimer: 0, tickRate: skillDef.tickRate || 0.5,
            };

            if (skill.id === 'blizzard') {
                zone.slow = skillDef.slow || 0.5;
                if (skill.upgraded === 'a') zone.stackingDamage = true;
                if (skill.upgraded === 'b') zone.freezeChance = 0.25;
            }
            if (skill.id === 'consecrate') {
                if (skill.upgraded === 'b') zone.healsPlayer = true;
            }
            if (skill.id === 'rally') {
                zone.damage = 0;
                zone.buffZone = true;
                zone.damageReduction = skillDef.damageReduction || 0.2;
                zone.damageBuff = skillDef.damageBuff || 0.1;
                if (skill.upgraded === 'a') zone.attackSpeedBuff = 0.15;
                if (skill.upgraded === 'b') { zone.radius *= 1.5; zone.regenPercent = 0.02; }
            }

            this.groundEffects.push(zone);
            this.skillEffect = { type: 'slam', timer: 0.4, maxTimer: 0.4, color: skillDef.color, radius };
            Particles.spawn(this.x, this.y, skillDef.color, 15, 120, 0.5, 4);

        } else if (skill.id === 'talon_strike') {
            let dur = skillDef.duration || 5;
            if (skill.upgraded === 'a' && skillDef.upgrades.a.durationMult) dur *= skillDef.upgrades.a.durationMult;
            this.talonStrike = {
                timer: dur, maxDuration: dur,
                tickTimer: 0, tickRate: skillDef.tickRate || 0.25,
                damage: dmg,
                radius: skillDef.radius || 65,
                healsPerHit: skill.upgraded === 'a' ? 0.01 : 0,
                rampingDamage: skill.upgraded === 'b' ? 0.15 : 0,
            };
            this.skillEffect = { type: 'war_cry', timer: 0.6, maxTimer: 0.6, color: skillDef.color };
            Particles.spawn(this.x, this.y, skillDef.color, 15, 100, 0.5);

        } else if (skill.id === 'frozen_orb') {
            const orbOpts = {
                damage: dmg, owner: 'player',
                color: skillDef.color, size: 15,
                speed: skillDef.orbSpeed || 150,
                aoeRadius: skillDef.orbRadius || 50,
                slow: skillDef.slow || 0.5,
                slowDuration: skillDef.slowDuration || 2,
                pierce: true, maxRange: skillDef.orbRange || 400,
            };
            if (skill.upgraded === 'a') {
                orbOpts.size = 20;
                orbOpts.damage *= 1.5;
                orbOpts.aoeRadius = (skillDef.orbRadius || 50) * 1.5;
            }
            Projectiles.spawnDirectional(this.x, this.y, targetX, targetY, orbOpts);
            Particles.spawn(this.x, this.y, skillDef.color, 10, 80, 0.3);

        } else if (skill.id === 'meteor') {
            let radius = skillDef.radius || 120;
            let meteorDmg = dmg;
            if (skill.upgraded === 'a' && skillDef.upgrades.a.radiusMult) radius *= skillDef.upgrades.a.radiusMult;
            const delay = skillDef.delay || 2.0;

            const count = (skill.upgraded === 'b' && skillDef.upgrades.b.meteorCount) ? skillDef.upgrades.b.meteorCount : 1;
            if (skill.upgraded === 'b') {
                radius = skillDef.upgrades.b.radiusOverride || 60;
                meteorDmg = this.attackDamage * (skillDef.upgrades.b.damageOverride || 2.0);
            }

            for (let i = 0; i < count; i++) {
                const mx = targetX + (count > 1 ? (Math.random() - 0.5) * 200 : 0);
                const my = targetY + (count > 1 ? (Math.random() - 0.5) * 200 : 0);
                const r = radius;
                const md = meteorDmg;

                // Warning circle
                this.groundEffects.push({
                    x: mx, y: my, radius: r, damage: 0,
                    color: '#ff220044', timer: delay, maxDuration: delay, tickTimer: 999, tickRate: 999,
                    isWarning: true,
                });

                const self = this;
                setTimeout(() => {
                    for (const m of Tower.monsters) {
                        if (m.dead) continue;
                        const d = Math.sqrt((m.x - mx) ** 2 + (m.y - my) ** 2);
                        if (d < r + m.size) {
                            m.hp -= md;
                            m.flashTimer = 0.2;
                            Particles.spawnDamageNumber(m.x, m.y - m.size, md, '#ff2200');
                        }
                    }
                    Game.screenShake = 0.4;
                    Particles.spawn(mx, my, '#ff4400', 30, 200, 0.8, 6);
                    // Burn zone
                    let burnDur = skillDef.burnDuration || 4;
                    if (skill.upgraded === 'a' && skillDef.upgrades.a.burnDurationMult) burnDur *= skillDef.upgrades.a.burnDurationMult;
                    if (self.hasPassive('Wildfire')) burnDur += 3;
                    self.groundEffects.push({
                        x: mx, y: my, radius: r * 0.8,
                        damage: md * 0.15, color: '#ff4400',
                        timer: burnDur, maxDuration: burnDur, tickTimer: 0, tickRate: 0.5,
                    });
                }, delay * 1000);
            }

        } else if (skill.id === 'living_bomb') {
            if (nearest) {
                let fuseTime = skillDef.fuseTime || 3;
                if (skill.upgraded === 'b' && skillDef.upgrades.b.fuseTimeOverride) fuseTime = skillDef.upgrades.b.fuseTimeOverride;
                const spreadCount = skill.upgraded === 'a' ? (skillDef.upgrades.a.spreadCountOverride || 3) :
                    (skill.upgraded === 'b' ? 0 : (skillDef.spreadCount || 1));

                nearest.livingBomb = { timer: fuseTime, damage: dmg, radius: skillDef.explosionRadius || 80, spreadCount, player: this };
                Particles.spawn(nearest.x, nearest.y, '#ff6600', 8, 60, 0.3);
            }

        } else if (skill.id === 'life_drain') {
            if (nearest) {
                let channelDur = skillDef.channelDuration || 3;
                if (skill.upgraded === 'a' && skillDef.upgrades.a.channelDurationOverride) channelDur = skillDef.upgrades.a.channelDurationOverride;
                let healPct = skillDef.healPercent || 1.0;
                if (skill.upgraded === 'b' && skillDef.upgrades.b.healPercentOverride) healPct = skillDef.upgrades.b.healPercentOverride;
                this.channeling = {
                    skillId: skill.id,
                    timer: channelDur,
                    tickTimer: 0,
                    target: nearest,
                    dps: dmg,
                    healPercent: healPct,
                    range: skillDef.channelRange || 200,
                };
            }

        } else if (skill.id === 'raise_dead') {
            let dur = skillDef.minionDuration;
            let dmgMult = 1;
            if (skill.upgraded === 'a') { dur *= 1.6; dmgMult = 1.5; }
            const radius = skillDef.raiseRadius;

            for (let i = this.corpses.length - 1; i >= 0; i--) {
                const c = this.corpses[i];
                const d = Math.sqrt((c.x - this.x) ** 2 + (c.y - this.y) ** 2);
                if (d <= radius) {
                    const mDef = MonsterTypes[c.typeId];
                    const isBoss = mDef.boss;
                    this.minions.push({
                        x: c.x, y: c.y,
                        typeId: c.typeId,
                        boss: !!isBoss,
                        hp: isBoss ? mDef.hp * 0.4 : mDef.hp * 0.6,
                        maxHp: isBoss ? mDef.hp * 0.4 : mDef.hp * 0.6,
                        damage: (isBoss ? mDef.damage * 0.4 : mDef.damage * 0.5) * dmgMult,
                        speed: mDef.speed * 0.8, size: mDef.size,
                        color: '#33cc66',
                        name: isBoss ? `Zombie ${mDef.name}` : `Risen ${mDef.name}`,
                        timer: dur, atkTimer: 0, dead: false,
                        explodeOnDeath: skill.upgraded === 'b',
                        explosionDamage: this.attackDamage * 3,
                        targetX: 0, targetY: 0,
                    });
                    this.corpses.splice(i, 1);
                }
            }
            Particles.spawn(this.x, this.y, '#33cc66', 15, 100, 0.6, 5);
        }
    }

    takeDamage(amount) {
        // Shield absorb first (Mana Shield / Ice Barrier)
        if (this.shieldAbsorb > 0) {
            if (amount <= this.shieldAbsorb) {
                this.shieldAbsorb -= amount;
                Particles.spawn(this.x, this.y, this.shieldType === 'ice_barrier' ? '#66ddff' : '#9966ff', 3, 50);
                return;
            } else {
                amount -= this.shieldAbsorb;
                this.shieldAbsorb = 0;
                // Shield broken — explode!
                const explosionColor = this.shieldType === 'ice_barrier' ? '#44ccff' : '#aa55ff';
                let explosionRadius = 60;
                if (this.shieldType === 'ice_barrier') {
                    explosionRadius = 80;
                    if (this.shieldSkillUpgrade === 'b') explosionRadius = 120;
                    const freezeDur = this.shieldSkillUpgrade === 'b' ? 3 : 2;
                    for (const m of Tower.monsters) {
                        if (m.dead) continue;
                        const d = Math.sqrt((m.x - this.x) ** 2 + (m.y - this.y) ** 2);
                        if (d < explosionRadius) {
                            m.stunTimer = freezeDur;
                            m.frozenTint = true;
                            if (this.shieldSkillUpgrade === 'b') {
                                m.hp -= this.attackDamage * 3;
                                Particles.spawnDamageNumber(m.x, m.y - m.size, this.attackDamage * 3, '#44ccff');
                            }
                        }
                    }
                } else if (this.shieldType === 'mana_shield') {
                    const expDmg = this.maxHp * 0.25 * 1.5;
                    if (this.shieldSkillUpgrade === 'b') explosionRadius *= 2;
                    for (const m of Tower.monsters) {
                        if (m.dead) continue;
                        const d = Math.sqrt((m.x - this.x) ** 2 + (m.y - this.y) ** 2);
                        if (d < explosionRadius) {
                            m.hp -= expDmg;
                            m.flashTimer = 0.1;
                            Particles.spawnDamageNumber(m.x, m.y - m.size, expDmg, '#aa55ff');
                            if (this.shieldSkillUpgrade === 'b') m.stunTimer = 2;
                        }
                    }
                }
                Particles.spawn(this.x, this.y, explosionColor, 20, 150, 0.5);
                this.shieldType = null;
                this.skillEffect = null;
            }
        }

        if (this.blocking) {
            Particles.spawn(this.x, this.y, '#4488cc', 5, 80);
            // Aegis (Templar): heal on block
            if (this.hasPassive('Aegis') && this.aegisHealTimer <= 0) {
                this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.03);
                this.aegisHealTimer = 5;
            }
            return;
        }
        if (this.invulnTimer > 0) return;

        let dmg = amount;
        // Fortify passive (Guardian)
        if (this.hasPassive('Fortify')) dmg *= 0.85;
        // Thorns passive (Juggernaut)
        if (this.hasPassive('Thorns')) dmg *= 0.85;
        // Ice Armor passive (Ice Warden)
        if (this.hasPassive('Ice Armor')) dmg *= 0.80;
        // Last Stand passive (Sentinel) — below 30% HP, take 50% less
        if (this.hasPassive('Last Stand') && this.hp / this.maxHp < 0.3) dmg *= 0.5;
        // Stone Skin buff
        const ssBuff = this.buffs.find(b => b.id === 'stone_skin');
        if (ssBuff) dmg *= (1 - (ssBuff.damageReduction || 0.4));
        // Rally zone damage reduction
        for (const gfx of this.groundEffects) {
            if (gfx.buffZone) {
                const pd = Math.sqrt((this.x - gfx.x) ** 2 + (this.y - gfx.y) ** 2);
                if (pd < gfx.radius) dmg *= (1 - (gfx.damageReduction || 0.2));
            }
        }

        this.hp -= dmg;
        this.flashTimer = 0.15;
        this.invulnTimer = this.classData.type === 'melee' ? 0.5 : 0.25;
        Particles.spawn(this.x, this.y, '#ff0000', 5, 80);
        Particles.spawnDamageNumber(this.x, this.y - this.size - 5, dmg, '#ff4444');

        // Ice Armor: slow attacker (handled in tower.js)
        // Stone Skin: slow attacker + reflect (handled in tower.js)
    }

    draw(ctx) {
        const flash = this.flashTimer > 0;

        // Draw minions
        for (const m of this.minions) {
            ctx.globalAlpha = 0.8;

            // Try to use sprite
            const spriteKey = m.boss ? m.typeId : (m.typeId === 'slime' ? 'slime_minion' : m.typeId);
            const hasSprite = Sprites.sheets[spriteKey] && Sprites.bossFrameData[spriteKey];

            if (hasSprite) {
                // Determine facing direction toward target enemy
                let fx = m.targetX - m.x;
                let fy = m.targetY - m.y;
                const dist = Math.sqrt(fx * fx + fy * fy);
                let state = dist > 35 ? 'walk' : 'attack';
                if (dist < 1) { fx = 0; fy = 1; state = 'idle'; }

                if (m.boss) {
                    Sprites.drawBoss(ctx, spriteKey, m.x, m.y, fx, fy, state, m.size * 3.5, false);
                } else {
                    Sprites.drawMob(ctx, spriteKey, m.x, m.y, fx, fy, state, m.size * 3.5, false);
                }
                // Green outline to mark as friendly
                ctx.globalAlpha = 0.7;
                ctx.strokeStyle = '#33cc66';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#33cc66';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(m.x, m.y, m.size * 1.2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = m.color;
                ctx.beginPath();
                ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
                ctx.fill();
            }

            // HP bar
            ctx.globalAlpha = 0.8;
            const bw = m.size * 1.5;
            ctx.fillStyle = '#333';
            ctx.fillRect(m.x - bw / 2, m.y - m.size - 6, bw, 3);
            ctx.fillStyle = '#33cc66';
            ctx.fillRect(m.x - bw / 2, m.y - m.size - 6, bw * (m.hp / m.maxHp), 3);
            ctx.globalAlpha = 1;
        }

        // Draw corpses
        for (const c of this.corpses) {
            ctx.fillStyle = '#555';
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Ground effects
        for (const gfx of this.groundEffects) {
            if (gfx.isWarning) {
                // Warning circle for delayed AoE
                const p = gfx.timer / gfx.maxDuration;
                ctx.globalAlpha = 0.3 * (1 - p);
                ctx.strokeStyle = '#ff4400';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(gfx.x, gfx.y, gfx.radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
                continue;
            }
            const pulse = Math.sin(performance.now() / 150) * 0.1 + 0.9;
            if (gfx.buffZone) {
                // Rally zone — blue/green
                ctx.globalAlpha = 0.1;
                ctx.fillStyle = gfx.color || '#5599aa';
                ctx.beginPath();
                ctx.arc(gfx.x, gfx.y, gfx.radius * pulse, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 0.4;
                ctx.strokeStyle = gfx.color || '#5599aa';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(gfx.x, gfx.y, gfx.radius * pulse, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            } else if (gfx.sprite && Sprites.sheets[gfx.sprite]) {
                // Sprite-based ground effect — alternate first and last frame only
                const pfd = Sprites.projFrameData[gfx.sprite];
                const sheet = Sprites.sheets[gfx.sprite];
                const frame = Math.floor(performance.now() / 300) % 2 === 0 ? 0 : pfd.cols - 1;
                const sx = frame * pfd.colW;
                const sw = pfd.colW;
                const sh = pfd.rowHeight;
                const scale = (gfx.radius * 2.5) / sh;
                ctx.save();
                ctx.translate(gfx.x, gfx.y);
                ctx.imageSmoothingEnabled = false;
                ctx.globalAlpha = 0.9;
                ctx.drawImage(sheet, sx, pfd.rowStart, sw, sh, -sw * scale / 2, -sh * scale / 2, sw * scale, sh * scale);
                ctx.restore();
                ctx.globalAlpha = 1;
            } else {
                ctx.globalAlpha = 0.15;
                ctx.fillStyle = gfx.color;
                ctx.beginPath();
                ctx.arc(gfx.x, gfx.y, gfx.radius * pulse, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 0.25;
                ctx.fillStyle = gfx.color === '#44ccff' ? '#88ddff' : '#ff6600';
                ctx.beginPath();
                ctx.arc(gfx.x, gfx.y, gfx.radius * 0.6 * pulse, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 0.5;
                ctx.strokeStyle = gfx.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(gfx.x, gfx.y, gfx.radius * pulse, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 0.6;
                for (let i = 0; i < 5; i++) {
                    const angle = (performance.now() / 200 + i * 1.3) % (Math.PI * 2);
                    const dist = gfx.radius * (0.3 + Math.random() * 0.6);
                    const fx = gfx.x + Math.cos(angle) * dist;
                    const fy = gfx.y + Math.sin(angle) * dist;
                    const fsize = 3 + Math.random() * 4;
                    ctx.fillStyle = gfx.color === '#44ccff' ? '#88eeff' : (Math.random() > 0.5 ? '#ff4400' : '#ff8800');
                    ctx.beginPath();
                    ctx.arc(fx, fy, fsize, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            }
        }

        // Melee swing arc
        if (this.swingTimer > 0 && this.classData.type === 'melee') {
            const maxTime = this.skillEffect ? 0.3 : 0.15;
            const swingProgress = this.swingTimer / maxTime;
            const reach = (this.swingReach || this.attackRange) + 10;
            const arc = this.swingArc || Math.PI * 0.6;
            const col = this.swingColor || this.color;
            ctx.globalAlpha = swingProgress * 0.5;
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.arc(this.x, this.y, reach, this.swingAngle - arc / 2, this.swingAngle + arc / 2);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.globalAlpha = swingProgress * 0.9;
            ctx.beginPath();
            ctx.arc(this.x, this.y, reach, this.swingAngle - arc / 2, this.swingAngle + arc / 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Talon Strike visual
        if (this.talonStrike) {
            const p = Math.sin(performance.now() / 100) * 0.2 + 0.8;
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = '#ff4422';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.talonStrike.radius * p, 0, Math.PI * 2);
            ctx.stroke();
            // Rotating slash marks
            ctx.globalAlpha = 0.5;
            const t = performance.now() / 80;
            for (let i = 0; i < 6; i++) {
                const a = t + (i / 6) * Math.PI * 2;
                const r = this.talonStrike.radius * 0.8;
                ctx.strokeStyle = '#ff6644';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(this.x + Math.cos(a) * (r - 15), this.y + Math.sin(a) * (r - 15));
                ctx.lineTo(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        // Channeling beam (Life Drain)
        if (this.channeling && this.channeling.target) {
            const t = this.channeling.target;
            ctx.globalAlpha = 0.6;
            ctx.strokeStyle = '#bb66ff';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#6622aa';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(t.x, t.y);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }

        // Skill effect visuals
        if (this.skillEffect) {
            const e = this.skillEffect;
            const p = e.timer / e.maxTimer;
            if (e.type === 'slam') {
                const r = e.radius * (1 - p * 0.3);
                ctx.globalAlpha = p * 0.6;
                ctx.strokeStyle = e.color;
                ctx.lineWidth = 6 * p;
                ctx.beginPath();
                ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = p * 0.15;
                ctx.fillStyle = e.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            } else if (e.type === 'charge') {
                ctx.globalAlpha = p * 0.7;
                ctx.strokeStyle = e.color;
                ctx.lineWidth = 8 * p;
                ctx.beginPath();
                ctx.moveTo(e.startX, e.startY);
                ctx.lineTo(this.x, this.y);
                ctx.stroke();
                ctx.fillStyle = e.color;
                ctx.globalAlpha = p * 0.3;
                ctx.beginPath();
                ctx.arc(this.x, this.y, 50 * (1 - p), 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            } else if (e.type === 'war_cry') {
                const r1 = 30 + (1 - p) * 80;
                const r2 = 20 + (1 - p) * 50;
                ctx.globalAlpha = p * 0.5;
                ctx.strokeStyle = e.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(this.x, this.y, r1, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(this.x, this.y, r2, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            } else if (e.type === 'block') {
                const r = this.size + 8 + Math.sin((1 - p) * 10) * 4;
                ctx.globalAlpha = Math.min(p, 0.6);
                ctx.strokeStyle = e.color;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        }

        // Blocking visual
        if (this.blocking) {
            ctx.strokeStyle = '#4488ff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 6, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Shield absorb visual
        if (this.shieldAbsorb > 0) {
            const sColor = this.shieldType === 'ice_barrier' ? '#66ddff' : '#9966ff';
            ctx.strokeStyle = sColor;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 200) * 0.2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Sprite or shape
        const isMoving = (this.facing.x !== 0 || this.facing.y !== 0) &&
            (Input.isDown('w') || Input.isDown('a') || Input.isDown('s') || Input.isDown('d') ||
             Input.isDown('arrowup') || Input.isDown('arrowleft') || Input.isDown('arrowdown') || Input.isDown('arrowright'));
        const isAttacking = this.swingTimer > 0 || (this.skillEffect && (this.skillEffect.type === 'charge' || this.skillEffect.type === 'slam'));
        let animState = 'idle';
        if (this.hp <= 0) animState = 'death';
        else if (isAttacking) animState = this.classData.type === 'melee' ? 'attack' : 'cast';
        else if (isMoving) animState = 'walk';

        const spriteKey = this.classData.type === 'melee' ? 'melee' : 'ranged';
        const spriteDrawn = Sprites.draw(ctx, spriteKey, this.x, this.y, this.facing.x, this.facing.y, animState, 64, flash);

        if (!spriteDrawn) {
            ctx.fillStyle = flash ? '#fff' : this.color;
            if (this.classData.type === 'melee') {
                const fAngle = Math.atan2(this.facing.y, this.facing.x);
                ctx.beginPath();
                ctx.moveTo(this.x + Math.cos(fAngle) * this.size * 1.3, this.y + Math.sin(fAngle) * this.size * 1.3);
                ctx.lineTo(this.x + Math.cos(fAngle + Math.PI / 2) * this.size * 0.7, this.y + Math.sin(fAngle + Math.PI / 2) * this.size * 0.7);
                ctx.lineTo(this.x + Math.cos(fAngle + Math.PI) * this.size * 0.8, this.y + Math.sin(fAngle + Math.PI) * this.size * 0.8);
                ctx.lineTo(this.x + Math.cos(fAngle - Math.PI / 2) * this.size * 0.7, this.y + Math.sin(fAngle - Math.PI / 2) * this.size * 0.7);
                ctx.closePath();
                ctx.fill();
            } else {
                const angle = Math.atan2(this.facing.y, this.facing.x);
                ctx.beginPath();
                ctx.moveTo(this.x + Math.cos(angle) * this.size * 1.3, this.y + Math.sin(angle) * this.size * 1.3);
                ctx.lineTo(this.x + Math.cos(angle + 2.4) * this.size, this.y + Math.sin(angle + 2.4) * this.size);
                ctx.lineTo(this.x + Math.cos(angle - 2.4) * this.size, this.y + Math.sin(angle - 2.4) * this.size);
                ctx.closePath();
                ctx.fill();
            }
        }

        // Buff auras
        const hasWarCry = this.buffs.find(b => b.id === 'war_cry');
        if (hasWarCry) {
            const pulse = Math.sin(performance.now() / 100) * 0.15 + 0.85;
            const auraR = this.size + 8;
            ctx.globalAlpha = 0.4;
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#ff4444';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(this.x, this.y, auraR * pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#ff6600';
            ctx.beginPath();
            ctx.arc(this.x, this.y, auraR * pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.6;
            const t = performance.now() / 300;
            for (let i = 0; i < 4; i++) {
                const a = t + (i / 4) * Math.PI * 2;
                ctx.fillStyle = '#ffaa00';
                ctx.beginPath();
                ctx.arc(this.x + Math.cos(a) * auraR, this.y + Math.sin(a) * auraR, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        } else if (this.buffs.length > 0) {
            ctx.fillStyle = '#ffff44';
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    toSaveData() {
        return {
            className: this.className,
            classHistory: this.classHistory,
            level: this.level,
            xp: this.xp,
            hp: this.hp,
            maxHp: this.maxHp,
            attrs: { ...this.attrs },
            skills: this.skills.map(s => ({ id: s.id, upgraded: s.upgraded })),
            skillPoints: this.skillPoints,
            endlessScaling: this.endlessScaling || 0,
        };
    }

    static fromSaveData(data) {
        const p = new Player(data.classHistory[0]);
        for (let i = 1; i < data.classHistory.length; i++) {
            p.specialize(data.classHistory[i]);
        }
        p.level = data.level;
        p.xp = data.xp;
        p.xpToNext = xpForLevel(data.level + 1);
        p.attrs = { ...data.attrs };
        p.skills = data.skills.map(s => ({ id: s.id, upgraded: s.upgraded }));
        p.skillPoints = data.skillPoints;
        p.endlessScaling = data.endlessScaling || 0;
        p.recalcStats();
        p.hp = Math.min(data.hp, p.maxHp);
        return p;
    }
}
