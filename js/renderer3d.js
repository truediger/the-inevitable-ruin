// ============================================================
// 3D RENDERER - Three.js world: real floor/walls + billboard sprites
// Requires serving over http:// (textures taint WebGL from file://)
// ============================================================

const Renderer3D = {
    scene: null,
    camera: null,
    renderer: null,
    ready: false,

    // Scale: 1 game pixel = this many world units
    SCALE: 0.05,

    WALL_HEIGHT: 5,

    // Camera: follows a point between arena center and the player.
    // 0 = locked to center, 1 = full chase cam.
    CAM_FOLLOW: 0.45,
    CAM_OFFSET: new THREE.Vector3(0, 13, 12.5),
    _camTarget: null,

    // Environment
    envGroup: null,
    envKey: '',
    torches: [],
    ambientLight: null,
    dirLight: null,

    // Entity character rigs + per-object sprite maps
    chars: new Map(),
    projSprites: new Map(),
    trapMeshes: new Map(),
    lootSprites: new Map(),
    particlePool: [],
    effectMeshes: [],

    textureCache: new Map(),
    _bbGeo: null,
    _shadowGeo: null,

    // 2D overlay: damage numbers only (everything else lives in the scene)
    overlayCanvas: null,
    overlayCtx: null,

    BIOMES: {
        bg_crypt:   { wall: 0x6b76a8, floor: 0xb8c0dd, torch: 0x7fa0ff, fog: 0x070a14, amb: 0x7788aa, dir: 0xcdd8ff,
                      stone: 0x6f7690, stoneDark: 0x474d63, glow: 0x88bbff, banner: 0x3d4a80 },
        bg_cavern:  { wall: 0x7a5a3a, floor: 0xc8a878, torch: 0xff9040, fog: 0x100a04, amb: 0x997755, dir: 0xffd9a0,
                      stone: 0x7d6448, stoneDark: 0x52412c, glow: 0x66ddcc, banner: 0x7a4a28 },
        bg_chamber: { wall: 0x7a4a48, floor: 0xc09088, torch: 0xff6045, fog: 0x120607, amb: 0x996666, dir: 0xffc0aa,
                      stone: 0x7b5c58, stoneDark: 0x50393a, glow: 0xff7744, banner: 0x8c2f2a },
        bg_temple:  { wall: 0x4a7060, floor: 0x9cc4ae, torch: 0x60ffc8, fog: 0x061210, amb: 0x77aa99, dir: 0xd0ffe8,
                      stone: 0x7f8f84, stoneDark: 0x4c5b53, glow: 0x66ffc8, banner: 0x2f7a63 },
    },

    init(existingCanvas) {
        const container = existingCanvas.parentElement;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 1), 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.domElement.id = 'threeCanvas';
        this.renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;';
        container.insertBefore(this.renderer.domElement, existingCanvas);

        // 2D canvas stays on top for damage numbers + menu fallback
        existingCanvas.style.display = 'block';
        existingCanvas.style.zIndex = '1';
        existingCanvas.style.pointerEvents = 'none';
        existingCanvas.style.background = 'transparent';
        this.overlayCanvas = existingCanvas;
        this.overlayCtx = existingCanvas.getContext('2d');

        this.scene = new THREE.Scene();
        this.scene.background = null; // panorama shows through as CSS backdrop
        this.scene.fog = new THREE.FogExp2(0x070a14, 0.011);

        this.bgContainer = container;
        container.style.backgroundSize = 'cover';
        container.style.backgroundPosition = 'center 40%';
        container.style.backgroundColor = '#080810';

        this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 500);
        this.camera.position.copy(this.CAM_OFFSET);
        this.camera.lookAt(0, 0, 0);
        this._camTarget = new THREE.Vector3(0, 0, 0);

        this.ambientLight = new THREE.AmbientLight(0x7788aa, 1.6);
        this.scene.add(this.ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
        this.dirLight.position.set(10, 30, 10);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.set(1024, 1024);
        this.dirLight.shadow.camera.left = -60;
        this.dirLight.shadow.camera.right = 60;
        this.dirLight.shadow.camera.top = 60;
        this.dirLight.shadow.camera.bottom = -60;
        this.scene.add(this.dirLight);
        this.scene.add(this.dirLight.target);

        // Shared geometry: unit plane with origin at the feet
        this._bbGeo = new THREE.PlaneGeometry(1, 1);
        this._bbGeo.translate(0, 0.5, 0);
        this._shadowGeo = new THREE.PlaneGeometry(1, 1);
        this._shadowGeo.rotateX(-Math.PI / 2);

        // Vignette overlay: restores the moody framing of the painted 2D look
        const vig = document.createElement('div');
        vig.id = 'vignette3d';
        vig.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;' +
            'background:radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 85%, rgba(0,0,0,0.7) 100%);';
        container.insertBefore(vig, existingCanvas);

        // Drifting dust motes for atmosphere
        this.motes = [];
        const moteMat = new THREE.SpriteMaterial({
            map: this.getGlowTexture(), color: 0xbbaa88,
            blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.18,
        });
        for (let i = 0; i < 40; i++) {
            const m = new THREE.Sprite(moteMat.clone());
            const s = 0.12 + (i % 5) * 0.05;
            m.scale.set(s, s, 1);
            m.userData.seed = i * 0.61;
            this.scene.add(m);
            this.motes.push(m);
        }

        // Post-processing: filmic tone mapping + bloom (orbs, torches,
        // glow weapons and boss eyes are authored emissive for this)
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.35;
        const { EffectComposer, RenderPass, UnrealBloomPass, OutputPass } = window.PostFX;
        // MSAA render target: without samples the composer path loses the
        // canvas antialiasing and the whole scene goes fuzzy
        const rtSize = this.renderer.getDrawingBufferSize(new THREE.Vector2());
        const rt = new THREE.WebGLRenderTarget(rtSize.width, rtSize.height, {
            type: THREE.HalfFloatType,
            samples: 4,
        });
        this.composer = new EffectComposer(this.renderer, rt);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.25, 1.0);
        this.composer.addPass(this.bloomPass);
        this.composer.addPass(new OutputPass());

        VFX.init(this.scene);
        this._seenExp = new Set();

        // ?dbg=1 shows live resolution/MSAA info to diagnose fuzzy rendering
        if (location.search.indexOf('dbg') !== -1) {
            const d = document.createElement('div');
            d.style.cssText = 'position:fixed;top:4px;right:4px;z-index:99;color:#7fff7f;' +
                'font:12px monospace;background:rgba(0,0,0,0.65);padding:4px 7px;pointer-events:none;';
            document.body.appendChild(d);
            this._dbg = d;
        }

        this.ready = true;
    },

    // ---- Generated textures (no external assets needed) ----

    _genTexture(key, size, drawFn) {
        if (this.textureCache.has(key)) return this.textureCache.get(key);
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        drawFn(c.getContext('2d'), size);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        this.textureCache.set(key, tex);
        return tex;
    },

    getGlowTexture() {
        return this._genTexture('glow', 64, (ctx, s) => {
            const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, s, s);
        });
    },

    getShadowTexture() {
        return this._genTexture('blobshadow', 64, (ctx, s) => {
            const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
            g.addColorStop(0, 'rgba(0,0,0,0.55)');
            g.addColorStop(0.7, 'rgba(0,0,0,0.3)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, s, s);
        });
    },

    getFlameTexture() {
        return this._genTexture('flame', 64, (ctx, s) => {
            const g = ctx.createRadialGradient(s / 2, s * 0.6, 0, s / 2, s * 0.55, s / 2);
            g.addColorStop(0, 'rgba(255,255,230,1)');
            g.addColorStop(0.3, 'rgba(255,200,90,0.9)');
            g.addColorStop(0.7, 'rgba(255,110,20,0.45)');
            g.addColorStop(1, 'rgba(255,60,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, s, s);
        });
    },

    getBrickTexture() {
        return this._genTexture('brick', 256, (ctx, s) => {
            // dark mortar base
            ctx.fillStyle = '#55555e';
            ctx.fillRect(0, 0, s, s);
            const rows = 4, bw = s / 2, bh = s / rows;
            for (let r = 0; r < rows; r++) {
                const off = (r % 2) * bw / 2;
                for (let cX = -1; cX < 3; cX++) {
                    const x = cX * bw + off;
                    const v = ((r * 7 + cX * 13) % 6);
                    const shade = 150 + v * 14;
                    ctx.fillStyle = `rgb(${shade},${shade},${shade + 8})`;
                    ctx.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
                    // bevel: light top edge, dark bottom edge
                    ctx.fillStyle = 'rgba(255,255,255,0.22)';
                    ctx.fillRect(x + 3, r * bh + 3, bw - 6, 3);
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.fillRect(x + 3, r * bh + bh - 6, bw - 6, 3);
                    // per-brick speckle
                    for (let n = 0; n < 14; n++) {
                        const nx = x + 4 + ((n * 31 + r * 17 + cX * 7) % (bw - 10));
                        const ny = r * bh + 4 + ((n * 47 + cX * 11) % (bh - 10));
                        ctx.fillStyle = n % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)';
                        ctx.fillRect(nx, ny, 3, 3);
                    }
                }
            }
        });
    },

    getStoneFloorTexture() {
        return this._genTexture('stonefloor', 512, (ctx, s) => {
            // 4x4 large flagstones per texture tile
            ctx.fillStyle = '#4a4a52';
            ctx.fillRect(0, 0, s, s);
            const n = 4, ts = s / n;
            for (let r = 0; r < n; r++) {
                for (let c = 0; c < n; c++) {
                    const v = ((r * 5 + c * 3) % 7);
                    const shade = 128 + v * 9;
                    ctx.fillStyle = `rgb(${shade},${shade},${shade + 7})`;
                    ctx.fillRect(c * ts + 3, r * ts + 3, ts - 6, ts - 6);
                    // bevel
                    ctx.fillStyle = 'rgba(255,255,255,0.15)';
                    ctx.fillRect(c * ts + 3, r * ts + 3, ts - 6, 4);
                    ctx.fillRect(c * ts + 3, r * ts + 3, 4, ts - 6);
                    ctx.fillStyle = 'rgba(0,0,0,0.25)';
                    ctx.fillRect(c * ts + 3, r * ts + ts - 7, ts - 6, 4);
                    ctx.fillRect(c * ts + ts - 7, r * ts + 3, 4, ts - 6);
                    // wear noise
                    for (let k = 0; k < 26; k++) {
                        const nx = c * ts + 6 + ((k * 37 + r * 13 + c * 29) % (ts - 14));
                        const ny = r * ts + 6 + ((k * 53 + c * 17) % (ts - 14));
                        ctx.fillStyle = k % 3 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.07)';
                        ctx.fillRect(nx, ny, 4, 4);
                    }
                    // occasional crack
                    if (v === 2 || v === 5) {
                        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(c * ts + ts * 0.2, r * ts + ts * 0.3);
                        ctx.lineTo(c * ts + ts * 0.5, r * ts + ts * 0.55);
                        ctx.lineTo(c * ts + ts * 0.45, r * ts + ts * 0.8);
                        ctx.stroke();
                    }
                }
            }
        });
    },

    // ---- Environment ----

    buildEnvironment(bgKey, arenaW, arenaH) {
        const key = `${bgKey}|${arenaW}x${arenaH}`;
        if (this.envKey === key) return;
        this.envKey = key;

        if (this.envGroup) {
            this.scene.remove(this.envGroup);
            const cached = new Set(this.textureCache.values());
            this.envGroup.traverse((o) => {
                // userData.shared marks cached geometry/materials owned elsewhere
                if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
                if (o.material && !o.material.userData.shared) {
                    if (o.material.map && !cached.has(o.material.map)) o.material.map.dispose();
                    if (o.material.dispose) o.material.dispose();
                }
            });
        }
        this.envGroup = new THREE.Group();
        this.torches = [];

        const biome = this.BIOMES[bgKey] || this.BIOMES.bg_crypt;

        this.scene.fog.color.setHex(biome.fog);
        this.ambientLight.color.setHex(biome.amb);
        this.dirLight.color.setHex(biome.dir);
        this.bgContainer.style.backgroundColor = '#' + biome.fog.toString(16).padStart(6, '0');

        // Floor: procedural flagstones, ~2.5 world units per stone
        const fw = arenaW * this.SCALE + 50;
        const fh = arenaH * this.SCALE + 50;
        const ftex = this.getStoneFloorTexture().clone();
        ftex.wrapS = ftex.wrapT = THREE.RepeatWrapping;
        ftex.repeat.set(fw / 10, fh / 10);
        ftex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        ftex.needsUpdate = true;
        const floorMat = new THREE.MeshStandardMaterial({ map: ftex, color: biome.floor, roughness: 1, metalness: 0 });
        const floorGeo = new THREE.PlaneGeometry(fw, fh);
        floorGeo.rotateX(-Math.PI / 2);
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.receiveShadow = true;
        this.envGroup.add(floor);

        // Walls along the play boundary polygon
        const poly = (Game.playBoundaryPx || []).map(p => this.toWorld(p.x, p.y, arenaW, arenaH));
        if (poly.length >= 3) {
            const brick = this.getBrickTexture();
            for (let i = 0; i < poly.length; i++) {
                const a = poly[i];
                const b = poly[(i + 1) % poly.length];
                const dx = b.x - a.x, dz = b.z - a.z;
                const len = Math.sqrt(dx * dx + dz * dz);
                if (len < 0.01) continue;

                // Per-wall texture clone so brick scale stays constant regardless of wall length
                const wtex = brick.clone();
                wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping;
                wtex.repeat.set(Math.max(1, Math.round(len / 5)), 1);
                wtex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
                wtex.needsUpdate = true;
                const wallMat = new THREE.MeshStandardMaterial({
                    color: biome.wall, roughness: 0.95, metalness: 0, map: wtex,
                });
                const geo = new THREE.BoxGeometry(len + 0.4, this.WALL_HEIGHT, 0.8);
                const wall = new THREE.Mesh(geo, wallMat);
                wall.position.set((a.x + b.x) / 2, this.WALL_HEIGHT / 2, (a.z + b.z) / 2);
                wall.rotation.y = -Math.atan2(dz, dx);
                wall.castShadow = true;
                wall.receiveShadow = true;
                this.envGroup.add(wall);

                // Lighter cap stone along the top of the wall
                const capMat = new THREE.MeshStandardMaterial({ color: biome.wall, roughness: 0.9 });
                capMat.color.multiplyScalar(1.45);
                const cap = new THREE.Mesh(new THREE.BoxGeometry(len + 0.6, 0.35, 1.1), capMat);
                cap.position.set((a.x + b.x) / 2, this.WALL_HEIGHT + 0.17, (a.z + b.z) / 2);
                cap.rotation.y = wall.rotation.y;
                cap.castShadow = true;
                this.envGroup.add(cap);

                // Pillar at each vertex
                const pillarMat = new THREE.MeshStandardMaterial({ color: biome.wall, roughness: 0.9, map: brick });
                const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, this.WALL_HEIGHT + 2.2, 8), pillarMat);
                pillar.position.set(a.x, (this.WALL_HEIGHT + 2.2) / 2, a.z);
                pillar.castShadow = true;
                this.envGroup.add(pillar);

                // Torch flame + light on some pillars
                if (i % 2 === 0) {
                    const flame = new THREE.Sprite(new THREE.SpriteMaterial({
                        map: this.getFlameTexture(),
                        color: biome.torch,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false,
                        transparent: true,
                    }));
                    flame.position.set(a.x, this.WALL_HEIGHT + 2.6, a.z);
                    flame.scale.set(1.6, 2.2, 1);
                    this.envGroup.add(flame);

                    const torch = { flame, light: null, phase: Math.random() * Math.PI * 2 };
                    // Point lights are expensive — cap them, flames alone elsewhere
                    if (this.torches.filter(t => t.light).length < 4) {
                        const light = new THREE.PointLight(biome.torch, 1.4, 26, 2);
                        light.position.set(a.x, this.WALL_HEIGHT + 2.4, a.z);
                        this.envGroup.add(light);
                        torch.light = light;
                    }
                    this.torches.push(torch);
                }
            }
        }

        // Set dressing along the walls; flames join the torch flicker loop
        if (poly.length >= 3) {
            const propFlames = Props3D.populate(this.envGroup, poly, bgKey, {
                stone: biome.stone || biome.wall,
                stoneDark: biome.stoneDark || biome.wall,
                glow: biome.glow || biome.torch,
                banner: biome.banner || biome.wall,
                torch: biome.torch,
                flameTex: this.getFlameTexture(),
                wallHeight: this.WALL_HEIGHT,
                baseScale: 1.5,
            });
            for (const f of propFlames) this.torches.push(f);
        }

        this.scene.add(this.envGroup);
    },

    resize(w, h) {
        if (!this.ready) return;
        // Browser zoom changes devicePixelRatio (zoom-out drops it below 1,
        // which would render sub-native and look fuzzy) — clamp to [1, 2]
        const pr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h);
        if (this.composer) {
            this.composer.setPixelRatio(pr);
            this.composer.setSize(w, h);
        }
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.viewW = w;
        this.viewH = h;
        if (this.overlayCanvas) {
            // Overlay at native device resolution; draw in CSS px via transform
            this.overlayCanvas.width = Math.round(w * pr);
            this.overlayCanvas.height = Math.round(h * pr);
            this.overlayCtx.setTransform(pr, 0, 0, pr, 0, 0);
        }
        // envKey includes arena size — environment rebuilds on next render
    },

    toWorld(x, y, arenaW, arenaH) {
        return new THREE.Vector3(
            (x - arenaW / 2) * this.SCALE,
            0,
            (y - arenaH / 2) * this.SCALE
        );
    },

    toScreen(worldPos, yOffset) {
        const v = worldPos.clone();
        v.y = yOffset || 0;
        v.project(this.camera);
        const w = this.viewW || this.overlayCanvas.width;
        const h = this.viewH || this.overlayCanvas.height;
        return {
            x: (v.x * 0.5 + 0.5) * w,
            y: (-v.y * 0.5 + 0.5) * h,
            z: v.z,
        };
    },

    // ---- Character rigs (procedural low-poly, see characters3d.js) ----

    // Returns { state, p } where p is 0..1 progress through an attack/cast.
    // Attacks animate on their own clock (ATTACK_MS/CAST_MS) rather than the
    // gameplay timer — a 0.15s swing timer would otherwise be a twitch.
    ATTACK_MS: 340,
    CAST_MS: 430,

    _charState(entity, isPlayer, inst, time) {
        if (isPlayer) {
            if (entity.hp <= 0) return { state: 'death', p: 0 };
            // A timer jumping up means a fresh swing started this frame
            const timer = Math.max(entity.swingTimer, entity.castTimer);
            if (timer > (inst._prevT || 0) + 1e-6) {
                inst.atkAt = time;
                inst.atkKind = entity.castTimer >= entity.swingTimer ? 'cast' : 'attack';
            }
            inst._prevT = timer;
            const dur = inst.atkKind === 'cast' ? this.CAST_MS : this.ATTACK_MS;
            const since = time - (inst.atkAt || -1e9);
            if (since < dur) return { state: inst.atkKind, p: since / dur };
            if (entity.skillEffect && (entity.skillEffect.type === 'charge' || entity.skillEffect.type === 'slam')) {
                return { state: entity.classData.type === 'melee' ? 'attack' : 'cast', p: 0.45 };
            }
            const isMoving = (entity.facing.x !== 0 || entity.facing.y !== 0) &&
                (Input.isDown('w') || Input.isDown('a') || Input.isDown('s') || Input.isDown('d') ||
                 Input.isDown('arrowup') || Input.isDown('arrowleft') || Input.isDown('arrowdown') || Input.isDown('arrowright'));
            return { state: isMoving ? 'walk' : 'idle', p: 0 };
        }
        const player = Game.player;
        if (!player) return { state: 'idle', p: 0 };
        const dx = player.x - entity.x, dy = player.y - entity.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // attackTimer resets to attackSpeed on swing, so time-since-swing is the progress
        const dur = (entity.type === 'ranged' ? this.CAST_MS : this.ATTACK_MS) / 1000;
        const since = entity.attackSpeed ? entity.attackSpeed - entity.attackTimer : 1e9;
        if (since >= 0 && since < dur) {
            return { state: entity.type === 'ranged' ? 'cast' : 'attack', p: since / dur };
        }
        return { state: dist > (entity.attackRange || 28) + 12 ? 'walk' : 'idle', p: 0 };
    },

    _renderEntity(entity, arenaW, arenaH, isPlayer) {
        let inst = this.chars.get(entity);
        const key = Characters3D.keyFor(entity, isPlayer);
        if (inst && inst.key !== key) {
            // Class specialization / type change: rebuild the rig
            this.scene.remove(inst.root);
            Characters3D.dispose(inst);
            this.chars.delete(entity);
            inst = null;
        }
        if (!inst) {
            inst = Characters3D.create(entity, isPlayer);
            this.scene.add(inst.root);
            this.chars.set(entity, inst);
        }

        const pos = this.toWorld(entity.x, entity.y, arenaW, arenaH);
        inst.root.position.set(pos.x, 0, pos.z);

        const time = performance.now();
        const act = this._charState(entity, isPlayer, inst, time);
        if (isPlayer) this._playerAct = act;

        // Hit sparks on the rising edge of the damage flash
        const flashing = entity.flashTimer > 0;
        if (flashing && !inst._wasFlash) {
            VFX.burst(pos.x, 1.6, pos.z, 6, 0xffd0a0, { speed: 4.5, size: 0.4, life: 0.3, grav: -9 });
        }
        inst._wasFlash = flashing;

        // Footstep puffs, keyed to the same walk cycle the rig animates on
        if (act.state === 'walk') {
            const step = Math.sin(time / 1000 * 11 + inst.phase) > 0 ? 1 : -1;
            if (inst._step !== undefined && step !== inst._step) {
                VFX.dust(pos.x, 0.1, pos.z, 2);
            }
            inst._step = step;
        } else {
            inst._step = undefined;
        }

        if (act.state === 'death') {
            if (!inst.deathAt) inst.deathAt = time;
        } else {
            inst.deathAt = 0;
        }

        let fx = 0, fy = 0;
        if (isPlayer) {
            fx = entity.facing.x; fy = entity.facing.y;
        } else if (Game.player) {
            fx = Game.player.x - entity.x; fy = Game.player.y - entity.y;
        }

        Characters3D.update(inst, entity, {
            state: act.state, attackP: act.p, fx, fy, time,
            flash: entity.flashTimer > 0,
            frozen: !!entity.frozenTint,
        });

        this._weaponAura(inst, act);
    },

    // Elemental aura trailing a boss weapon. The anchor rides inside the
    // weapon group, so its world position follows the full swing.
    _weaponAura(inst, act) {
        const anchor = inst.weaponFx && inst.parts.fxAnchor;
        if (!anchor) return;
        anchor.updateWorldMatrix(true, false);
        const p = anchor.getWorldPosition(this._auraV || (this._auraV = new THREE.Vector3()));
        // swinging throws off far more than idling does
        VFX.weaponAura(p.x, p.y, p.z, inst.weaponFx, act.state === 'attack');
    },

    _pruneChars(alive) {
        for (const [entity, inst] of this.chars) {
            if (alive.has(entity)) continue;
            this.scene.remove(inst.root);
            Characters3D.dispose(inst);
            this.chars.delete(entity);
        }
    },

    _pruneMap(map, alive) {
        for (const [key, obj] of map) {
            if (alive.has(key)) continue;
            const root = obj.group || obj;
            this.scene.remove(root);
            if (obj.tex) obj.tex.dispose();
            if (root.userData && root.userData.tex) root.userData.tex.dispose();
            root.traverse((o) => {
                if (o.material && o.material.dispose) o.material.dispose();
            });
            map.delete(key);
        }
    },

    // ---- Projectiles ----

    renderProjectiles3D(projectiles, arenaW, arenaH) {
        if (!projectiles) return;
        const alive = new Set();
        const time = performance.now();

        for (const p of projectiles.list) {
            alive.add(p);
            let s = this.projSprites.get(p);
            const hasSheet = p.sprite && Sprites.sheets[p.sprite] && Sprites.projFrameData[p.sprite];

            if (!s) {
                if (hasSheet) {
                    const sheet = Sprites.sheets[p.sprite];
                    const tex = new THREE.Texture(sheet);
                    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
                    tex.colorSpace = THREE.SRGBColorSpace;
                    tex.needsUpdate = true;
                    s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
                    s.userData.tex = tex;
                } else {
                    s = new THREE.Sprite(new THREE.SpriteMaterial({
                        map: this.getGlowTexture(),
                        color: new THREE.Color(p.color || '#ffffff'),
                        blending: THREE.AdditiveBlending,
                        depthWrite: false,
                        transparent: true,
                    }));
                }
                this.scene.add(s);
                this.projSprites.set(p, s);
            }

            const pos = this.toWorld(p.x, p.y, arenaW, arenaH);
            s.position.set(pos.x, 1.1, pos.z);

            if (hasSheet && s.userData.tex) {
                const fd = Sprites.projFrameData[p.sprite];
                const sheet = Sprites.sheets[p.sprite];
                const sheetW = sheet.naturalWidth || sheet.width;
                const sheetH = sheet.naturalHeight || sheet.height;
                const col = Math.floor(time / 100) % fd.cols;
                s.userData.tex.repeat.set(fd.colW / sheetW, fd.rowHeight / sheetH);
                s.userData.tex.offset.set(col * fd.colW / sheetW, 1 - (fd.rowStart + fd.rowHeight) / sheetH);
                const h = Math.max(1.0, p.size * 0.12);
                s.scale.set(h * (fd.colW / fd.rowHeight), h, 1);
                s.material.rotation = -Math.atan2(p.vy, p.vx);
            } else {
                const r = Math.max(0.6, p.size * 0.12);
                const pulse = 1 + Math.sin(time / 60) * 0.12;
                s.scale.set(r * 2.4 * pulse, r * 2.4 * pulse, 1);
            }
        }
        this._pruneMap(this.projSprites, alive);

        // Traps: pulsing spikes on the ground
        const aliveTraps = new Set();
        for (const trap of projectiles.traps) {
            aliveTraps.add(trap);
            let m = this.trapMeshes.get(trap);
            if (!m) {
                m = new THREE.Mesh(
                    new THREE.ConeGeometry(0.5, 0.9, 4),
                    new THREE.MeshBasicMaterial({ color: new THREE.Color(trap.color || '#888844'), transparent: true, opacity: 0.8 })
                );
                this.scene.add(m);
                this.trapMeshes.set(trap, m);
            }
            const pos = this.toWorld(trap.x, trap.y, arenaW, arenaH);
            const pulse = 0.85 + Math.sin(time / 250 + trap.pulseTime) * 0.15;
            m.position.set(pos.x, 0.45 * pulse, pos.z);
            m.scale.setScalar(pulse);
            m.rotation.y = time / 900;
        }
        this._pruneMap(this.trapMeshes, aliveTraps);
    },

    // ---- Loot ----

    _getImageTexture(img) {
        const key = 'img_' + img.src;
        if (this.textureCache.has(key)) return this.textureCache.get(key);
        const tex = new THREE.Texture(img);
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        this.textureCache.set(key, tex);
        return tex;
    },

    renderLoot3D(loot, arenaW, arenaH) {
        if (!loot) return;
        const alive = new Set();
        const time = performance.now() / 1000;

        const IMG_FOR = (item) => {
            if (item.type === 'potion') return { img: LootImages.healthPotion, h: 1.7 };
            if (item.type === 'heal_orb') return { img: LootImages.healOrb, h: 1.4 };
            if (item.type === 'gem') return { img: LootImages.gems[item.stat], h: 1.3 };
            if (item.type === 'gold') return { img: LootImages.gold, h: 1.0 };
            if (item.type === 'relic') return { img: LootImages.relic, h: 2.2 };
            return null;
        };

        for (const item of loot.groundItems) {
            const info = IMG_FOR(item);
            if (!info || !info.img || !info.img.complete || !info.img.naturalWidth) continue;
            alive.add(item);

            let s = this.lootSprites.get(item);
            if (!s) {
                const group = new THREE.Group();
                const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                    map: this._getImageTexture(info.img), transparent: true, depthWrite: false,
                }));
                const aspect = info.img.naturalWidth / info.img.naturalHeight;
                sprite.scale.set(info.h * aspect, info.h, 1);
                group.add(sprite);

                if (item.type === 'relic') {
                    const data = (typeof RELIC_DATA !== 'undefined') && RELIC_DATA[item.relicId];
                    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
                        map: this.getGlowTexture(),
                        color: new THREE.Color(data ? data.color : '#ffffff'),
                        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
                    }));
                    glow.scale.set(info.h * 2, info.h * 2, 1);
                    group.add(glow);
                    group.userData.glow = glow;
                }

                const shadow = new THREE.Mesh(this._shadowGeo, new THREE.MeshBasicMaterial({
                    map: this.getShadowTexture(), transparent: true, depthWrite: false, opacity: 0.6,
                }));
                shadow.scale.set(info.h * 0.7, info.h * 0.45, 1);
                shadow.position.y = 0.02;
                group.add(shadow);
                group.userData.sprite = sprite;
                group.userData.baseH = info.h;

                this.scene.add(group);
                this.lootSprites.set(item, s = group);
            }

            const pos = this.toWorld(item.x, item.y, arenaW, arenaH);
            s.position.set(pos.x, 0, pos.z);
            const bob = Math.sin(item.bobOffset) * 0.15;
            s.userData.sprite.position.y = s.userData.baseH * 0.55 + bob;
            const fade = item.timer < 3 ? item.timer / 3 : 1;
            s.userData.sprite.material.opacity = fade;
            if (s.userData.glow) {
                s.userData.glow.position.y = s.userData.sprite.position.y;
                s.userData.glow.material.opacity = (Math.sin(time * 4) * 0.3 + 0.6) * fade;
            }
        }
        this._pruneMap(this.lootSprites, alive);
    },

    // ---- MAIN RENDER ----

    render(gameState) {
        if (!this.ready) return;

        const { player, arenaW, arenaH, screenShake } = gameState;
        const time = performance.now();

        // Environment follows the current biome
        if (Background.current) {
            this.buildEnvironment(Background.current, arenaW, arenaH);
            // Panorama stays as a distant CSS backdrop above the walls
            const img = Background.images[Background.current];
            if (img && img.complete && img.naturalWidth && this._currentSkyBg !== Background.current) {
                this._currentSkyBg = Background.current;
                this.bgContainer.style.backgroundImage = `url(${img.src})`;
            }
        }

        // Torch flicker
        for (const t of this.torches) {
            const f = 0.85 + Math.sin(time / 90 + t.phase) * 0.1 + Math.sin(time / 37 + t.phase * 2) * 0.05;
            t.flame.material.opacity = f;
            t.flame.scale.y = (t.base !== undefined ? t.base : 2.2) * f;
            if (t.light) t.light.intensity = 1.4 * f;
        }

        // Dust motes drift slowly around the camera focus
        if (this.motes) {
            const ts = time / 1000;
            for (const m of this.motes) {
                const sd = m.userData.seed;
                m.position.set(
                    this._camTarget.x + Math.sin(ts * 0.11 + sd * 9) * 16,
                    1.5 + Math.sin(ts * 0.23 + sd * 5) * 2.5 + Math.sin(sd * 20) * 2,
                    this._camTarget.z + Math.cos(ts * 0.13 + sd * 7) * 11
                );
                m.material.opacity = 0.1 + (Math.sin(ts * 0.5 + sd * 13) * 0.5 + 0.5) * 0.14;
            }
        }

        // Camera: smooth follow between arena center and player
        if (player) {
            const pw = this.toWorld(player.x, player.y, arenaW, arenaH);
            const center = this.toWorld(arenaW / 2, arenaH / 2, arenaW, arenaH);
            const target = center.lerp(pw, this.CAM_FOLLOW);
            this._camTarget.lerp(target, 0.08);

            this.camera.position.copy(this._camTarget).add(this.CAM_OFFSET);
            this.camera.lookAt(this._camTarget.x, 0, this._camTarget.z);

            if (screenShake > 0) {
                this.camera.position.x += (Math.random() - 0.5) * screenShake * 2;
                this.camera.position.z += (Math.random() - 0.5) * screenShake * 2;
            }

            this.dirLight.position.set(this._camTarget.x + 10, 30, this._camTarget.z + 10);
            this.dirLight.target.position.set(this._camTarget.x, 0, this._camTarget.z);
            this.dirLight.target.updateMatrixWorld();
        }

        // Entities
        VFX.begin();
        const aliveEntities = new Set();
        if (player) {
            aliveEntities.add(player);
            this._renderEntity(player, arenaW, arenaH, true);
        }
        if (gameState.monsters) {
            for (const m of gameState.monsters) {
                if (m.dead) continue;
                aliveEntities.add(m);
                this._renderEntity(m, arenaW, arenaH, false);
            }
        }
        this._pruneChars(aliveEntities);

        this.renderLoot3D(gameState.loot, arenaW, arenaH);
        this.renderProjectiles3D(gameState.projectiles, arenaW, arenaH);

        if (player) {
            this.renderEffects(player, arenaW, arenaH, gameState.projectiles);
        }
        VFX.end();
        VFX.update(this.camera);

        this.composer.render();

        // 2D overlay: damage numbers only
        const ctx = this.overlayCtx;
        ctx.clearRect(0, 0, this.viewW || this.overlayCanvas.width, this.viewH || this.overlayCanvas.height);
        this.renderParticles(gameState.particles, arenaW, arenaH);

        if (this._dbg && (this._dbgTick = (this._dbgTick || 0) + 1) % 30 === 0) {
            const db = this.renderer.getDrawingBufferSize(new THREE.Vector2());
            this._dbg.textContent =
                `dpr ${(window.devicePixelRatio || 1).toFixed(2)} | ` +
                `buffer ${db.x}x${db.y} | css ${this.viewW}x${this.viewH} | ` +
                `screen ${Math.round(this.viewW * (window.devicePixelRatio || 1))}x${Math.round(this.viewH * (window.devicePixelRatio || 1))} | ` +
                `msaa ${this.composer.renderTarget1.samples}`;
        }
    },

    renderParticles(particles, arenaW, arenaH) {
        if (!particles) return;

        while (this.particlePool.length < particles.list.length) {
            // Soft additive billboards — faceted spheres read as debris, not sparks
            const mat = new THREE.MeshBasicMaterial({
                map: VFX._sparkTex || (VFX._sparkTex = VFX._sparkTexture()),
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            });
            const mesh = new THREE.Mesh(VFX._quad(), mat);
            mesh.visible = false;
            mesh.frustumCulled = false;
            this.scene.add(mesh);
            this.particlePool.push(mesh);
        }

        for (let i = 0; i < this.particlePool.length; i++) {
            const mesh = this.particlePool[i];
            if (i < particles.list.length) {
                const p = particles.list[i];
                const alpha = Math.max(0, p.life / p.maxLife);

                if (p.text) {
                    mesh.visible = false;
                    this.renderDamageNumber(p, arenaW, arenaH);
                } else {
                    const pos = this.toWorld(p.x, p.y, arenaW, arenaH);
                    mesh.position.set(pos.x, 0.5 + alpha * 2, pos.z);
                    mesh.material.color.set(p.color).multiplyScalar(1.8); // HDR: let it bloom
                    mesh.material.opacity = alpha * 0.9;
                    const s = Math.max(p.size * this.SCALE * (1.6 - alpha * 0.6) * 3, 0.12);
                    mesh.scale.setScalar(s);
                    mesh.quaternion.copy(this.camera.quaternion);
                    mesh.visible = true;
                }
            } else {
                mesh.visible = false;
            }
        }
    },

    renderDamageNumber(p, arenaW, arenaH) {
        const alpha = Math.max(0, p.life / p.maxLife);
        if (alpha <= 0) return;

        const worldPos = this.toWorld(p.x, p.y, arenaW, arenaH);
        const screenPos = this.toScreen(worldPos, 2.5);
        if (screenPos.z < 0 || screenPos.z > 1) return;

        const ctx = this.overlayCtx;
        const floatY = screenPos.y - (1 - alpha) * 60;

        ctx.globalAlpha = alpha;
        const fontSize = p.fontSize || 18;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText(p.text, screenPos.x, floatY);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, screenPos.x, floatY);
        ctx.globalAlpha = 1;
    },

    renderEffects(player, arenaW, arenaH, projectiles) {
        const time = performance.now() / 1000;

        // Ground effects: pulsing pool + rotating rim, not a flat disc
        for (const gfx of player.groundEffects) {
            const pos = this.toWorld(gfx.x, gfx.y, arenaW, arenaH);
            const r = gfx.radius * this.SCALE;
            const pulse = 0.85 + Math.sin(time * 4) * 0.15;
            VFX.disc(pos.x, 0.05, pos.z, r * pulse, gfx.color || '#ff4400', 0.22, 1.1);
            VFX.ring(pos.x, 0.07, pos.z, r, gfx.color || '#ff4400', 0.75, 2.2, 0.07);
            VFX.ring(pos.x, 0.09, pos.z, r * (0.55 + Math.sin(time * 2.2) * 0.06),
                gfx.color || '#ff4400', 0.35, 1.6, 0.05);
        }

        // Explosions: hot core + shockwave + scorch, shards spawned on birth
        if (projectiles) {
            for (const exp of projectiles.explosions) {
                const pos = this.toWorld(exp.x, exp.y, arenaW, arenaH);
                const k = exp.timer / exp.maxTimer;   // 1 -> 0
                const age = 1 - k;
                const R = exp.radius * this.SCALE;

                VFX.glow(pos.x, R * 0.35 + age * R * 0.3, pos.z,
                    R * (0.3 + age * 0.55), exp.color, k * k * 0.9, 2.6);
                VFX.ring(pos.x, 0.12, pos.z, R * (0.45 + age * 1.25), exp.color, k * 0.9, 2.8, 0.09);
                VFX.disc(pos.x, 0.06, pos.z, R * (0.5 + age * 0.6), exp.color, k * 0.3, 1.2);

                if (!this._seenExp.has(exp)) {
                    this._seenExp.add(exp);
                    VFX.burst(pos.x, 0.4, pos.z, 14, exp.color, { speed: R * 4.2, size: R * 0.085, life: 0.5 });
                    VFX.dust(pos.x, 0.15, pos.z, 5);
                }
            }
            // drop references to explosions that have finished
            for (const e of this._seenExp) {
                if (projectiles.explosions.indexOf(e) === -1) this._seenExp.delete(e);
            }
        }

        // Skill effects
        if (player.skillEffect) {
            const e = player.skillEffect;
            const k = e.timer / e.maxTimer;
            const pp = this.toWorld(player.x, player.y, arenaW, arenaH);

            if (e.type === 'slam') {
                const R = e.radius * this.SCALE;
                const age = 1 - k;
                VFX.ring(pp.x, 0.12, pp.z, R * (0.35 + age * 0.95), e.color, k * 0.95, 3.0, 0.12);
                VFX.ring(pp.x, 0.14, pp.z, R * (0.2 + age * 0.6), e.color, k * 0.5, 2.0, 0.06);
                VFX.disc(pp.x, 0.05, pp.z, R * (0.4 + age * 0.7), e.color, k * 0.28, 1.3);
                if (!this._slamFired) {
                    this._slamFired = true;
                    VFX.burst(pp.x, 0.3, pp.z, 18, e.color, { speed: R * 3.2, size: R * 0.07, life: 0.55, up: 1.1 });
                    VFX.dust(pp.x, 0.15, pp.z, 8);
                }
            } else if (e.type === 'charge') {
                const sp = this.toWorld(e.startX, e.startY, arenaW, arenaH);
                // Tapered trail plus a leading shock, instead of a 1px line
                VFX.beam(sp.x, 0.9, sp.z, pp.x, 0.9, pp.z, 0.5 * k, e.color, k * 0.55, 1.8);
                VFX.beam(sp.x, 0.9, sp.z, pp.x, 0.9, pp.z, 0.18 * k, e.color, k * 0.9, 3.0);
                VFX.glow(pp.x, 1.0, pp.z, 1.5, e.color, k * 0.5, 2.2);
            }
            if (e.type !== 'slam') this._slamFired = false;
        } else {
            this._slamFired = false;
        }

        // Channeling beam: bright core inside a soft sheath, with an impact flare
        if (player.channeling && player.channeling.target) {
            const t = player.channeling.target;
            const sp = this.toWorld(player.x, player.y, arenaW, arenaH);
            const ep = this.toWorld(t.x, t.y, arenaW, arenaH);
            const flick = 0.85 + Math.sin(time * 40) * 0.15;
            VFX.beam(sp.x, 2, sp.z, ep.x, 2, ep.z, 0.55 * flick, 0xbb66ff, 0.35, 1.6);
            VFX.beam(sp.x, 2, sp.z, ep.x, 2, ep.z, 0.16 * flick, 0xddaaff, 0.95, 3.2);
            VFX.glow(ep.x, 2, ep.z, 0.9 + Math.sin(time * 18) * 0.15, 0xbb66ff, 0.7, 2.6);
            if (Math.random() < 0.35) VFX.burst(ep.x, 2, ep.z, 1, 0xddaaff, { speed: 3, size: 0.35, life: 0.35, grav: -3 });
        }

        // Block: energy dome with a hot rim, not a wireframe ball
        if (player.blocking) {
            // Collision radius is far smaller than the rig, so the dome has to
            // be sized to the body or it sits around the character's ankles
            const r = Math.max((player.size + 6) * this.SCALE, 3.0);
            const pp = this.toWorld(player.x, player.y, arenaW, arenaH);
            const pulse = 1 + Math.sin(time * 9) * 0.04;
            VFX.glow(pp.x, r * 0.62, pp.z, r * pulse, 0x4488ff, 0.15, 1.5);
            VFX.glow(pp.x, r * 0.62, pp.z, r * 0.84 * pulse, 0x88bbff, 0.09, 1.2);
            VFX.ring(pp.x, 0.1, pp.z, r * pulse, 0x66aaff, 0.85, 2.6, 0.06);
        }

        // Weapon swing arc — fires on the strike phase of a melee attack
        const act = this._playerAct;
        if (act && act.state === 'attack' && act.p > 0.34 && act.p < 0.72) {
            const s = (act.p - 0.34) / 0.38;
            const pp = this.toWorld(player.x, player.y, arenaW, arenaH);
            const yaw = Math.atan2(player.facing.x, player.facing.y);
            const reach = (player.attackRange || 80) * this.SCALE * 0.85;
            // sweep the crescent across the swing so it reads as a trail
            VFX.arc(pp.x, 1.5 + s * 0.5, pp.z, yaw + (s - 0.5) * 0.8,
                reach * (0.65 + s * 0.5), player.classData.color, (1 - s) * 0.85, 3.4);
        }
    },

    cleanup() {
        VFX.clear();
        this._seenExp.clear();
        this._pruneChars(new Set());
        this._pruneMap(this.projSprites, new Set());
        this._pruneMap(this.trapMeshes, new Set());
        this._pruneMap(this.lootSprites, new Set());
        this.textureCache.clear();
    },
};
