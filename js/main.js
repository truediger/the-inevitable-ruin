// ============================================================
// MAIN GAME LOOP - The Inevitable Ruin
// ============================================================

const Game = {
    canvas: null,
    ctx: null,
    arenaW: 960,
    arenaH: 640,

    // Playable area rect (bounding box, used for spawns)
    playArea: { x: 0, y: 0, w: 960, h: 640 },
    // Play boundary polygon (normalized 0-1 coords, set per background)
    playBoundary: [],
    // Resolved pixel coords
    playBoundaryPx: [],
    playCenter: { x: 480, y: 400 },

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
            Background.init();
            Renderer3D.init(this.canvas);
            window.USE_3D = true;
            // The resize() above ran before Renderer3D existed (its resize is
            // a no-op until init) — size the 3D renderer now or it stays at
            // Three.js's default 300x150 and renders a blurry upscale
            this.resize();
            UI.init();
            Leaderboard.init();
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
        this.updatePlayBoundary(finalW, finalH);
        if (window.USE_3D) Renderer3D.resize(finalW, finalH);
    },

    // Polygon traced from the red-line boundary the user drew
    // Normalized coords (0-1) — traces the stone floor between pillars, below stairs
    PLAY_BOUNDARIES: {
        bg_crypt: [
            // Left side — just inside left pillar
            [0.15, 0.82],
            [0.15, 0.65],
            [0.20, 0.58],
            // Left of gate
            [0.27, 0.54],
            // Between gate and stairs
            [0.34, 0.50],
            [0.40, 0.47],
            // Top — below the stairs
            [0.46, 0.44],
            [0.54, 0.44],
            // Right of stairs
            [0.60, 0.47],
            [0.66, 0.50],
            // Right of gate
            [0.73, 0.54],
            // Right side — just inside right pillar
            [0.80, 0.58],
            [0.85, 0.65],
            [0.85, 0.82],
            // Bottom
            [0.75, 0.88],
            [0.50, 0.90],
            [0.25, 0.88],
        ],
    },

    updatePlayBoundary(w, h) {
        const bgKey = Background.current || 'bg_crypt';
        const norm = this.PLAY_BOUNDARIES[bgKey] || this.PLAY_BOUNDARIES.bg_crypt;
        this.playBoundaryPx = norm.map(p => ({ x: p[0] * w, y: p[1] * h }));

        // Bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of this.playBoundaryPx) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }
        this.playArea = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        this.playCenter = { x: w * 0.5, y: h * 0.62 };
    },

    newGame(classId) {
        this.player = new Player(classId);
        this.player.x = this.playCenter.x;
        this.player.y = this.playCenter.y;

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
        this.player.x = this.playCenter.x;
        this.player.y = this.playCenter.y;
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
            // Mark the save as dead so it can't be reloaded
            if (this.saveSlot >= 0) {
                const saves = SaveSystem.getAllSaves();
                if (saves[this.saveSlot]) {
                    saves[this.saveSlot].dead = true;
                    localStorage.setItem(SaveSystem.STORAGE_KEY, JSON.stringify(saves));
                }
            }
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
        // 3D rendering path
        if (window.USE_3D && Renderer3D.ready && this.state !== 'menu') {
            // Decrement screen shake
            if (this.screenShake > 0) this.screenShake -= 1/60;

            // Update background selection for skybox
            Background.setFloor(Tower.floor);

            Renderer3D.render({
                state: this.state,
                player: this.player,
                monsters: Tower.monsters,
                projectiles: Projectiles,
                particles: Particles,
                loot: Loot,
                tower: Tower,
                background: Background,
                screenShake: this.screenShake,
                arenaW: this.arenaW,
                arenaH: this.arenaH,
            });

            // Touch joystick still needs 2D overlay
            // (handled in the HUD HTML now)
            return;
        }

        // 2D fallback (menu screen)
        const ctx = this.ctx;
        if (!ctx) return;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = '#0a0a10';
        ctx.fillRect(0, 0, w, h);

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

// Start. Scripts are injected by boot.js, so the window load event
// may have already fired by the time this runs.
if (document.readyState === 'complete') {
    Game.init();
} else {
    window.addEventListener('load', () => Game.init());
}
