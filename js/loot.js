// ============================================================
// LOOT SYSTEM - The Inevitable Ruin
// ============================================================

const RELIC_DATA = {
    // Auto-Attack Modifiers
    twin_shot: {
        name: 'Twin Shot',
        description: 'Auto-attacks fire a 2nd projectile (ranged) or hit twice (melee, 50% dmg)',
        color: '#ffaa00',
        icon: 'T',
        stackable: true,
        maxStack: 2,
        category: 'attack',
    },
    chain_lightning: {
        name: 'Chain Lightning',
        description: 'Auto-attacks bounce to 1 nearby enemy for 40% damage',
        color: '#44ddff',
        icon: 'C',
        category: 'attack',
    },
    poison_tip: {
        name: 'Poison Tip',
        description: 'Auto-attacks poison enemies (3% HP/sec for 3s)',
        color: '#44cc44',
        icon: 'P',
        stackable: true,
        maxStack: 2,
        category: 'attack',
    },
    frost_touch: {
        name: 'Frost Touch',
        description: 'Auto-attacks slow enemies 30% for 1.5s',
        color: '#88ddff',
        icon: 'F',
        category: 'attack',
    },
    heavy_strikes: {
        name: 'Heavy Strikes',
        description: '+30% auto-attack damage, 20% slower attack speed',
        color: '#cc6633',
        icon: 'H',
        category: 'attack',
    },
    splinter_shot: {
        name: 'Splinter Shot',
        description: 'Ranged auto-attacks pierce through 1 extra target',
        color: '#ddaa44',
        icon: 'S',
        category: 'attack',
    },

    // Skill Modifiers
    echo_stone: {
        name: 'Echo Stone',
        description: '25% chance to reset skill cooldown on use',
        color: '#aa66ff',
        icon: 'E',
        category: 'skill',
    },
    overcharge: {
        name: 'Overcharge',
        description: 'Skills deal +40% damage but cost 10% current HP',
        color: '#ff4466',
        icon: 'O',
        category: 'skill',
    },
    widening_glyph: {
        name: 'Widening Glyph',
        description: 'All AoE skills have +50% radius',
        color: '#66aaff',
        icon: 'W',
        category: 'skill',
    },
    rapid_incantation: {
        name: 'Rapid Incantation',
        description: 'All skill cooldowns reduced by 20%',
        color: '#ffcc44',
        icon: 'R',
        category: 'skill',
    },
    spell_leech: {
        name: 'Spell Leech',
        description: 'Skill damage heals you for 5% of damage dealt',
        color: '#cc44aa',
        icon: 'L',
        category: 'skill',
    },

    // Defensive / Survival
    blood_vial: {
        name: 'Blood Vial',
        description: '30% chance on kill to drop a heal orb (5% max HP)',
        color: '#cc2222',
        icon: 'B',
        category: 'defense',
    },
    second_wind: {
        name: 'Second Wind',
        description: 'When below 20% HP, burst heal 25% (once per floor)',
        color: '#44ff88',
        icon: '2',
        category: 'defense',
    },
    thorned_armor: {
        name: 'Thorned Armor',
        description: 'Enemies that melee you take 15% damage back',
        color: '#888844',
        icon: 'A',
        category: 'defense',
    },
    phase_cloak: {
        name: 'Phase Cloak',
        description: '12% chance to dodge any attack',
        color: '#aaaadd',
        icon: 'D',
        stackable: true,
        maxStack: 2,
        category: 'defense',
    },
    ironhide: {
        name: 'Ironhide',
        description: 'Take 15% less damage from all sources',
        color: '#667788',
        icon: 'I',
        stackable: true,
        maxStack: 2,
        category: 'defense',
    },

    // Movement / Utility
    windrunner_boots: {
        name: 'Windrunner Boots',
        description: '+25% movement speed',
        color: '#44ffaa',
        icon: 'W',
        category: 'utility',
    },
    magnet_aura: {
        name: 'Magnet Aura',
        description: 'Pickup radius tripled, loot flies to you',
        color: '#ffff44',
        icon: 'M',
        category: 'utility',
    },
    war_drums: {
        name: 'War Drums',
        description: 'Minions deal +50% damage and move 30% faster',
        color: '#dd8844',
        icon: 'D',
        category: 'utility',
    },
    hunters_mark: {
        name: "Hunter's Mark",
        description: 'Damaged enemies take 8% more damage from all sources',
        color: '#ff6644',
        icon: 'X',
        category: 'utility',
    },
};

const Loot = {
    groundItems: [],
    maxRelics: 3,

    // Drop loot from a killed monster
    rollDrops(monster, player) {
        const isBoss = monster.boss;
        const drops = [];

        // Health potion
        const potionChance = isBoss ? 1.0 : 0.15;
        const potionCount = isBoss ? 3 : 1;
        for (let i = 0; i < potionCount; i++) {
            if (Math.random() < potionChance) {
                drops.push({
                    type: 'potion',
                    x: monster.x + (Math.random() - 0.5) * 30,
                    y: monster.y + (Math.random() - 0.5) * 30,
                    timer: 15,
                    bobOffset: Math.random() * Math.PI * 2,
                    magnetSpeed: 0,
                });
            }
        }

        // Stat gem
        const gemChance = isBoss ? 1.0 : 0.06;
        if (Math.random() < gemChance) {
            const stats = ['str', 'agi', 'vit', 'mnd'];
            // Weight toward class-relevant stats
            let weights;
            if (player.classData.type === 'melee') {
                weights = [35, 25, 25, 15]; // favor str
            } else {
                weights = [15, 25, 20, 40]; // favor mnd
            }
            const totalW = weights.reduce((a, b) => a + b, 0);
            let roll = Math.random() * totalW;
            let stat = 'str';
            for (let i = 0; i < stats.length; i++) {
                roll -= weights[i];
                if (roll <= 0) { stat = stats[i]; break; }
            }
            drops.push({
                type: 'gem',
                stat,
                x: monster.x + (Math.random() - 0.5) * 30,
                y: monster.y + (Math.random() - 0.5) * 30,
                timer: 20,
                bobOffset: Math.random() * Math.PI * 2,
                magnetSpeed: 0,
            });
        }

        // Gold
        if (Math.random() < 0.4 || isBoss) {
            const amount = isBoss ? Math.floor(20 + monster.xp * 0.5) : Math.floor(1 + Math.random() * 5);
            drops.push({
                type: 'gold',
                amount,
                x: monster.x + (Math.random() - 0.5) * 20,
                y: monster.y + (Math.random() - 0.5) * 20,
                timer: 15,
                bobOffset: Math.random() * Math.PI * 2,
                magnetSpeed: 0,
            });
        }

        // Relic (boss only)
        if (isBoss) {
            const relic = this.rollRelic(player);
            if (relic) {
                drops.push({
                    type: 'relic',
                    relicId: relic,
                    x: monster.x,
                    y: monster.y,
                    timer: 30, // relics last longer
                    bobOffset: 0,
                    magnetSpeed: 0,
                });
            }
        }

        for (const d of drops) {
            this.groundItems.push(d);
        }
    },

    rollRelic(player) {
        const allRelics = Object.keys(RELIC_DATA);
        // Filter out relics player already has (unless stackable and under max)
        const available = allRelics.filter(id => {
            const held = player.relics.filter(r => r.id === id);
            const data = RELIC_DATA[id];
            if (held.length === 0) return true;
            if (data.stackable && held.length < (data.maxStack || 2)) return true;
            return false;
        });
        if (available.length === 0) return null;
        return available[Math.floor(Math.random() * available.length)];
    },

    // Spawn a heal orb (from Blood Vial relic)
    spawnHealOrb(x, y, healPercent) {
        this.groundItems.push({
            type: 'heal_orb',
            healPercent,
            x: x + (Math.random() - 0.5) * 20,
            y: y + (Math.random() - 0.5) * 20,
            timer: 8,
            bobOffset: Math.random() * Math.PI * 2,
            magnetSpeed: 0,
        });
    },

    update(dt, player) {
        const pickupBase = 35;
        const hasMagnet = player.hasRelic('magnet_aura');
        const pickupRadius = hasMagnet ? pickupBase * 3 : pickupBase;
        const magnetRange = hasMagnet ? 200 : 0;

        for (let i = this.groundItems.length - 1; i >= 0; i--) {
            const item = this.groundItems[i];
            item.timer -= dt;
            item.bobOffset += dt * 3;

            // Magnet effect: items fly toward player
            if (magnetRange > 0) {
                const dx = player.x - item.x;
                const dy = player.y - item.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < magnetRange && dist > pickupRadius) {
                    item.magnetSpeed = Math.min(item.magnetSpeed + 400 * dt, 300);
                    item.x += (dx / dist) * item.magnetSpeed * dt;
                    item.y += (dy / dist) * item.magnetSpeed * dt;
                }
            }

            // Despawn
            if (item.timer <= 0) {
                this.groundItems.splice(i, 1);
                continue;
            }

            // Pickup check
            const dx = player.x - item.x;
            const dy = player.y - item.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < pickupRadius) {
                this.pickup(item, player);
                this.groundItems.splice(i, 1);
            }
        }
    },

    pickup(item, player) {
        if (item.type === 'potion') {
            const heal = player.maxHp * 0.20;
            player.hp = Math.min(player.maxHp, player.hp + heal);
            Particles.spawn(player.x, player.y, '#ff4444', 8, 60, 0.4, 3);
            Particles.spawnDamageNumber(player.x, player.y - player.size, '+' + Math.round(heal), '#44ff44');

        } else if (item.type === 'heal_orb') {
            const heal = player.maxHp * (item.healPercent || 0.05);
            player.hp = Math.min(player.maxHp, player.hp + heal);
            Particles.spawn(player.x, player.y, '#44ff44', 6, 50, 0.3, 2);

        } else if (item.type === 'gem') {
            player.attrs[item.stat] += 1;
            if (!player.gemBonuses) player.gemBonuses = { str: 0, agi: 0, vit: 0, mnd: 0 };
            player.gemBonuses[item.stat] += 1;
            player.recalcStats();
            const colors = { str: '#ff4444', agi: '#44ff44', vit: '#4488ff', mnd: '#cc44ff' };
            const names = { str: 'STR', agi: 'AGI', vit: 'VIT', mnd: 'MND' };
            Particles.spawn(player.x, player.y, colors[item.stat], 12, 80, 0.5, 4);
            Particles.spawnDamageNumber(player.x, player.y - player.size, '+1 ' + names[item.stat], colors[item.stat]);

        } else if (item.type === 'gold') {
            player.gold = (player.gold || 0) + item.amount;
            Particles.spawn(player.x, player.y, '#ffcc00', 5, 40, 0.3, 2);
            Particles.spawnDamageNumber(player.x, player.y - player.size, '+' + item.amount + 'g', '#ffcc00');

        } else if (item.type === 'relic') {
            this.handleRelicPickup(item.relicId, player);
        }
    },

    handleRelicPickup(relicId, player) {
        const data = RELIC_DATA[relicId];
        if (!data) return;

        // Check if stackable and already held
        const existing = player.relics.find(r => r.id === relicId);
        if (existing && data.stackable) {
            existing.stacks = (existing.stacks || 1) + 1;
            Particles.spawn(player.x, player.y, data.color, 15, 100, 0.6, 5);
            Particles.spawnDamageNumber(player.x, player.y - player.size, data.name + ' x' + existing.stacks, data.color);
            return;
        }

        if (player.relics.length < this.maxRelics) {
            // Room to add
            player.relics.push({ id: relicId, stacks: 1 });
            Particles.spawn(player.x, player.y, data.color, 15, 100, 0.6, 5);
            Particles.spawnDamageNumber(player.x, player.y - player.size, data.name, data.color);
        } else {
            // Need to choose — show relic choice UI
            player.pendingRelic = relicId;
        }
    },

    draw(ctx) {
        const time = performance.now() / 1000;

        for (const item of this.groundItems) {
            const bob = Math.sin(item.bobOffset) * 3;
            const fadeAlpha = item.timer < 3 ? item.timer / 3 : 1; // fade when about to despawn

            ctx.save();
            ctx.globalAlpha = fadeAlpha;

            if (item.type === 'potion') {
                // Red heart/vial shape
                const y = item.y + bob;
                ctx.fillStyle = '#ff2244';
                ctx.shadowColor = '#ff2244';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.arc(item.x, y, 10, 0, Math.PI * 2);
                ctx.fill();
                // White cross
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(item.x - 1.5, y - 5, 3, 10);
                ctx.fillRect(item.x - 5, y - 1.5, 10, 3);

            } else if (item.type === 'heal_orb') {
                const y = item.y + bob;
                ctx.fillStyle = '#44ff66';
                ctx.shadowColor = '#44ff66';
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.arc(item.x, y, 9, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

            } else if (item.type === 'gem') {
                const colors = { str: '#ff4444', agi: '#44ff44', vit: '#4488ff', mnd: '#cc44ff' };
                const color = colors[item.stat] || '#ffffff';
                const y = item.y + bob;
                // Diamond shape — larger
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 14;
                ctx.beginPath();
                ctx.moveTo(item.x, y - 12);
                ctx.lineTo(item.x + 9, y);
                ctx.lineTo(item.x, y + 12);
                ctx.lineTo(item.x - 9, y);
                ctx.closePath();
                ctx.fill();
                // Inner shine
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = fadeAlpha * 0.4;
                ctx.beginPath();
                ctx.moveTo(item.x, y - 6);
                ctx.lineTo(item.x + 4, y);
                ctx.lineTo(item.x, y + 6);
                ctx.lineTo(item.x - 4, y);
                ctx.closePath();
                ctx.fill();
                // Stat label
                ctx.globalAlpha = fadeAlpha;
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 8px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const statLabels = { str: 'S', agi: 'A', vit: 'V', mnd: 'M' };
                ctx.fillText(statLabels[item.stat] || '?', item.x, y);
                ctx.shadowBlur = 0;

            } else if (item.type === 'gold') {
                const y = item.y + bob;
                ctx.fillStyle = '#ffcc00';
                ctx.shadowColor = '#ffcc00';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(item.x, y, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                // $ symbol
                ctx.fillStyle = '#aa8800';
                ctx.font = 'bold 8px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('$', item.x, y);

            } else if (item.type === 'relic') {
                const data = RELIC_DATA[item.relicId];
                const color = data ? data.color : '#ffffff';
                const y = item.y + bob * 1.5;
                // Glowing pentagon
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 20;
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
                    const px = item.x + Math.cos(a) * 14;
                    const py = y + Math.sin(a) * 14;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                // Pulsing outer ring
                const pulse = Math.sin(time * 4) * 0.3 + 0.7;
                ctx.globalAlpha = fadeAlpha * pulse;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(item.x, y, 18, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
                // Icon letter
                ctx.globalAlpha = fadeAlpha;
                ctx.fillStyle = '#000';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(data ? data.icon : '?', item.x, y);
            }

            ctx.restore();
        }
        ctx.shadowBlur = 0;
    },

    clear() {
        this.groundItems = [];
    },
};
