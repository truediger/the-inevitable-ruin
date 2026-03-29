// ============================================================
// 3D RENDERER - Three.js Billboard Sprite System
// ============================================================

const Renderer3D = {
    scene: null,
    camera: null,
    renderer: null,
    ready: false,

    // Scale: 1 game pixel = this many world units
    // Arena ~1500x800px -> 75x40 world units
    SCALE: 0.05,

    // Sprite management
    playerMesh: null,
    monsterMeshes: new Map(),
    projectileMeshes: new Map(),
    particlePool: [],
    lootMeshes: new Map(),
    effectMeshes: [],
    damageNumberPool: [],

    // Environment
    groundMesh: null,
    skyMesh: null,
    ambientLight: null,
    dirLight: null,

    // Texture cache
    textureCache: new Map(),

    // Camera
    camTarget: null,
    camOffset: new THREE.Vector3(0, 18, 14),

    // 2D overlay canvas for sprites (avoids WebGL CORS issues with file://)
    overlayCanvas: null,
    overlayCtx: null,

    init(existingCanvas) {
        const container = existingCanvas.parentElement;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.domElement.id = 'threeCanvas';
        this.renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;';
        container.insertBefore(this.renderer.domElement, existingCanvas);

        // Keep the 2D canvas as a transparent overlay for sprite rendering
        existingCanvas.style.display = 'block';
        existingCanvas.style.zIndex = '1';
        existingCanvas.style.pointerEvents = 'none';
        existingCanvas.style.background = 'transparent';
        this.overlayCanvas = existingCanvas;
        this.overlayCtx = existingCanvas.getContext('2d');

        this.scene = new THREE.Scene();
        this.scene.background = null; // transparent — CSS background shows through
        this.scene.fog = new THREE.FogExp2(0x080810, 0.006);

        // Container holds the panorama as CSS background
        this.bgContainer = container;
        container.style.backgroundSize = 'cover';
        container.style.backgroundPosition = 'center 40%';
        container.style.backgroundColor = '#080810';

        // Camera
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
        this.camera.position.set(0, this.camOffset.y, this.camOffset.z);
        this.camera.lookAt(0, 0, 0);
        this.camTarget = new THREE.Vector3(0, 0, 0);

        // Lighting
        this.ambientLight = new THREE.AmbientLight(0x667788, 1.2);
        this.scene.add(this.ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xffeedd, 1.0);
        this.dirLight.position.set(10, 30, 10);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.set(1024, 1024);
        this.dirLight.shadow.camera.left = -50;
        this.dirLight.shadow.camera.right = 50;
        this.dirLight.shadow.camera.top = 50;
        this.dirLight.shadow.camera.bottom = -50;
        this.scene.add(this.dirLight);
        this.scene.add(this.dirLight.target);

        // Center glow
        const pointLight = new THREE.PointLight(0x4488cc, 2, 30);
        pointLight.position.set(0, 2, 0);
        this.scene.add(pointLight);

        this.createGround();
        this.createSkybox();

        this.ready = true;
    },

    createGround() {
        // No visible ground — the CSS panorama IS the floor
        // Just a shadow-receiving plane (invisible but catches shadows)
        const geo = new THREE.CircleGeometry(45, 64);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.ShadowMaterial({ opacity: 0.3 });
        this.groundMesh = new THREE.Mesh(geo, mat);
        this.groundMesh.receiveShadow = true;
        this.groundMesh.position.y = -0.05;
        this.scene.add(this.groundMesh);
    },

    createSkybox() {
        // CSS-based background, no WebGL needed
    },

    setSkyboxTexture(bgKey) {
        if (!Background.images || !Background.images[bgKey]) return;
        const img = Background.images[bgKey];
        if (!img.complete || img.naturalWidth === 0) return;
        if (this._currentSkyBg === bgKey) return;
        this._currentSkyBg = bgKey;

        // Use CSS background — no CORS issues with file://
        this.bgContainer.style.backgroundImage = `url(${img.src})`;
    },

    resize(w, h) {
        if (!this.ready) return;
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        if (this.overlayCanvas) {
            this.overlayCanvas.width = w;
            this.overlayCanvas.height = h;
        }
    },

    toWorld(x, y, arenaW, arenaH) {
        return new THREE.Vector3(
            (x - arenaW / 2) * this.SCALE,
            0,
            (y - arenaH / 2) * this.SCALE
        );
    },

    // Project a 3D world position to 2D screen coordinates
    toScreen(worldPos, yOffset) {
        const v = worldPos.clone();
        v.y = yOffset || 0;
        v.project(this.camera);
        const w = this.overlayCanvas.width;
        const h = this.overlayCanvas.height;
        return {
            x: (v.x * 0.5 + 0.5) * w,
            y: (-v.y * 0.5 + 0.5) * h,
            z: v.z, // depth for sorting
        };
    },

    // Get approximate pixel scale at a world position (for sizing sprites)
    getScreenScale(worldPos) {
        const dist = this.camera.position.distanceTo(worldPos);
        const fovRad = this.camera.fov * Math.PI / 180;
        const screenH = this.overlayCanvas.height;
        // Pixels per world unit at this distance
        return screenH / (2 * dist * Math.tan(fovRad / 2));
    },

    createSprite() {
        const mat = new THREE.SpriteMaterial({
            transparent: true,
            alphaTest: 0.01,
        });
        const sprite = new THREE.Sprite(mat);
        return sprite;
    },

    // Get a base texture from a sprite sheet Image (no canvas = no CORS issues)
    getSheetTexture(sheet) {
        const key = 'sheet_' + sheet.src;
        if (this.textureCache.has(key)) return this.textureCache.get(key);

        const tex = new THREE.Texture(sheet);
        tex.needsUpdate = true;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        this.textureCache.set(key, tex);
        return tex;
    },

    updateSprite(sprite, sheet, sx, sy, sw, sh, flip, worldH, pos3d) {
        if (!sheet || sw <= 0 || sh <= 0) return;
        const sheetW = sheet.naturalWidth || sheet.width;
        const sheetH = sheet.naturalHeight || sheet.height;
        if (!sheetW || !sheetH) return;

        // Each sprite needs its own texture (not a clone) for independent UV
        if (!sprite.userData.tex || sprite.userData.sheetSrc !== sheet.src) {
            const tex = new THREE.Texture(sheet);
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.needsUpdate = true;
            sprite.userData.tex = tex;
            sprite.userData.sheetSrc = sheet.src;
            sprite.material.map = tex;
        }

        const tex = sprite.userData.tex;
        tex.repeat.set(sw / sheetW, sh / sheetH);
        tex.offset.set(sx / sheetW, 1.0 - (sy + sh) / sheetH);

        const aspect = sw / sh;
        const w = worldH * aspect;

        sprite.position.set(pos3d.x, worldH / 2, pos3d.z);
        sprite.scale.set(flip ? -w : w, worldH, 1);
    },

    // ---- Animation frame helpers (replicate Sprites logic) ----

    getPlayerFrame(player) {
        const isMoving = (player.facing.x !== 0 || player.facing.y !== 0) &&
            (Input.isDown('w') || Input.isDown('a') || Input.isDown('s') || Input.isDown('d') ||
             Input.isDown('arrowup') || Input.isDown('arrowleft') || Input.isDown('arrowdown') || Input.isDown('arrowright'));
        const isAttacking = player.swingTimer > 0 || (player.skillEffect && (player.skillEffect.type === 'charge' || player.skillEffect.type === 'slam'));

        let state = 'idle';
        if (player.hp <= 0) state = 'death';
        else if (isAttacking) state = player.classData.type === 'melee' ? 'attack' : 'cast';
        else if (isMoving) state = 'walk';

        const sheetKey = player.classData.type === 'melee' ? 'melee' : 'ranged';
        const sheet = Sprites.sheets[sheetKey];
        if (!sheet) return null;

        const dir = Sprites.getDirectionCol(player.facing.x, player.facing.y);
        let col = dir.col;
        const flip = dir.flip;
        let row = 0;
        const time = performance.now();

        if (state === 'death') {
            row = 3; col = 6 + (Math.floor(time / 400) % 2);
        } else if (state === 'attack' || state === 'cast') {
            const frame = Math.floor(time / 200) % 3;
            if (col === 0 || col === 1) { row = 2 + (frame > 1 ? 1 : 0); col = frame > 1 ? 0 : frame; }
            else { row = 2; }
        } else if (state === 'walk') {
            if (col === 4) { row = 0; const walkSeq = [5, 6, 7, 6]; col = walkSeq[Math.floor(time / 180) % 4]; }
            else { row = 1; }
        }

        const f = Sprites.getFrame(sheetKey, col, row);
        return { sheet, frame: f, flip, state };
    },

    getMonsterFrame(monster) {
        const mobKey = monster.typeId === 'slime' ? 'slime_minion' : monster.typeId;
        const sheetKey = monster.boss ? monster.typeId : mobKey;
        const sheet = Sprites.sheets[sheetKey];
        const fd = Sprites.bossFrameData[sheetKey];
        if (!sheet || !fd) return null;

        const player = Game.player;
        let fx = 0, fy = 1;
        if (player) { fx = player.x - monster.x; fy = player.y - monster.y; }

        const dist = Math.sqrt(fx * fx + fy * fy);
        const isMoving = dist > (monster.boss ? (monster.attackRange || 50) + 10 : (monster.attackRange || 28) + 10);
        const state = isMoving ? 'walk' : 'idle';

        const time = performance.now();
        const angle = ((Math.atan2(fy, fx) * 180 / Math.PI) + 360) % 360;
        const facingUp = angle >= 225 && angle < 315;
        const facingLeft = angle >= 135 && angle < 225;
        let row, col, flip = false;

        if (state === 'walk') {
            if (facingUp) { row = 2; }
            else if (facingLeft || (angle >= 315 || angle < 45)) { row = 3; flip = facingLeft; }
            else { row = 1; }
            col = Math.floor(time / 150) % fd.cols;
        } else {
            row = 0;
            col = Math.floor(time / 200) % fd.cols;
            if (facingLeft) flip = true;
        }

        const sx = (col + (fd.colOffset || 0)) * fd.colW;
        const sy = fd.rowStarts[row] || 0;
        const sw = Math.min(fd.colW, (sheet.naturalWidth || sheet.width) - sx);
        const sh = fd.rowHeights[row] || fd.colW;

        return { sheet, sx, sy, sw, sh, flip, refH: fd.rowHeights[0] || sh };
    },

    // ---- MAIN RENDER ----
    render(gameState) {
        if (!this.ready) return;

        const { player, arenaW, arenaH, screenShake } = gameState;

        // Skybox + parallax
        if (Background.current) {
            this.setSkyboxTexture(Background.current);
        }
        if (player && this.bgContainer) {
            // Subtle parallax for depth feel
            const nx = (player.x / arenaW - 0.5) * 2;
            const ny = (player.y / arenaH - 0.5) * 2;
            const shiftX = 50 - nx * 6;
            const shiftY = 42 - ny * 4;
            this.bgContainer.style.backgroundPosition = `${shiftX}% ${shiftY}%`;
        }

        // Ambient tint
        const tint = Background.tints && Background.tints[Background.current];
        if (tint) {
            this.ambientLight.color.setRGB(
                0.3 + tint.r / 400,
                0.3 + tint.g / 400,
                0.3 + tint.b / 400
            );
        }

        // --- CAMERA (do first so billboards face it correctly) ---
        if (player) {
            // Fixed camera centered on arena — player moves freely across screen
            const arenaCenter = this.toWorld(arenaW / 2, arenaH / 2, arenaW, arenaH);
            const camPos = arenaCenter.clone().add(this.camOffset);
            this.camera.position.copy(camPos);
            this.camera.lookAt(arenaCenter);

            if (screenShake > 0) {
                this.camera.position.x += (Math.random() - 0.5) * screenShake * 2;
                this.camera.position.z += (Math.random() - 0.5) * screenShake * 2;
            }

            this.dirLight.position.set(this.camTarget.x + 10, 30, this.camTarget.z + 10);
            this.dirLight.target.position.copy(this.camTarget);
            this.dirLight.target.updateMatrixWorld();
        }

        // --- SPRITES (drawn on 2D overlay after 3D render) ---
        // Defer sprite drawing to after renderer.render() below

        // --- LOOT ---
        this.renderLoot(gameState.loot, arenaW, arenaH);

        // --- EFFECTS ---
        if (player) {
            this.renderEffects(player, arenaW, arenaH);
        }

        this.renderer.render(this.scene, this.camera);

        // --- 2D OVERLAY: sprites + damage numbers drawn after 3D scene ---
        const ctx = this.overlayCtx;
        const cw = this.overlayCanvas.width;
        const ch = this.overlayCanvas.height;
        ctx.clearRect(0, 0, cw, ch);

        if (player && player.hp > 0) {
            this.drawSprite2D(ctx, player, arenaW, arenaH, true);
        }
        if (gameState.monsters) {
            for (const m of gameState.monsters) {
                if (!m.dead) this.drawSprite2D(ctx, m, arenaW, arenaH, false);
            }
        }

        // Projectiles (2D overlay)
        this.renderProjectiles2D(ctx, gameState.projectiles, arenaW, arenaH);

        // Particles + damage numbers (on 2D overlay, after clear)
        this.renderParticles(gameState.particles, arenaW, arenaH);
    },

    drawSprite2D(ctx, entity, arenaW, arenaH, isPlayer) {
        const worldPos = this.toWorld(entity.x, entity.y, arenaW, arenaH);
        const screenPos = this.toScreen(worldPos, 0);
        if (screenPos.z < 0 || screenPos.z > 1) return; // behind camera or too far

        const pxPerUnit = this.getScreenScale(worldPos);
        const worldH = isPlayer ? 4 : (entity.boss ? 6 : 3);
        const pixelH = worldH * pxPerUnit;

        if (isPlayer) {
            const spriteKey = entity.classData.type === 'melee' ? 'melee' : 'ranged';
            const isMoving = (entity.facing.x !== 0 || entity.facing.y !== 0) &&
                (Input.isDown('w') || Input.isDown('a') || Input.isDown('s') || Input.isDown('d') ||
                 Input.isDown('arrowup') || Input.isDown('arrowleft') || Input.isDown('arrowdown') || Input.isDown('arrowright'));
            const isAttacking = entity.swingTimer > 0 || (entity.skillEffect && (entity.skillEffect.type === 'charge' || entity.skillEffect.type === 'slam'));
            let state = 'idle';
            if (entity.hp <= 0) state = 'death';
            else if (isAttacking) state = entity.classData.type === 'melee' ? 'attack' : 'cast';
            else if (isMoving) state = 'walk';
            const flash = entity.flashTimer > 0;
            Sprites.draw(ctx, spriteKey, screenPos.x, screenPos.y, entity.facing.x, entity.facing.y, state, pixelH, flash);
        } else {
            // Monster
            const player = Game.player;
            let fx = 0, fy = 1;
            if (player) { fx = player.x - entity.x; fy = player.y - entity.y; }
            const dist = Math.sqrt(fx * fx + fy * fy);
            const isMoving = dist > (entity.boss ? (entity.attackRange || 50) + 10 : (entity.attackRange || 28) + 10);
            const state = isMoving ? 'walk' : 'idle';
            const flash = entity.flashTimer > 0;

            const mobKey = entity.typeId === 'slime' ? 'slime_minion' : entity.typeId;
            const sheetKey = entity.boss ? entity.typeId : mobKey;

            if (entity.boss && Sprites.sheets[sheetKey]) {
                Sprites.drawBoss(ctx, sheetKey, screenPos.x, screenPos.y, fx, fy, state, pixelH, flash);
            } else if (Sprites.sheets[sheetKey] && Sprites.bossFrameData[sheetKey]) {
                Sprites.drawMob(ctx, sheetKey, screenPos.x, screenPos.y, fx, fy, state, pixelH, flash);
            } else {
                // Fallback shape
                ctx.fillStyle = flash ? '#fff' : (entity.color || '#ff4444');
                ctx.beginPath();
                ctx.arc(screenPos.x, screenPos.y, pixelH / 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    },

    // --- Below: WebGL-based rendering for non-sprite elements ---

    _unused_renderPlayer(player, arenaW, arenaH) {
        const frameData = this.getPlayerFrame(player);

        if (!this.playerMesh) {
            this.playerMesh = this.createSprite();
            this.scene.add(this.playerMesh);
        }

        this.playerMesh.visible = true;
        const pos = this.toWorld(player.x, player.y, arenaW, arenaH);

        if (frameData) {
            const f = frameData.frame;
            this.updateSprite(this.playerMesh, frameData.sheet, f.x, f.y, f.w, f.h, frameData.flip, 4, pos);
        } else {
            // Fallback debug square
            if (!this._debugPlayerTex) {
                const dc = document.createElement('canvas');
                dc.width = 64; dc.height = 64;
                const dctx = dc.getContext('2d');
                dctx.fillStyle = '#4488ff';
                dctx.fillRect(0, 0, 64, 64);
                this._debugPlayerTex = new THREE.CanvasTexture(dc);
            }
            this.playerMesh.material.map = this._debugPlayerTex;
            this.playerMesh.material.needsUpdate = true;
            this.playerMesh.position.set(pos.x, 2, pos.z);
            this.playerMesh.scale.set(4, 4, 1);
        }

        if (player.flashTimer > 0) {
            this.playerMesh.material.color.set(0xff4444);
        } else {
            this.playerMesh.material.color.set(0xffffff);
        }
    },

    renderMonsters(monsters, arenaW, arenaH) {
        const alive = new Set();

        for (const m of monsters) {
            if (m.dead) continue;
            alive.add(m);

            let sprite = this.monsterMeshes.get(m);
            if (!sprite) {
                sprite = this.createSprite();
                this.scene.add(sprite);
                this.monsterMeshes.set(m, sprite);
            }

            const pos = this.toWorld(m.x, m.y, arenaW, arenaH);
            const frameData = this.getMonsterFrame(m);
            const worldH = m.boss ? 6 : 3;

            if (frameData) {
                this.updateSprite(sprite, frameData.sheet, frameData.sx, frameData.sy, frameData.sw, frameData.sh, frameData.flip, worldH, pos);
            } else {
                sprite.material.color.set(m.color || 0xff4444);
                sprite.material.map = null;
                sprite.position.set(pos.x, worldH / 2, pos.z);
                sprite.scale.set(worldH, worldH, 1);
            }

            if (m.flashTimer > 0) {
                sprite.material.color.set(0xffffff);
            } else if (m.frozenTint) {
                sprite.material.color.set(0x88ccff);
            } else {
                sprite.material.color.set(0xffffff);
            }

            sprite.visible = true;
        }

        // Cleanup dead
        for (const [m, sprite] of this.monsterMeshes) {
            if (!alive.has(m)) {
                this.scene.remove(sprite);
                sprite.material.dispose();
                this.monsterMeshes.delete(m);
            }
        }
    },

    renderProjectiles2D(ctx, projectiles, arenaW, arenaH) {
        if (!projectiles) return;

        // Regular projectiles
        for (const p of projectiles.list) {
            const worldPos = this.toWorld(p.x, p.y, arenaW, arenaH);
            const sp = this.toScreen(worldPos, 0);
            if (sp.z < 0 || sp.z > 1) continue;
            const pxPerUnit = this.getScreenScale(worldPos);
            const r = Math.max(2, p.size * 0.5 * pxPerUnit * this.SCALE * 8);

            // Glow
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, r * 2, 0, Math.PI * 2);
            ctx.fill();

            // Core
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
            ctx.fill();

            // Bright center
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, r * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Traps
        for (const trap of projectiles.traps) {
            const worldPos = this.toWorld(trap.x, trap.y, arenaW, arenaH);
            const sp = this.toScreen(worldPos, 0);
            if (sp.z < 0 || sp.z > 1) continue;
            const pxPerUnit = this.getScreenScale(worldPos);
            const r = Math.max(4, 6 * pxPerUnit * this.SCALE * 6);

            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = trap.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            // Triangle
            for (let i = 0; i < 3; i++) {
                const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
                const tx = sp.x + Math.cos(a) * r;
                const ty = sp.y + Math.sin(a) * r;
                if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
            }
            ctx.closePath();
            ctx.fillStyle = trap.color;
            ctx.fill();
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Explosions
        for (const exp of projectiles.explosions) {
            const worldPos = this.toWorld(exp.x, exp.y, arenaW, arenaH);
            const sp = this.toScreen(worldPos, 0);
            if (sp.z < 0 || sp.z > 1) continue;
            const pxPerUnit = this.getScreenScale(worldPos);
            const p = exp.timer / exp.maxTimer;
            const r = exp.radius * pxPerUnit * this.SCALE * (1.2 - p * 0.3);

            ctx.globalAlpha = p * 0.35;
            ctx.fillStyle = exp.color;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
            ctx.fill();

            // Ring
            ctx.strokeStyle = exp.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = p * 0.6;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    },

    renderParticles(particles, arenaW, arenaH) {
        if (!particles) return;

        // Grow pool as needed
        while (this.particlePool.length < particles.list.length) {
            const geo = new THREE.SphereGeometry(0.15, 4, 4);
            const mat = new THREE.MeshBasicMaterial({ transparent: true });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.visible = false;
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
                    mesh.material.color.set(new THREE.Color(p.color));
                    mesh.material.opacity = alpha * 0.8;
                    const s = p.size * this.SCALE * alpha * 3;
                    mesh.scale.set(Math.max(s, 0.1), Math.max(s, 0.1), Math.max(s, 0.1));
                    mesh.visible = true;
                }
            } else {
                mesh.visible = false;
            }
        }
    },

    renderDamageNumber(p, arenaW, arenaH) {
        // Draw damage numbers on the 2D overlay instead of WebGL sprites
        const alpha = Math.max(0, p.life / p.maxLife);
        if (alpha <= 0) return;

        const worldPos = this.toWorld(p.x, p.y, arenaW, arenaH);
        const screenPos = this.toScreen(worldPos, 0);
        if (screenPos.z < 0 || screenPos.z > 1) return;

        const ctx = this.overlayCtx;
        const floatY = screenPos.y - (1 - alpha) * 60; // float upward

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

    renderLoot(loot, arenaW, arenaH) {
        if (!loot) return;
        const active = new Set();

        for (const item of loot.groundItems) {
            active.add(item);
            let mesh = this.lootMeshes.get(item);
            if (!mesh) {
                let color = 0xffaa00;
                if (item.type === 'potion') color = 0xff2244;
                else if (item.type === 'heal_orb') color = 0x44ff66;
                else if (item.type === 'gem') {
                    color = { str: 0xff4444, agi: 0x44ff44, vit: 0x4444ff, mnd: 0xff44ff }[item.stat] || 0xffffff;
                }

                const geo = new THREE.OctahedronGeometry(0.4, 0);
                const mat = new THREE.MeshStandardMaterial({
                    color, emissive: color, emissiveIntensity: 0.5,
                    metalness: 0.8, roughness: 0.2,
                });
                mesh = new THREE.Mesh(geo, mat);
                this.scene.add(mesh);
                this.lootMeshes.set(item, mesh);
            }

            const pos = this.toWorld(item.x, item.y, arenaW, arenaH);
            const bob = Math.sin(item.bobOffset) * 0.2;
            mesh.position.set(pos.x, 0.8 + bob, pos.z);
            mesh.rotation.y += 0.03;
            mesh.visible = true;
        }

        for (const [item, mesh] of this.lootMeshes) {
            if (!active.has(item)) {
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
                this.lootMeshes.delete(item);
            }
        }
    },

    renderEffects(player, arenaW, arenaH) {
        for (const mesh of this.effectMeshes) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            if (mesh.material.dispose) mesh.material.dispose();
        }
        this.effectMeshes = [];

        // Ground effects
        for (const gfx of player.groundEffects) {
            const pos = this.toWorld(gfx.x, gfx.y, arenaW, arenaH);
            const r = gfx.radius * this.SCALE;
            const geo = new THREE.CircleGeometry(r, 24);
            geo.rotateX(-Math.PI / 2);
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(gfx.color || '#ff4400'),
                transparent: true, opacity: 0.3, side: THREE.DoubleSide,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(pos.x, 0.05, pos.z);
            this.scene.add(mesh);
            this.effectMeshes.push(mesh);
        }

        // Skill effects
        if (player.skillEffect) {
            const e = player.skillEffect;
            const p = e.timer / e.maxTimer;
            const pp = this.toWorld(player.x, player.y, arenaW, arenaH);

            if (e.type === 'slam') {
                const r = e.radius * this.SCALE * (1 - p * 0.3);
                const geo = new THREE.RingGeometry(r * 0.7, r, 24);
                geo.rotateX(-Math.PI / 2);
                const mat = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(e.color), transparent: true, opacity: p * 0.5, side: THREE.DoubleSide,
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(pp.x, 0.1, pp.z);
                this.scene.add(mesh);
                this.effectMeshes.push(mesh);
            } else if (e.type === 'charge') {
                const sp = this.toWorld(e.startX, e.startY, arenaW, arenaH);
                const geo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(sp.x, 0.5, sp.z),
                    new THREE.Vector3(pp.x, 0.5, pp.z),
                ]);
                const mat = new THREE.LineBasicMaterial({
                    color: new THREE.Color(e.color), transparent: true, opacity: p * 0.7,
                });
                const line = new THREE.Line(geo, mat);
                this.scene.add(line);
                this.effectMeshes.push(line);
            }
        }

        // Channeling beam
        if (player.channeling && player.channeling.target) {
            const t = player.channeling.target;
            const sp = this.toWorld(player.x, player.y, arenaW, arenaH);
            const ep = this.toWorld(t.x, t.y, arenaW, arenaH);
            const geo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(sp.x, 2, sp.z),
                new THREE.Vector3(ep.x, 2, ep.z),
            ]);
            const mat = new THREE.LineBasicMaterial({ color: 0xbb66ff, transparent: true, opacity: 0.6 });
            const line = new THREE.Line(geo, mat);
            this.scene.add(line);
            this.effectMeshes.push(line);
        }

        // Blocking bubble
        if (player.blocking) {
            const r = (player.size + 6) * this.SCALE;
            const pp = this.toWorld(player.x, player.y, arenaW, arenaH);
            const geo = new THREE.SphereGeometry(r, 12, 12);
            const mat = new THREE.MeshBasicMaterial({
                color: 0x4488ff, transparent: true, opacity: 0.15, wireframe: true,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(pp.x, r, pp.z);
            this.scene.add(mesh);
            this.effectMeshes.push(mesh);
        }
    },

    cleanup() {
        if (this.playerMesh) { this.scene.remove(this.playerMesh); this.playerMesh = null; }
        for (const [, s] of this.monsterMeshes) { this.scene.remove(s); }
        this.monsterMeshes.clear();
        for (const [, s] of this.projectileMeshes) { this.scene.remove(s); }
        this.projectileMeshes.clear();
        for (const [, s] of this.lootMeshes) { this.scene.remove(s); }
        this.lootMeshes.clear();
        this.textureCache.clear();
    },
};
