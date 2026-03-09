// ============================================================
// MAIN GAME LOOP - The Inevitable Ruin
// ============================================================

const Game = {
    canvas: null,
    ctx: null,
    arenaW: 960,
    arenaH: 640,

    state: 'menu', // menu, playing, paused, dead
    player: null,
    saveSlot: -1,
    lastTime: 0,
    autoSaveTimer: 0,
    screenShake: 0,

    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', () => this.resize());
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => this.resize());
        }

        try {
            Input.init(this.canvas);
            Touch.init(this.canvas);
            Sprites.load();
            LootImages.init();
            UI.init();
            UI.renderSaveSlots();
        } catch (e) {
            console.error('Init error:', e);
        }

        // Skill hotkeys (1-4)
        window.addEventListener('keydown', (e) => {
            if (this.state !== 'playing') return;
            const num = parseInt(e.key);
            if (num >= 1 && num <= 4) {
                this.player.useSkill(num - 1, Tower.monsters);
            }
        });

        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    },

    resize() {
        // Use the smallest reliable measurement for actual visible area
        const vv = window.visualViewport;
        const w = vv ? Math.floor(vv.width) : window.innerWidth;
        const h = vv ? Math.floor(vv.height) : window.innerHeight;
        // Also try documentElement for iOS Safari
        const docW = document.documentElement.clientWidth;
        const docH = document.documentElement.clientHeight;
        const finalW = Math.min(w, docW);
        const finalH = Math.min(h, docH);
        this.canvas.width = finalW;
        this.canvas.height = finalH;
        this.arenaW = finalW;
        this.arenaH = finalH;
    },

    newGame(classId) {
        this.player = new Player(classId);
        this.player.x = this.arenaW / 2;
        this.player.y = this.arenaH / 2;

        this.saveSlot = SaveSystem.getNextFreeSlot();
        if (this.saveSlot === -1) this.saveSlot = 0; // overwrite first if full

        Tower.init(1);
        this.state = 'playing';
        UI.showScreen('hud');
        UI.showHud();

        Projectiles.clear();
        Particles.clear();

        this.saveGame();
    },

    loadGame(slotIndex) {
        const data = SaveSystem.load(slotIndex);
        if (!data) return;

        this.player = Player.fromSaveData(data.player);
        this.player.x = this.arenaW / 2;
        this.player.y = this.arenaH / 2;
        this.saveSlot = slotIndex;

        Tower.init(data.floor);
        Tower.wave = data.wave || 1;

        this.state = 'playing';
        UI.showScreen('hud');
        UI.showHud();

        Projectiles.clear();
        Particles.clear();
    },

    saveGame() {
        if (this.saveSlot < 0 || !this.player) return;
        SaveSystem.save(this.saveSlot, {
            player: this.player.toSaveData(),
            floor: Tower.floor,
            wave: Tower.wave,
        });
    },

    loop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05); // cap delta
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    },

    update(dt) {
        if (this.state !== 'playing') return;

        // Update player
        this.player.update(dt, this.arenaW, this.arenaH, Tower.monsters);

        // Update tower / monsters
        const towerResult = Tower.update(dt, this.player);

        // Update projectiles
        Projectiles.update(dt, Tower.monsters, this.player, this.player.minions);

        // Update loot
        Loot.update(dt, this.player);

        // Update particles
        Particles.update(dt);

        // Second Wind relic: burst heal when low
        if (this.player.hasRelic('second_wind') && !this.player.secondWindUsed &&
            this.player.hp > 0 && this.player.hp / this.player.maxHp < 0.2) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.25);
            this.player.secondWindUsed = true;
            Particles.spawn(this.player.x, this.player.y, '#44ff88', 20, 120, 0.6, 5);
            Particles.spawnDamageNumber(this.player.x, this.player.y - this.player.size, 'Second Wind!', '#44ff88');
        }

        // Check player death
        if (this.player.hp <= 0) {
            this.state = 'dead';
            UI.showGameOver(this.player, Tower.floor);
            UI.showScreen('gameOver');
            UI.hideHud();
            return;
        }

        // Floor cleared
        if (towerResult === 'floor_cleared') {
            this.handleFloorCleared();
        }

        // Check for any pending events (level-ups, specs, skills, upgrades)
        if (this.state === 'playing' && (
            this.player.pendingLevelUps.length > 0 ||
            this.player.pendingSpecs.length > 0 ||
            this.player.pendingSkillSelections.length > 0 ||
            this.player.pendingUpgrades.length > 0 ||
            this.player.pendingRelic
        )) {
            this.processNextPending();
        }

        // Auto-save every 30 seconds
        this.autoSaveTimer += dt;
        if (this.autoSaveTimer > 30) {
            this.autoSaveTimer = 0;
            this.saveGame();
        }

        // HUD
        UI.updateHud(this.player, Tower.floor, Tower.wave, Tower.totalWaves);
    },

    handleFloorCleared() {
        this.state = 'paused';
        this.saveGame();

        // Small delay then advance
        setTimeout(() => {
            Tower.nextFloor(this.player);
            this.state = 'playing';
        }, 500);
    },

    resumeAfterSpec() {
        this.player.recalcStats();
        this.player.hp = this.player.maxHp;
        // Continue processing remaining pending events
        this.processNextPending();
    },

    handleLevelUp() {
        this.state = 'paused';
        this.player.pendingLevelUps.shift();

        UI.showScreen('levelUp');
        UI.hideHud();

        UI.renderLevelUp(this.player, () => {
            this.processNextPending();
        });
    },

    handleSpecSelect() {
        this.player.pendingSpecs.shift();
        UI.renderSpecSelect(this.player);
        UI.showScreen('specSelect');
        UI.hideHud();
        // resumeAfterSpec() is called when user picks a spec
    },

    handleSkillSelect() {
        const selection = this.player.pendingSkillSelections.shift();
        UI.showScreen('skillSelect');

        UI.renderSkillSelect(this.player, selection.options, () => {
            this.processNextPending();
        });
    },

    handleSkillUpgrade() {
        this.player.pendingUpgrades.shift();
        UI.showScreen('skillUpgrade');

        UI.renderSkillUpgrade(this.player, () => {
            this.processNextPending();
        });
    },

    handleRelicChoice() {
        this.state = 'paused';
        const relicId = this.player.pendingRelic;
        this.player.pendingRelic = null;
        UI.showScreen('relicChoice');
        UI.hideHud();
        UI.renderRelicChoice(this.player, relicId, () => {
            this.processNextPending();
        });
    },

    // Central flow: process all pending events in priority order
    processNextPending() {
        const p = this.player;
        if (p.pendingLevelUps.length > 0) {
            this.handleLevelUp();
        } else if (p.pendingSpecs.length > 0) {
            this.handleSpecSelect();
        } else if (p.pendingSkillSelections.length > 0) {
            this.handleSkillSelect();
        } else if (p.pendingUpgrades.length > 0) {
            this.handleSkillUpgrade();
        } else if (p.pendingRelic) {
            this.handleRelicChoice();
        } else {
            this.resumePlay();
        }
    },

    resumePlay() {
        UI.showScreen('hud');
        UI.showHud();
        this.state = 'playing';
        this.saveGame();
    },

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Background — tile floor image or fallback
        const floorImg = Sprites.sheets.floor;
        if (floorImg && floorImg.complete && floorImg.naturalWidth > 0) {
            const floorScale = 0.4;
            const tw = floorImg.naturalWidth * floorScale;
            const th = floorImg.naturalHeight * floorScale;
            for (let ty = 0; ty < h; ty += th) {
                for (let tx = 0; tx < w; tx += tw) {
                    ctx.drawImage(floorImg, tx, ty, tw, th);
                }
            }
            // Darken the floor so loot/monsters stand out
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(0, 0, w, h);
        } else {
            ctx.fillStyle = '#0a0a10';
            ctx.fillRect(0, 0, w, h);
            // Grid fallback
            ctx.strokeStyle = '#14141e';
            ctx.lineWidth = 1;
            const gridSize = 50;
            for (let x = 0; x < w; x += gridSize) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
            }
            for (let y = 0; y < h; y += gridSize) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
            }
        }

        // Arena border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, w - 4, h - 4);

        // Screen shake
        if (this.screenShake > 0) {
            this.screenShake -= 1/60;
            const intensity = this.screenShake * 30;
            ctx.save();
            ctx.translate(
                (Math.random() - 0.5) * intensity,
                (Math.random() - 0.5) * intensity
            );
        }

        if (this.state === 'playing' || this.state === 'paused' || this.state === 'dead') {
            // Draw monsters
            Tower.draw(ctx);

            // Draw projectiles
            Projectiles.draw(ctx);

            // Loot on ground
            Loot.draw(ctx);

            // Draw player
            if (this.player) {
                this.player.draw(ctx);
            }

            // Draw particles on top
            Particles.draw(ctx);

            // Floor clear text
            if (Tower.floorCleared && this.state === 'paused') {
                ctx.textAlign = 'center';
                ctx.font = 'bold 52px monospace';
                // Dark outline/stroke for contrast
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 6;
                ctx.strokeText(`Floor ${Tower.floor} Cleared!`, w / 2, h / 2);
                // White fill with subtle warm glow
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#ffaa33';
                ctx.shadowBlur = 30;
                ctx.fillText(`Floor ${Tower.floor} Cleared!`, w / 2, h / 2);
                ctx.shadowBlur = 0;
            }
        }

        // Title screen background particles
        if (this.state === 'menu') {
            // Floating ember effect
            const time = performance.now() / 1000;
            ctx.globalAlpha = 0.3;
            for (let i = 0; i < 30; i++) {
                const x = (Math.sin(time * 0.3 + i * 2.1) * 0.5 + 0.5) * w;
                const y = (Math.cos(time * 0.2 + i * 1.7) * 0.5 + 0.5) * h;
                const size = 2 + Math.sin(time + i) * 1.5;
                ctx.fillStyle = i % 3 === 0 ? '#ff4444' : '#ff6633';
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        // End screen shake
        if (this.screenShake > 0) {
            ctx.restore();
        }

        // Touch joystick overlay (drawn in screen space, not world space)
        Touch.draw(ctx);
    },
};

// Start
window.addEventListener('load', () => Game.init());
