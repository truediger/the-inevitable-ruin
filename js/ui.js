// ============================================================
// UI MANAGER - The Inevitable Ruin
// ============================================================

const UI = {
    screens: {},

    init() {
        this.screens = {
            mainMenu: document.getElementById('main-menu'),
            classSelect: document.getElementById('class-select'),
            specSelect: document.getElementById('spec-select'),
            levelUp: document.getElementById('level-up-screen'),
            skillSelect: document.getElementById('skill-select-screen'),
            skillUpgrade: document.getElementById('skill-upgrade-screen'),
            gameOver: document.getElementById('game-over-screen'),
            relicChoice: document.getElementById('relic-choice-screen'),
            hud: document.getElementById('hud'),
        };

        document.getElementById('btn-new-game').addEventListener('click', () => {
            this.showScreen('classSelect');
            this.renderClassSelect();
        });

        document.getElementById('btn-back-menu').addEventListener('click', () => {
            this.showScreen('mainMenu');
            this.renderSaveSlots();
        });

        document.getElementById('btn-restart').addEventListener('click', () => {
            Game.state = 'menu';
            this.showScreen('mainMenu');
            this.renderSaveSlots();
        });
    },

    showScreen(name) {
        for (const key in this.screens) {
            this.screens[key].classList.remove('active');
            if (key !== 'hud') this.screens[key].style.display = 'none';
        }
        if (name === 'hud') {
            this.screens.hud.classList.remove('hidden');
        } else if (name && this.screens[name]) {
            this.screens[name].style.display = 'flex';
            this.screens[name].classList.add('active');
        }
    },

    showHud() {
        this.screens.hud.classList.remove('hidden');
    },

    hideHud() {
        this.screens.hud.classList.add('hidden');
    },

    renderSaveSlots() {
        const container = document.getElementById('save-slots');
        container.innerHTML = '';
        const saves = SaveSystem.getAllSaves();

        for (let i = 0; i < saves.length; i++) {
            const save = saves[i];
            if (!save) continue;

            const className = save.player.classHistory[save.player.classHistory.length - 1];
            const cls = CLASS_DATA[className];

            // Skip saves with classes that no longer exist
            if (!cls) {
                SaveSystem.deleteSave(i);
                continue;
            }

            const slot = document.createElement('div');
            slot.className = 'save-slot';

            slot.innerHTML = `
                <div class="slot-info">
                    <div class="slot-name" style="color:${cls.color}">${cls.name} - Lv.${save.player.level}</div>
                    <div class="slot-details">Floor ${save.floor} | ${new Date(save.timestamp).toLocaleDateString()}</div>
                </div>
            `;

            const loadBtn = document.createElement('button');
            loadBtn.className = 'menu-btn small';
            loadBtn.textContent = 'Load';
            loadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                Game.loadGame(i);
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-save';
            delBtn.textContent = 'X';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                SaveSystem.deleteSave(i);
                this.renderSaveSlots();
            });

            slot.appendChild(loadBtn);
            slot.appendChild(delBtn);
            container.appendChild(slot);
        }
    },

    renderClassSelect() {
        const container = document.getElementById('class-choices');
        container.innerHTML = '';

        const starters = ['brawler', 'mage'];
        for (const id of starters) {
            const cls = CLASS_DATA[id];
            const card = document.createElement('div');
            card.className = 'class-card';
            card.innerHTML = `
                <h3 style="color:${cls.color}">${cls.name}</h3>
                <div class="class-type">${cls.type}</div>
                <p>${cls.description}</p>
                <div class="class-stats">
                    STR ${cls.baseStats.str} | AGI ${cls.baseStats.agi} | VIT ${cls.baseStats.vit} | MND ${cls.baseStats.mnd}
                </div>
            `;
            card.addEventListener('click', () => {
                Game.newGame(id);
            });
            container.appendChild(card);
        }
    },

    renderSpecSelect(player) {
        const container = document.getElementById('spec-choices');
        container.innerHTML = '';
        document.getElementById('spec-flavor').textContent =
            `Your ${player.classData.name} has grown powerful. Choose your specialization.`;

        for (const specId of player.classData.specOptions) {
            const cls = CLASS_DATA[specId];
            const card = document.createElement('div');
            card.className = 'class-card';

            // Show free skill info
            let freeSkillHtml = '';
            if (cls.freeSkill && SKILL_DATA[cls.freeSkill]) {
                const fs = SKILL_DATA[cls.freeSkill];
                freeSkillHtml = `<p style="color:#6cf;margin-top:6px;font-size:0.82rem">Free Skill: <strong>${fs.name}</strong> — ${fs.description}</p>`;
            }

            // Show auto-attack change
            let autoHtml = '';
            if (cls.autoAttack && cls.autoAttack !== player.classData.autoAttack) {
                const aa = SKILL_DATA[cls.autoAttack];
                if (aa) autoHtml = `<p style="color:#aaf;margin-top:4px;font-size:0.82rem">Auto-Attack: <strong>${aa.name}</strong> — ${aa.description}</p>`;
            }

            card.innerHTML = `
                <h3 style="color:${cls.color}">${cls.name}</h3>
                <div class="class-type">Tier ${cls.tier} ${cls.type}</div>
                <p>${cls.description}</p>
                <p style="color:#ff6;margin-top:8px;font-size:0.85rem">${cls.passive || ''}</p>
                ${freeSkillHtml}
                ${autoHtml}
                <div class="class-stats">
                    STR ${cls.baseStats.str} | AGI ${cls.baseStats.agi} | VIT ${cls.baseStats.vit} | MND ${cls.baseStats.mnd}
                </div>
            `;
            card.addEventListener('click', () => {
                player.specialize(specId);
                Game.resumeAfterSpec();
            });
            container.appendChild(card);
        }
    },

    renderLevelUp(player, onContinue) {
        const content = document.getElementById('level-up-content');
        let pointsLeft = player.skillPoints;
        const tempAttrs = { ...player.attrs };

        const render = () => {
            const gems = player.gemBonuses || { str: 0, agi: 0, vit: 0, mnd: 0 };

            content.innerHTML = `
                <p style="color:#ff6;font-size:1.3rem;margin-bottom:4px">Level ${player.level}!</p>
                <div id="points-remaining">Skill Points: ${pointsLeft}</div>
            `;

            const attrs = ['str', 'agi', 'vit', 'mnd'];
            const names = { str: 'Strength', agi: 'Agility', vit: 'Vitality', mnd: 'Mind' };
            const descs = {
                str: 'Physical damage',
                agi: 'Attack speed, move speed, crit chance',
                vit: 'Max HP',
                mnd: 'Spell damage',
            };
            const gemColors = { str: '#ff4444', agi: '#44ff44', vit: '#4488ff', mnd: '#cc44ff' };

            for (const attr of attrs) {
                const gemBonus = gems[attr] || 0;
                const gemTag = gemBonus > 0 ? `<span class="gem-bonus" style="color:${gemColors[attr]}"><span class="gem-diamond" style="border-bottom-color:${gemColors[attr]}"></span>+${gemBonus}</span>` : '';
                const row = document.createElement('div');
                row.className = 'attr-row';
                row.innerHTML = `
                    <span class="attr-name">${names[attr]}<span class="attr-desc">${descs[attr]}</span></span>
                    <button class="attr-minus" data-attr="${attr}">-</button>
                    <span class="attr-val">${tempAttrs[attr]} ${gemTag}</span>
                    <button class="attr-plus" data-attr="${attr}">+</button>
                `;
                content.appendChild(row);
            }

            // Relics display below stats
            if (player.relics.length > 0) {
                const relicSection = document.createElement('div');
                relicSection.className = 'levelup-relics';
                relicSection.innerHTML = '<div class="levelup-relics-label">Relics</div>';
                const relicRow = document.createElement('div');
                relicRow.className = 'levelup-relics-row';
                for (const r of player.relics) {
                    const data = RELIC_DATA[r.id];
                    if (!data) continue;
                    const stackText = r.stacks > 1 ? ` x${r.stacks}` : '';
                    const el = document.createElement('div');
                    el.className = 'levelup-relic';
                    el.style.borderColor = data.color;
                    el.innerHTML = `<span class="levelup-relic-icon" style="background:${data.color}">${data.icon}</span>`;
                    el.title = `${data.name}${stackText}: ${data.description}`;
                    relicRow.appendChild(el);
                }
                relicSection.appendChild(relicRow);
                content.appendChild(relicSection);
            }

            // Wire buttons
            content.querySelectorAll('.attr-plus').forEach(btn => {
                btn.disabled = pointsLeft <= 0;
                btn.addEventListener('click', () => {
                    if (pointsLeft <= 0) return;
                    tempAttrs[btn.dataset.attr]++;
                    pointsLeft--;
                    render();
                });
            });

            content.querySelectorAll('.attr-minus').forEach(btn => {
                const attr = btn.dataset.attr;
                btn.disabled = tempAttrs[attr] <= player.attrs[attr] - (player.skillPoints - pointsLeft);
                // Only allow removing points added this session
                const originalVal = player.attrs[attr];
                btn.disabled = tempAttrs[attr] <= originalVal;
                btn.addEventListener('click', () => {
                    if (tempAttrs[attr] <= originalVal) return;
                    tempAttrs[attr]--;
                    pointsLeft++;
                    render();
                });
            });
        };

        render();

        const continueBtn = document.getElementById('btn-continue-levelup');
        const newContinueBtn = continueBtn.cloneNode(true);
        continueBtn.parentNode.replaceChild(newContinueBtn, continueBtn);
        newContinueBtn.addEventListener('click', () => {
            player.attrs = { ...tempAttrs };
            player.skillPoints = pointsLeft;
            player.recalcStats();
            // Don't overheal but heal proportionally
            player.hp = Math.min(player.hp + 20, player.maxHp);
            onContinue();
        });
    },

    renderSkillSelect(player, options, onSelect) {
        const container = document.getElementById('skill-choices');
        container.innerHTML = '';

        for (const skillId of options) {
            // Skip if player already has this skill
            if (player.skills.find(s => s.id === skillId)) continue;

            const def = SKILL_DATA[skillId];
            if (!def) continue;

            const card = document.createElement('div');
            card.className = 'skill-card';
            card.innerHTML = `
                <h3>${def.name}</h3>
                <p>${def.description}</p>
                <div class="skill-type">Cooldown: ${def.cooldown}s</div>
            `;
            card.addEventListener('click', () => {
                player.addSkill(skillId);
                onSelect();
            });
            container.appendChild(card);
        }

        // If all skills already owned, skip
        if (container.children.length === 0) {
            onSelect();
        }
    },

    renderSkillUpgrade(player, onSelect) {
        const container = document.getElementById('upgrade-choices');
        container.innerHTML = '';

        const upgradeable = player.skills.filter(s => {
            const def = SKILL_DATA[s.id];
            return def && def.type === 'active' && !s.upgraded && def.upgrades;
        });

        if (upgradeable.length === 0) {
            onSelect();
            return;
        }

        // Step 1: Pick which skill to upgrade
        const header = document.getElementById('skill-upgrade-screen').querySelector('h2');
        header.textContent = 'Choose a Skill to Upgrade';

        for (const skill of upgradeable) {
            const def = SKILL_DATA[skill.id];
            const card = document.createElement('div');
            card.className = 'skill-card';
            card.innerHTML = `
                <h3>${def.name}</h3>
                <p>${def.description}</p>
                <div class="skill-type">Cooldown: ${def.cooldown}s</div>
            `;
            card.addEventListener('click', () => {
                // Step 2: Pick upgrade path A or B
                this.renderUpgradePaths(player, skill, def, onSelect);
            });
            container.appendChild(card);
        }
    },

    renderUpgradePaths(player, skill, def, onSelect) {
        const container = document.getElementById('upgrade-choices');
        container.innerHTML = '';
        const header = document.getElementById('skill-upgrade-screen').querySelector('h2');
        header.textContent = `Upgrade ${def.name}`;

        for (const path of ['a', 'b']) {
            const upg = def.upgrades[path];
            if (!upg) continue;

            const card = document.createElement('div');
            card.className = 'skill-card';
            card.innerHTML = `
                <h3>${upg.name}</h3>
                <p>${upg.description}</p>
            `;
            card.addEventListener('click', () => {
                player.upgradeSkill(skill.id, path);
                onSelect();
            });
            container.appendChild(card);
        }
    },

    updateHud(player, floor, wave, totalWaves) {
        const cls = player.classData;
        document.getElementById('hud-class').textContent = cls.name;
        document.getElementById('hud-class').style.color = cls.color;
        document.getElementById('hud-floor').textContent = `Floor ${floor}`;
        document.getElementById('hud-wave').textContent = `Wave ${wave}/${totalWaves}`;

        // HP
        const hpPct = Math.max(0, (player.hp / player.maxHp) * 100);
        document.getElementById('hp-bar').style.width = hpPct + '%';
        document.getElementById('hp-text').textContent =
            `${Math.ceil(player.hp)} / ${player.maxHp}`;

        // XP
        const xpPct = (player.xp / player.xpToNext) * 100;
        document.getElementById('xp-bar').style.width = xpPct + '%';
        document.getElementById('xp-text').textContent =
            `Lv.${player.level} - ${player.xp} / ${player.xpToNext} XP`;

        // Stats
        document.getElementById('stat-level').textContent = `Lv ${player.level}`;
        document.getElementById('stat-str').textContent = `STR ${player.attrs.str}`;
        document.getElementById('stat-agi').textContent = `AGI ${player.attrs.agi}`;
        document.getElementById('stat-vit').textContent = `VIT ${player.attrs.vit}`;
        document.getElementById('stat-mnd').textContent = `MND ${player.attrs.mnd}`;

        // Relics
        const relicContainer = document.getElementById('hud-relics');
        if (relicContainer) {
            let relicHtml = '';
            if (player.gold > 0) {
                relicHtml += `<span class="hud-gold">${player.gold}g</span>`;
            }
            for (const r of player.relics) {
                const data = RELIC_DATA[r.id];
                if (!data) continue;
                const stackText = r.stacks > 1 ? ` x${r.stacks}` : '';
                relicHtml += `<span class="hud-relic" style="background:${data.color}" title="${data.name}${stackText}: ${data.description}">${data.icon}</span>`;
            }
            relicContainer.innerHTML = relicHtml;
        }

        // Skills
        this.updateSkillSlots(player);
    },

    updateSkillSlots(player) {
        const container = document.getElementById('hud-skills');
        const active = player.getActiveSkills();

        // Only rebuild if count changed
        if (container.children.length !== active.length) {
            container.innerHTML = '';
            for (let i = 0; i < active.length; i++) {
                const slot = document.createElement('div');
                slot.className = 'skill-slot';
                slot.id = `skill-slot-${i}`;
                slot.innerHTML = `
                    <span class="skill-key">${i + 1}</span>
                    <span class="skill-icon"></span>
                    <span class="cooldown-overlay"></span>
                `;

                // Click to use skill
                const idx = i;
                slot.addEventListener('click', () => {
                    if (Game.state === 'playing' && Game.player) {
                        Game.player.useSkill(idx, Tower.monsters);
                    }
                });

                // Tooltip on hover
                slot.addEventListener('mouseenter', (e) => {
                    this.showSkillTooltip(player, idx, e);
                });
                slot.addEventListener('mouseleave', () => {
                    this.hideSkillTooltip();
                });

                container.appendChild(slot);
            }
        }

        for (let i = 0; i < active.length; i++) {
            const skill = active[i];
            const def = SKILL_DATA[skill.id];
            const slot = document.getElementById(`skill-slot-${i}`);
            if (!slot) continue;

            const cd = player.skillCooldowns[skill.id] || 0;
            const icon = slot.querySelector('.skill-icon');
            const overlay = slot.querySelector('.cooldown-overlay');

            let name = def.name;
            if (skill.upgraded && def.upgrades[skill.upgraded]) {
                name = def.upgrades[skill.upgraded].name;
            }
            if (def.art) {
                if (!icon.dataset.art || icon.dataset.art !== def.art) {
                    icon.dataset.art = def.art;
                    icon.innerHTML = `<img src="${def.art}" style="width:110%;height:110%;object-fit:cover;border-radius:4px;pointer-events:none;position:relative;left:-5%;top:-5%;">`;
                }
            } else if (!icon.dataset.set) {
                icon.dataset.set = '1';
                icon.textContent = def.icon || name[0];
            }
            slot.style.borderColor = cd > 0 ? '#666' : (def.color || '#44aaff');

            if (cd > 0) {
                overlay.textContent = cd.toFixed(1);
                overlay.style.height = `${(cd / def.cooldown) * 100}%`;
                slot.classList.add('on-cooldown');
                slot.classList.remove('ready');
            } else {
                overlay.textContent = '';
                overlay.style.height = '0%';
                slot.classList.remove('on-cooldown');
                slot.classList.add('ready');
            }
        }
    },

    showSkillTooltip(player, skillIndex, event) {
        const active = player.getActiveSkills();
        if (skillIndex >= active.length) return;

        const skill = active[skillIndex];
        const def = SKILL_DATA[skill.id];
        if (!def) return;

        let name = def.name;
        let desc = def.description || '';
        if (skill.upgraded && def.upgrades && def.upgrades[skill.upgraded]) {
            const upg = def.upgrades[skill.upgraded];
            name = upg.name;
            desc = upg.description || desc;
        }

        const cd = def.cooldown || 0;
        const dmg = def.damageMulti ? `${def.damageMulti}x damage` : '';

        let tooltip = document.getElementById('skill-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'skill-tooltip';
            document.body.appendChild(tooltip);
        }

        let html = `<div class="tt-name">${name}</div>`;
        if (desc) html += `<div class="tt-desc">${desc}</div>`;
        const details = [];
        if (cd) details.push(`CD: ${cd}s`);
        if (dmg) details.push(dmg);
        details.push(`Key: ${skillIndex + 1}`);
        html += `<div class="tt-stats">${details.join(' | ')}</div>`;

        tooltip.innerHTML = html;
        tooltip.style.display = 'block';

        // Position above the skill slot
        const slot = event.currentTarget;
        const rect = slot.getBoundingClientRect();
        tooltip.style.left = rect.left + rect.width / 2 + 'px';
        tooltip.style.top = rect.top - 8 + 'px';
    },

    hideSkillTooltip() {
        const tooltip = document.getElementById('skill-tooltip');
        if (tooltip) tooltip.style.display = 'none';
    },

    showGameOver(player, floor) {
        document.getElementById('game-over-stats').innerHTML = `
            Class: ${player.classData.name}<br>
            Level: ${player.level}<br>
            Floor Reached: ${floor}<br>
            Gold: ${player.gold || 0}<br>
            Relics: ${player.relics.map(r => RELIC_DATA[r.id].name).join(', ') || 'None'}
        `;
    },

    renderRelicChoice(player, newRelicId, onDone) {
        const newData = RELIC_DATA[newRelicId];

        // Show the new relic
        const newContainer = document.getElementById('relic-new');
        newContainer.innerHTML = `
            <div class="relic-card new-relic" style="border-color: ${newData.color}">
                <div class="relic-icon" style="background: ${newData.color}">${newData.icon}</div>
                <h3 style="color: ${newData.color}">${newData.name}</h3>
                <p>${newData.description}</p>
                <span class="relic-label">NEW</span>
            </div>
        `;

        // Show current relics with replace buttons
        const currentContainer = document.getElementById('relic-current');
        currentContainer.innerHTML = '<h3 style="margin: 10px 0 6px; color: #aaa;">Your Relics:</h3>';
        player.relics.forEach((relic, idx) => {
            const data = RELIC_DATA[relic.id];
            const card = document.createElement('div');
            card.className = 'relic-card current-relic';
            card.style.borderColor = data.color;
            card.innerHTML = `
                <div class="relic-icon" style="background: ${data.color}">${data.icon}</div>
                <div>
                    <h3 style="color: ${data.color}">${data.name}${relic.stacks > 1 ? ' x' + relic.stacks : ''}</h3>
                    <p>${data.description}</p>
                </div>
                <button class="menu-btn small replace-btn">Replace</button>
            `;
            card.querySelector('.replace-btn').addEventListener('click', () => {
                player.relics[idx] = { id: newRelicId, stacks: 1 };
                Particles.spawn(player.x, player.y, newData.color, 15, 100, 0.6, 5);
                onDone();
            });
            currentContainer.appendChild(card);
        });

        // Discard button
        const discardBtn = document.getElementById('btn-discard-relic');
        const newDiscardBtn = discardBtn.cloneNode(true);
        discardBtn.parentNode.replaceChild(newDiscardBtn, discardBtn);
        newDiscardBtn.addEventListener('click', () => {
            onDone();
        });
    },
};
