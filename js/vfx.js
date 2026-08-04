// ============================================================
// VFX - pooled visual effects.
//
// Two systems share one pool of meshes:
//   1. Immediate mode  - begin() / draw calls / end(). Anything whose
//      state lives in gameplay data (explosion timers, ground effects,
//      beams). Nothing is allocated or disposed per frame; unused pool
//      objects are just hidden.
//   2. Transient particles - fire-and-forget sparks, debris and dust
//      that own their motion. Fixed cap, integrated in update().
//
// Glow colors are written above 1.0 on purpose: the composer renders to
// a HalfFloat target, so values over the bloom threshold blow out and
// bleed. That, not opacity, is what makes an effect look hot.
// ============================================================

const VFX = {
    MAX_PARTICLES: 240,

    init(scene) {
        this.scene = scene;
        this._pools = {};
        this._geo = {};
        this._parts = [];
        this._free = [];
        this._c = new THREE.Color();
        this._v1 = new THREE.Vector3();
        this._v2 = new THREE.Vector3();
        this._up = new THREE.Vector3(0, 1, 0);
        this._q = new THREE.Quaternion();
        this._last = performance.now();

        const tex = this._sparkTexture();
        for (let i = 0; i < this.MAX_PARTICLES; i++) {
            const m = new THREE.Mesh(this._quad(), new THREE.MeshBasicMaterial({
                map: tex, transparent: true, depthWrite: false,
            }));
            m.visible = false;
            m.frustumCulled = false;
            scene.add(m);
            this._parts.push({ mesh: m, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, grav: 0, size: 1, grow: 0, drag: 0 });
            this._free.push(i);
        }
    },

    // Soft radial dot — square-edged particles read as debris, not light
    _sparkTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        // Tight core with a short falloff — a wide blur reads as bokeh, not a spark
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.18, 'rgba(255,255,255,0.92)');
        grad.addColorStop(0.45, 'rgba(255,255,255,0.28)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        const t = new THREE.Texture(c);
        t.needsUpdate = true;
        return t;
    },

    // ---- shared unit geometry (scaled per use) ----
    _quad() {
        return this._geo.quad || (this._geo.quad = new THREE.PlaneGeometry(1, 1));
    },
    _flat(key, make) {
        if (!this._geo[key]) { const g = make(); g.rotateX(-Math.PI / 2); this._geo[key] = g; }
        return this._geo[key];
    },
    _ringGeo(thick) {
        return this._flat('ring' + thick, () => new THREE.RingGeometry(1 - thick, 1, 48));
    },
    _discGeo() {
        return this._flat('disc', () => new THREE.CircleGeometry(1, 40));
    },
    _arcGeo() {
        return this._flat('arc', () => new THREE.RingGeometry(0.72, 1, 24, 1, -0.75, 1.5));
    },
    _sphereGeo() {
        return this._geo.sph || (this._geo.sph = new THREE.SphereGeometry(1, 18, 14));
    },
    _cylGeo() {
        return this._geo.cyl || (this._geo.cyl = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true));
    },

    // ---- immediate-mode pool ----
    _get(kind, make) {
        let p = this._pools[kind];
        if (!p) p = this._pools[kind] = { items: [], used: 0 };
        if (p.used >= p.items.length) {
            const obj = make();
            obj.frustumCulled = false;
            this.scene.add(obj);
            p.items.push(obj);
        }
        const obj = p.items[p.used++];
        obj.visible = true;
        return obj;
    },
    _addMesh(geo, additive) {
        return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            transparent: true, depthWrite: false, side: THREE.DoubleSide,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        }));
    },

    begin() {
        for (const k in this._pools) this._pools[k].used = 0;
    },
    end() {
        for (const k in this._pools) {
            const p = this._pools[k];
            for (let i = p.used; i < p.items.length; i++) p.items[i].visible = false;
        }
    },

    _tint(mesh, color, intensity, opacity) {
        this._c.set(color).multiplyScalar(intensity);
        mesh.material.color.copy(this._c);
        mesh.material.opacity = opacity;
    },

    // ---- immediate-mode shapes ----

    ring(x, y, z, radius, color, opacity, intensity, thick) {
        const m = this._get('ring' + (thick || 0.1), () => this._addMesh(this._ringGeo(thick || 0.1), true));
        m.position.set(x, y, z);
        m.scale.set(radius, 1, radius);
        this._tint(m, color, intensity === undefined ? 1.6 : intensity, opacity);
        return m;
    },

    disc(x, y, z, radius, color, opacity, intensity) {
        const m = this._get('disc', () => this._addMesh(this._discGeo(), true));
        m.position.set(x, y, z);
        m.scale.set(radius, 1, radius);
        this._tint(m, color, intensity === undefined ? 1 : intensity, opacity);
        return m;
    },

    glow(x, y, z, radius, color, opacity, intensity) {
        const m = this._get('glow', () => this._addMesh(this._sphereGeo(), true));
        m.position.set(x, y, z);
        m.scale.setScalar(radius);
        this._tint(m, color, intensity === undefined ? 2.2 : intensity, opacity);
        return m;
    },

    // Slash arc in front of a character, aligned to its facing yaw
    arc(x, y, z, yaw, radius, color, opacity, intensity) {
        const m = this._get('arc', () => this._addMesh(this._arcGeo(), true));
        m.position.set(x, y, z);
        m.rotation.y = yaw - Math.PI / 2;
        m.scale.set(radius, 1, radius);
        this._tint(m, color, intensity === undefined ? 2.4 : intensity, opacity);
        return m;
    },

    // Tapered tube between two world points
    beam(x1, y1, z1, x2, y2, z2, radius, color, opacity, intensity) {
        const m = this._get('beam', () => this._addMesh(this._cylGeo(), true));
        this._v1.set(x1, y1, z1);
        this._v2.set(x2, y2, z2);
        const len = this._v1.distanceTo(this._v2);
        m.position.copy(this._v1).add(this._v2).multiplyScalar(0.5);
        this._v2.sub(this._v1).normalize();
        m.quaternion.setFromUnitVectors(this._up, this._v2);
        m.scale.set(radius, len, radius);
        this._tint(m, color, intensity === undefined ? 2 : intensity, opacity);
        return m;
    },

    // ---- transient particles ----

    _spawn(x, y, z, color, opts) {
        if (!this._free.length) return null;
        const p = this._parts[this._free.pop()];
        p.mesh.position.set(x, y, z);
        p.mesh.visible = true;
        p.mesh.material.color.set(color);
        p.mesh.material.blending = opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending;
        p.mesh.material.opacity = 1;
        p.maxLife = p.life = opts.life;
        p.size = opts.size;
        p.grow = opts.grow || 0;
        p.grav = opts.grav || 0;
        p.drag = opts.drag || 0;
        p.fade = opts.fade || 1;
        p.mesh.scale.setScalar(opts.size);
        return p;
    },

    // Radial spray — impacts, explosions, casts
    burst(x, y, z, count, color, opts) {
        opts = opts || {};
        const speed = opts.speed || 6;
        const up = opts.up === undefined ? 0.6 : opts.up;
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = speed * (0.45 + Math.random() * 0.75);
            const p = this._spawn(x, y, z, color, {
                life: (opts.life || 0.45) * (0.7 + Math.random() * 0.6),
                size: (opts.size || 0.5) * (0.6 + Math.random() * 0.8),
                grow: opts.grow === undefined ? -0.5 : opts.grow,
                grav: opts.grav === undefined ? -14 : opts.grav,
                drag: opts.drag === undefined ? 1.6 : opts.drag,
                additive: opts.additive,
            });
            if (!p) return;
            p.vx = Math.cos(a) * s;
            p.vz = Math.sin(a) * s;
            p.vy = s * up * (0.4 + Math.random());
        }
    },

    // One drifting mote. Weapon auras call this a few times a frame; positive
    // grav rises (embers), negative sinks (frost falls, as cold air does).
    mote(x, y, z, color, opts) {
        const p = this._spawn(
            x + (Math.random() - 0.5) * (opts.spread || 0),
            y + (Math.random() - 0.5) * (opts.spreadY || 0),
            z + (Math.random() - 0.5) * (opts.spread || 0),
            color, {
                life: (opts.life || 0.6) * (0.7 + Math.random() * 0.6),
                size: (opts.size || 0.3) * (0.6 + Math.random() * 0.7),
                grow: opts.grow === undefined ? -0.45 : opts.grow,
                grav: opts.grav === undefined ? 4 : opts.grav,
                drag: opts.drag === undefined ? 1.1 : opts.drag,
                additive: opts.additive,
            });
        if (!p) return;
        const v = opts.vel === undefined ? 0.8 : opts.vel;
        p.vx = (Math.random() - 0.5) * v;
        p.vz = (Math.random() - 0.5) * v;
        p.vy = (opts.vy === undefined ? 1.2 : opts.vy) * (0.6 + Math.random() * 0.8);
    },

    // Elemental aura for an enchanted weapon, emitted at the blade each frame.
    // Shared by the game renderer and bosses.html so the two cannot drift.
    weaponAura(x, y, z, kind, busy) {
        // No big additive spheres here: they render as flat bullseye halos and
        // swamp the blade. The flame/rime geometry on the weapon carries the
        // look; this only adds drifting motes and a small light bleed.
        const n = busy ? 2 : 1;
        if (kind === 'fire') {
            this.glow(x, y - 0.2, z, 0.34, 0xff8420, 0.3, 1.8);
            for (let i = 0; i < n; i++) {
                if (Math.random() > 0.75) continue;
                this.mote(x, y, z, 0xff8c28,
                    { spread: 0.35, spreadY: 1.6, life: 0.45, size: 0.26, grav: 7, vy: 1.9, vel: 0.9 });
            }
            if (Math.random() < 0.3) {
                this.mote(x, y, z, 0xffd894,
                    { spread: 0.22, spreadY: 1.3, life: 0.32, size: 0.15, grav: 9, vy: 2.4, vel: 0.6 });
            }
        } else if (kind === 'frost') {
            this.glow(x, y - 0.2, z, 0.3, 0x8ccdff, 0.24, 1.6);
            for (let i = 0; i < n; i++) {
                if (Math.random() > 0.6) continue;
                // frost sinks and lingers — the opposite read to embers
                this.mote(x, y, z, 0xcfeeff,
                    { spread: 0.45, spreadY: 1.7, life: 1.0, size: 0.24, grav: -3.2, vy: -0.15, vel: 0.5, grow: -0.15, drag: 0.7 });
            }
        }
    },

    // Soft ground puff — footsteps, landings. Deliberately not additive:
    // dust occludes, it doesn't glow.
    dust(x, y, z, count, color) {
        for (let i = 0; i < (count || 3); i++) {
            const a = Math.random() * Math.PI * 2;
            const s = 0.7 + Math.random() * 1.1;
            const p = this._spawn(x, y, z, color || 0x9a8f80, {
                life: 0.5 + Math.random() * 0.3,
                size: 0.35 + Math.random() * 0.3,
                grow: 1.6, grav: 1.2, drag: 2.6, additive: false,
            });
            if (!p) return;
            p.vx = Math.cos(a) * s;
            p.vz = Math.sin(a) * s;
            p.vy = 0.5 + Math.random() * 0.7;
            p.mesh.material.opacity = 0.5;
            p.fade = 0.5;
        }
    },

    update(camera) {
        const now = performance.now();
        const dt = Math.min(0.05, (now - this._last) / 1000);
        this._last = now;

        for (let i = 0; i < this._parts.length; i++) {
            const p = this._parts[i];
            if (p.life <= 0) continue;
            p.life -= dt;
            if (p.life <= 0) {
                p.mesh.visible = false;
                this._free.push(i);
                continue;
            }
            const damp = Math.max(0, 1 - p.drag * dt);
            p.vx *= damp; p.vz *= damp;
            p.vy = p.vy * damp + p.grav * dt;
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;
            if (p.mesh.position.y < 0.05) { p.mesh.position.y = 0.05; p.vy = 0; p.vx *= 0.6; p.vz *= 0.6; }

            const k = p.life / p.maxLife;
            p.mesh.material.opacity = k * p.fade;
            p.mesh.scale.setScalar(Math.max(0.02, p.size * (1 + (1 - k) * p.grow)));
            p.mesh.quaternion.copy(camera.quaternion); // billboard
        }
    },

    clear() {
        for (let i = 0; i < this._parts.length; i++) {
            const p = this._parts[i];
            if (p.life > 0) { p.life = 0; p.mesh.visible = false; this._free.push(i); }
        }
        this.begin();
        this.end();
    },
};
