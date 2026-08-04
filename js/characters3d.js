// ============================================================
// CHARACTERS 3D - procedural low-poly character rigs.
// Every model is built from primitives (no mesh assets), forward = +Z.
// Factories return an instance the renderer positions and animates:
//   { root, body, parts, mats, kind, key, phase }
// Animation is stateless pose-from-time: every frame sets rotations
// from formulas, so states can switch without blending bookkeeping.
// ============================================================

const Characters3D = {
    _geoCache: new Map(),

    // ---- shared geometry (cached; NEVER disposed per-instance) ----
    _geo(key, make) {
        let g = this._geoCache.get(key);
        // Tagged shared: props reuse these, and the environment teardown
        // disposes everything it traverses — without the tag a biome change
        // would free geometry the character rigs are still drawing with
        if (!g) { g = make(); g.userData.shared = true; this._geoCache.set(key, g); }
        return g;
    },
    box(w, h, d) {
        const k = `b${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`;
        return this._geo(k, () => new THREE.BoxGeometry(w, h, d));
    },
    cyl(rt, rb, h, seg) {
        seg = seg || 7;
        const k = `c${rt.toFixed(3)},${rb.toFixed(3)},${h.toFixed(3)},${seg}`;
        return this._geo(k, () => new THREE.CylinderGeometry(rt, rb, h, seg));
    },
    cone(r, h, seg) {
        seg = seg || 6;
        const k = `k${r.toFixed(3)},${h.toFixed(3)},${seg}`;
        return this._geo(k, () => new THREE.ConeGeometry(r, h, seg));
    },
    sph(r, seg) {
        seg = seg || 7;
        const k = `s${r.toFixed(3)},${seg}`;
        return this._geo(k, () => new THREE.SphereGeometry(r, seg, Math.max(5, seg - 1)));
    },
    torusArc(r, tube) {
        const k = `t${r.toFixed(3)},${tube.toFixed(3)}`;
        return this._geo(k, () => new THREE.TorusGeometry(r, tube, 5, 10, Math.PI));
    },

    // Cel-shading: light wraps into hard bands instead of a smooth falloff.
    // MATTE for cloth/skin, SHINY for metal (extra top band = highlight).
    OUTLINES: true,
    _RAMP_MATTE: [70, 140, 210, 255],
    _RAMP_SHINY: [60, 120, 190, 245, 255],
    _texCache: new Map(),

    _gradientMap(steps) {
        const key = steps.join(',');
        let tex = this._texCache.get(key);
        if (!tex) {
            tex = new THREE.DataTexture(new Uint8Array(steps), steps.length, 1, THREE.RedFormat);
            tex.minFilter = THREE.NearestFilter;
            tex.magFilter = THREE.NearestFilter;
            tex.generateMipmaps = false;
            tex.needsUpdate = true;
            this._texCache.set(key, tex);
        }
        return tex;
    },

    // ---- materials (per-instance so flash/tint can differ) ----
    _mat(inst, hex, opts) {
        opts = opts || {};
        const m = new THREE.MeshToonMaterial({
            color: new THREE.Color(hex),
            gradientMap: this._gradientMap((opts.metal || 0) > 0.4 ? this._RAMP_SHINY : this._RAMP_MATTE),
        });
        if (opts.emissive) {
            m.emissive = new THREE.Color(opts.emissive);
            m.emissiveIntensity = opts.glow || 1.0;
        }
        m.userData.bc = m.color.clone();
        m.userData.be = m.emissive.clone();
        m.userData.bei = m.emissiveIntensity;
        inst.mats.push(m);
        return m;
    },

    // Shared across every rig — never per-instance, never disposed
    _outlineMaterial() {
        if (!this._outlineMat) {
            // Near-black with a warm-purple bias; pure black reads as a hole
            this._outlineMat = new THREE.MeshBasicMaterial({ color: 0x140e18, side: THREE.BackSide });
            this._outlineMat.userData.shared = true;
        }
        return this._outlineMat;
    },

    // Inverted-hull outline: a back-faced shell expanded by a constant world
    // thickness. Per-axis scale (not uniform) keeps the line even on thin parts.
    _addOutline(mesh, t) {
        const p = mesh.geometry.parameters;
        if (!p || p.tube !== undefined) return; // torus: skip, shell inverts badly
        let sx, sy, sz, minDim;
        if (p.width !== undefined) {
            sx = 1 + 2 * t / p.width; sy = 1 + 2 * t / p.height; sz = 1 + 2 * t / p.depth;
            minDim = Math.min(p.width, p.height, p.depth);
        } else if (p.radiusTop !== undefined) {
            const r = Math.max(p.radiusTop, p.radiusBottom);
            sx = sz = 1 + t / r; sy = 1 + 2 * t / p.height;
            minDim = Math.min(2 * r, p.height);
        } else if (p.height !== undefined) {
            sx = sz = 1 + t / p.radius; sy = 1 + 2 * t / p.height;
            minDim = Math.min(2 * p.radius, p.height);
        } else {
            sx = sy = sz = 1 + t / p.radius;
            minDim = 2 * p.radius;
        }
        if (minDim < t * 3.5) return; // detail too small; the shell would swamp it
        const shell = new THREE.Mesh(mesh.geometry, this._outlineMaterial());
        shell.scale.set(Math.min(sx, 1.6), Math.min(sy, 1.6), Math.min(sz, 1.6));
        shell.castShadow = false;
        mesh.add(shell);
    },

    _part(parent, geo, mat, x, y, z, noOutline) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x || 0, y || 0, z || 0);
        mesh.castShadow = true;
        parent.add(mesh);
        // _ow is set by create() for the rig currently being built
        if (this.OUTLINES && !noOutline) this._addOutline(mesh, this._ow);
        return mesh;
    },

    _shade(hex, mul) {
        const c = new THREE.Color(hex);
        c.multiplyScalar(mul);
        return c.getHex();
    },

    // ============================================================
    // WEAPONS - groups with the grip at origin, blade up +Y
    // ============================================================

    // Emitter anchor at mid-blade; the renderer reads its world position each
    // frame to spawn the weapon's elemental aura
    _fxAnchor(inst, g, y) {
        const a = new THREE.Object3D();
        a.position.y = y;
        g.add(a);
        inst.parts.fxAnchor = a;
    },

    // Layered tongues of flame licking along a blade. Opaque, colour-graded
    // cones — NOT stacked additive spheres, which just render as flat halos.
    // Hotter colours sit higher and further forward so the gradient reads.
    _flameSheath(inst, g, h, y0, y1, kind) {
        const cold = kind === 'frost';
        const palette = cold
            ? [0x2f7fd8, 0x69bdf5, 0xd6f2ff]
            : [0xc4300a, 0xff7314, 0xffc247];
        const glows = cold ? [0.7, 1.2, 1.9] : [0.9, 1.5, 2.3];
        inst.flames = inst.flames || [];
        const mats = palette.map((c, i) => this._mat(inst, c, { emissive: c, glow: glows[i] }));

        // Tongues hug the blade and lean only slightly outward — a wide fan
        // reads as leaves, not fire. They overlap heavily along the length.
        const N = 10;
        for (let i = 0; i < N; i++) {
            const f = i / (N - 1);
            const y = y0 + (y1 - y0) * f;
            const side = i % 2 ? 1 : -1;
            const layer = f < 0.38 ? 0 : (f < 0.75 ? 1 : 2);
            const r = h * (0.055 - f * 0.03);
            const len = h * (0.32 - f * 0.13);
            const m = this._part(g, this.cone(r, len, 5), mats[layer],
                side * h * 0.02 * (1 - f * 0.6), h * (y + len * 0.28), 0, true);
            m.castShadow = false;
            m.rotation.z = side * (0.26 - f * 0.19);
            inst.flames.push({
                mesh: m, sx: 1, sy: 1, sz: 1,
                speed: 6 + i * 1.1, phase: i * 1.7, amt: 0.28, sway: 0.13, base: m.rotation.z,
            });
        }
        // crown of hot tips above the blade
        for (let i = 0; i < 3; i++) {
            const t = this._part(g, this.cone(h * 0.024, h * 0.24, 5), mats[i === 1 ? 2 : 1],
                (i - 1) * h * 0.026, h * (y1 + 0.09), 0, true);
            t.castShadow = false;
            t.rotation.z = (i - 1) * 0.22;
            inst.flames.push({
                mesh: t, sx: 1, sy: 1, sz: 1,
                speed: 9 + i * 2, phase: i * 2.3, amt: 0.4, sway: 0.16, base: t.rotation.z,
            });
        }
    },

    _buildWeapon(inst, type, h, accent, fx) {
        const g = new THREE.Group();
        const metal = () => this._mat(inst, 0x93a1b2, { metal: 0.7 });
        const wood = () => this._mat(inst, 0x6e4a28, { rough: 0.9 });
        const glowMat = () => this._mat(inst, accent, { emissive: accent, glow: 2.2, rough: 0.4 });

        switch (type) {
            case 'sword': {
                this._part(g, this.box(h * 0.045, h * 0.42, h * 0.012), metal(), 0, h * 0.26, 0);
                this._part(g, this.box(h * 0.13, h * 0.03, h * 0.03), wood(), 0, h * 0.05, 0);
                this._part(g, this.box(h * 0.03, h * 0.1, h * 0.03), wood(), 0, -h * 0.03, 0);
                break;
            }
            case 'glowsword': {
                this._part(g, this.box(h * 0.05, h * 0.44, h * 0.014), glowMat(), 0, h * 0.27, 0);
                this._part(g, this.box(h * 0.14, h * 0.03, h * 0.035), metal(), 0, h * 0.05, 0);
                this._part(g, this.box(h * 0.03, h * 0.1, h * 0.03), wood(), 0, -h * 0.03, 0);
                break;
            }
            case 'axe': {
                const am = metal();
                this._part(g, this.cyl(h * 0.03, h * 0.035, h * 0.42), wood(), 0, h * 0.16, 0);
                this._part(g, this.box(h * 0.16, h * 0.13, h * 0.05), am, h * 0.07, h * 0.3, 0);
                // wedge cheek so it reads as an axe head, not a paddle
                const edge = this._part(g, this.cone(h * 0.075, h * 0.1, 4), am, h * 0.155, h * 0.3, 0);
                edge.rotation.z = -Math.PI / 2;
                break;
            }
            case 'hammer': {
                this._part(g, this.cyl(h * 0.028, h * 0.034, h * 0.45), wood(), 0, h * 0.17, 0);
                this._part(g, this.box(h * 0.12, h * 0.15, h * 0.12), metal(), 0, h * 0.36, 0);
                break;
            }
            case 'glowhammer': {
                this._part(g, this.cyl(h * 0.028, h * 0.034, h * 0.45), wood(), 0, h * 0.17, 0);
                this._part(g, this.box(h * 0.13, h * 0.16, h * 0.13), glowMat(), 0, h * 0.36, 0);
                break;
            }
            case 'scythe': {
                this._part(g, this.cyl(h * 0.024, h * 0.028, h * 0.72), wood(), 0, h * 0.28, 0);
                const blade = this._part(g, this.box(h * 0.3, h * 0.04, h * 0.02), metal(), h * 0.14, h * 0.6, 0);
                blade.rotation.z = -0.35;
                break;
            }
            case 'spear': {
                this._part(g, this.cyl(h * 0.022, h * 0.022, h * 0.85), wood(), 0, h * 0.3, 0);
                this._part(g, this.cone(h * 0.045, h * 0.14, 5), metal(), 0, h * 0.78, 0);
                break;
            }
            case 'club': {
                this._part(g, this.cyl(h * 0.06, h * 0.028, h * 0.45), wood(), 0, h * 0.2, 0);
                break;
            }
            case 'bow': {
                const bow = this._part(g, this.torusArc(h * 0.22, h * 0.022), wood(), 0, h * 0.1, 0);
                bow.rotation.z = Math.PI / 2;
                break;
            }
            case 'staff': {
                this._part(g, this.cyl(h * 0.028, h * 0.028, h * 0.7), wood(), 0, h * 0.22, 0);
                const orb = this._part(g, this.sph(h * 0.06, 6), glowMat(), 0, h * 0.6, 0, true);
                orb.castShadow = false;
                inst.parts.orb = orb;
                break;
            }
            // Lich art: staff crowned with a glowing blue skull
            case 'skullstaff': {
                this._part(g, this.cyl(h * 0.026, h * 0.03, h * 0.78), this._mat(inst, 0x3a2c22, { rough: 0.9 }), 0, h * 0.25, 0);
                const sk = this._mat(inst, accent, { emissive: accent, glow: 1.3 });
                const skull = this._part(g, this.box(h * 0.1, h * 0.095, h * 0.09), sk, 0, h * 0.68, 0, true);
                skull.castShadow = false;
                const jaw = this._part(g, this.box(h * 0.075, h * 0.03, h * 0.075), sk, 0, h * 0.615, h * 0.008, true);
                jaw.castShadow = false;
                const socket = this._mat(inst, 0x0d1a2c);
                for (const side of [-1, 1]) {
                    this._part(g, this.box(h * 0.025, h * 0.028, h * 0.02), socket, side * h * 0.024, h * 0.69, h * 0.048, true);
                }
                inst.parts.orb = skull;
                break;
            }
            // Skeleton Lord art: broad two-hander with a cold steel blade
            case 'greatsword': {
                const blade = this._mat(inst, accent, { emissive: accent, glow: 0.3, metal: 0.6 });
                const b = this._part(g, this.box(h * 0.072, h * 0.46, h * 0.022), blade, 0, h * 0.33, 0);
                this._part(g, this.cone(h * 0.05, h * 0.12, 4), blade, 0, h * 0.61, 0);
                // fuller down the centre of the blade
                this._part(g, this.box(h * 0.022, h * 0.4, h * 0.03), this._mat(inst, this._shade(accent, 0.6)), 0, h * 0.33, 0, true);
                this._part(g, this.box(h * 0.2, h * 0.035, h * 0.045), metal(), 0, h * 0.08, 0);
                this._part(g, this.box(h * 0.06, h * 0.05, h * 0.06), metal(), 0, h * 0.115, 0);
                this._part(g, this.box(h * 0.035, h * 0.14, h * 0.035), this._mat(inst, 0x2e2820, { rough: 0.9 }), 0, 0, 0);
                this._pulse(inst, b, 0.3, 2.2, 0.7);
                if (fx === 'frost') {
                    // Rime crystals growing off both edges of the blade
                    const ice = this._mat(inst, 0xcdeeff, { emissive: 0x66bbff, glow: 1.5 });
                    for (let i = 0; i < 5; i++) {
                        const side = i % 2 ? 1 : -1;
                        const shard = this._part(g, this.cone(h * 0.018, h * 0.09 + (i % 3) * h * 0.03, 4), ice,
                            side * h * 0.042, h * (0.18 + i * 0.1), 0, true);
                        shard.rotation.z = side * 1.9;
                        shard.castShadow = false;
                        this._pulse(inst, shard, 1.5, 2 + i * 0.6, 0.4);
                    }
                    this._fxAnchor(inst, g, h * 0.33);
                }
                break;
            }
            // Demon Lord art: single molten blade wreathed in fire
            case 'flamesword': {
                // Blade stays a saturated molten orange. Pushing its emissive
                // higher tone-maps to cream and merges with the flame, which
                // is what turned this into one shapeless blob.
                const hot = this._mat(inst, 0xe85a10, { emissive: 0xc23c04, glow: 0.9 });
                const b = this._part(g, this.box(h * 0.052, h * 0.66, h * 0.02), hot, 0, h * 0.42, 0, true);
                b.castShadow = false;
                const tip = this._part(g, this.cone(h * 0.038, h * 0.14, 4), hot, 0, h * 0.81, 0, true);
                tip.castShadow = false;
                this._part(g, this.box(h * 0.02, h * 0.6, h * 0.026),
                    this._mat(inst, 0xffb648, { emissive: 0xff8c14, glow: 1.4 }), 0, h * 0.42, 0, true);
                this._flameSheath(inst, g, h, 0.1, 0.78, 'fire');
                if (fx === 'fire') this._fxAnchor(inst, g, h * 0.5);
                this._part(g, this.box(h * 0.17, h * 0.04, h * 0.05), this._mat(inst, 0x2a1a16, { metal: 0.5 }), 0, h * 0.07, 0);
                this._part(g, this.box(h * 0.035, h * 0.14, h * 0.035), this._mat(inst, 0x2a1a16), 0, 0, 0);
                break;
            }
        }
        return g;
    },

    // ============================================================
    // HUMANOID - shared rig for player classes and humanoid mobs
    // cfg: { h, skin, primary, secondary, accent, bulk, weapon, dual,
    //        shield, helmet('cap'|'horned'|'winged'), hood, hat, crown,
    //        horns, tail, cape, robe, eyes }
    // ============================================================

    _buildHumanoid(inst, cfg) {
        const h = cfg.h;
        const bulk = cfg.bulk || 1;
        const skin = cfg.skin || 0xd9a878;
        const primary = cfg.primary;
        const secondary = cfg.secondary !== undefined ? cfg.secondary : this._shade(primary, 0.68);
        const accent = cfg.accent !== undefined ? cfg.accent : 0xffcc55;

        // Two proportion profiles. Players are chibi (~3 heads) to match the
        // painted class art; bosses are heroic (~6.5 heads) to match theirs —
        // sharing one profile made the boss lords read as stubby children.
        const heroic = !!cfg.heroic;
        const legH = h * (heroic ? 0.42 : 0.26);
        const torsoH = h * (heroic ? 0.34 : 0.30);
        const headR = h * (heroic ? 0.086 : 0.17);
        const torsoW = h * (heroic ? 0.25 : 0.30) * bulk;
        const torsoD = h * (heroic ? 0.145 : 0.17) * bulk;
        const armW = h * (heroic ? 0.066 : 0.08) * bulk;
        const armLen = h * (heroic ? 0.36 : 0.26);
        const legW = h * (heroic ? 0.088 : 0.10) * bulk;

        const body = inst.body;
        const P = inst.parts;
        const matP = this._mat(inst, primary);
        const matS = this._mat(inst, secondary);
        const matSkin = this._mat(inst, skin);

        // Legs (or robe skirt)
        if (cfg.robe) {
            const skirt = this._part(body, this.cyl(torsoW * 0.42, torsoW * 0.72, legH + torsoH * 0.35, 8), matP, 0, (legH + torsoH * 0.35) / 2, 0);
            P.skirt = skirt;
        } else {
            for (const side of [-1, 1]) {
                const leg = new THREE.Group();
                leg.position.set(side * torsoW * 0.26, legH, 0);
                this._part(leg, this.box(legW, legH, legW), matS, 0, -legH / 2, 0);
                if (heroic) {
                    // Long legs need a boot break or they read as bare poles
                    this._part(leg, this.box(legW * 1.25, legH * 0.28, legW * 1.5), matP, 0, -legH * 0.88, legW * 0.15);
                    this._part(leg, this.box(legW * 1.3, legH * 0.1, legW * 1.3), matP, 0, -legH * 0.5, 0);
                }
                body.add(leg);
                P[side < 0 ? 'legL' : 'legR'] = leg;
            }
        }

        // Tabard: cloth panel hanging over the legs (both lords wear one)
        if (cfg.tabard !== undefined) {
            const tm = this._mat(inst, cfg.tabard);
            this._part(body, this.box(torsoW * 0.5, legH * 1.15, torsoD * 0.12), tm, 0, legH * 0.5, torsoD * 0.52);
            this._part(body, this.box(torsoW * 0.62, legH * 1.0, torsoD * 0.12), tm, 0, legH * 0.45, -torsoD * 0.52);
        }

        // Torso + belt
        const torso = new THREE.Group();
        torso.position.y = legH;
        this._part(torso, this.box(torsoW, torsoH, torsoD), matP, 0, torsoH / 2, 0);
        this._part(torso, this.box(torsoW * 1.02, torsoH * 0.14, torsoD * 1.02), matS, 0, torsoH * 0.18, 0);
        // Exposed ribcage + spine for the undead
        if (cfg.ribs) {
            const boneM = this._mat(inst, cfg.boneColor || this._shade(skin, 0.94));
            for (let i = 0; i < 4; i++) {
                const y = torsoH * (0.34 + i * 0.15);
                const w = torsoW * (0.9 - i * 0.07);
                this._part(torso, this.box(w, torsoH * 0.07, torsoD * 1.06), boneM, 0, y, 0);
            }
            this._part(torso, this.box(torsoW * 0.14, torsoH * 0.62, torsoD * 1.1), boneM, 0, torsoH * 0.5, 0);
        }
        // Layered plate over the chest for the armored bosses
        if (cfg.plates) {
            this._part(torso, this.box(torsoW * 0.92, torsoH * 0.3, torsoD * 1.14), matS, 0, torsoH * 0.72, 0);
            this._part(torso, this.box(torsoW * 0.7, torsoH * 0.22, torsoD * 1.16), matP, 0, torsoH * 0.46, 0);
            this._part(torso, this.box(torsoW * 0.28, torsoH * 0.5, torsoD * 1.2),
                this._mat(inst, cfg.trim !== undefined ? cfg.trim : accent), 0, torsoH * 0.55, 0);
        }
        // Molten cracks glowing through the plate (Demon Lord)
        if (cfg.embers) {
            const em = this._mat(inst, cfg.embers, { emissive: cfg.embers, glow: 1.6 });
            for (const c of [[-0.22, 0.62, 0.5], [0.26, 0.5, 0.34], [-0.1, 0.34, 0.62], [0.14, 0.72, 0.3]]) {
                const crack = this._part(torso, this.box(torsoW * c[2] * 0.4, torsoH * 0.045, torsoD * 0.06),
                    em, torsoW * c[0], torsoH * c[1], torsoD * 0.62, true);
                crack.rotation.z = c[0] > 0 ? -0.5 : 0.5;
                crack.castShadow = false;
                this._pulse(inst, crack, 1.6, 1.6 + Math.random(), 0.5);
            }
        }
        body.add(torso);
        P.torso = torso;

        // Head: big chibi cube with a real face; headgear sits ABOVE the
        // brow line so the face always stays visible (matches the art)
        const head = new THREE.Group();
        head.position.y = torsoH + headR * (heroic ? 0.5 : 0.15);
        this._part(head, this.box(headR * 2.3, headR * 1.95, headR * 2.2), matSkin, 0, headR * 0.85, 0);

        // Eyes: glowing (spooky), hollow sockets (undead), or cartoon white+pupil
        if (cfg.eyeGlow) {
            const eyeMat = this._mat(inst, cfg.eyes, { emissive: cfg.eyes, glow: 2.2 });
            for (const side of [-1, 1]) {
                const e = this._part(head, this.box(headR * 0.34, headR * 0.4, headR * 0.1), eyeMat, side * headR * 0.5, headR * 0.95, headR * 1.06, true);
                e.castShadow = false;
            }
        } else if (cfg.sockets) {
            // Real skull: deep sockets under a brow, plus a toothed jaw
            const eyeMat = this._mat(inst, 0x141110);
            const boneD = this._mat(inst, this._shade(skin, 0.82));
            for (const side of [-1, 1]) {
                this._part(head, this.box(headR * 0.42, headR * 0.46, headR * 0.12), eyeMat, side * headR * 0.48, headR * 0.98, headR * 1.02);
                this._part(head, this.box(headR * 0.5, headR * 0.16, headR * 0.16), boneD, side * headR * 0.5, headR * 1.28, headR * 0.99);
                this._part(head, this.box(headR * 0.3, headR * 0.34, headR * 0.14), boneD, side * headR * 0.72, headR * 0.62, headR * 0.95);
            }
            this._part(head, this.box(headR * 0.22, headR * 0.2, headR * 0.14), eyeMat, 0, headR * 0.66, headR * 1.04);
            const jaw = this._part(head, this.box(headR * 1.35, headR * 0.3, headR * 1.1), boneD, 0, headR * 0.12, headR * 0.2);
            for (let i = -2; i <= 2; i++) {
                this._part(head, this.box(headR * 0.13, headR * 0.16, headR * 0.1), matSkin, i * headR * 0.24, headR * 0.34, headR * 0.98, true);
            }
            P.jaw = jaw;
        } else {
            const sclera = this._mat(inst, 0xf5f0e8);
            const pupil = this._mat(inst, cfg.eyes || 0x241a14);
            for (const side of [-1, 1]) {
                this._part(head, this.box(headR * 0.55, headR * 0.6, headR * 0.1), sclera, side * headR * 0.5, headR * 0.95, headR * 1.06);
                this._part(head, this.box(headR * 0.26, headR * 0.32, headR * 0.08), pupil, side * headR * 0.44, headR * 0.9, headR * 1.13);
            }
        }

        const hasHeadgear = cfg.helmet || cfg.hood || cfg.hat;
        if (!hasHeadgear && cfg.hair !== false) {
            const hairMat = this._mat(inst, cfg.hairColor || 0x54351e);
            this._part(head, this.box(headR * 2.4, headR * 0.55, headR * 2.3), hairMat, 0, headR * 1.72, 0);
            this._part(head, this.box(headR * 2.4, headR * 0.4, headR * 0.35), hairMat, 0, headR * 1.42, headR * 0.98);
        }
        if (cfg.helmet) {
            const hm = this._mat(inst, this._shade(primary, 0.85), { rough: 0.35, metal: 0.65 });
            this._part(head, this.box(headR * 2.5, headR * 0.85, headR * 2.4), hm, 0, headR * 1.62, 0);
            for (const side of [-1, 1]) {
                this._part(head, this.box(headR * 0.2, headR * 1.0, headR * 2.3), hm, side * headR * 1.2, headR * 0.75, 0);
            }
            if (cfg.helmet === 'horned' || cfg.helmet === 'winged') {
                const hornMat = this._mat(inst, cfg.helmet === 'winged' ? accent : 0xe8e0d0, { rough: 0.5 });
                for (const side of [-1, 1]) {
                    const horn = this._part(head, this.cone(headR * 0.28, headR * 1.0, 5), hornMat, side * headR * 1.3, headR * 1.95, 0);
                    horn.rotation.z = -side * 0.5;
                }
            }
        }
        if (cfg.hood) {
            // Open-faced cowl: cap + side flaps + back drape + tilted peak
            const hd = this._mat(inst, this._shade(primary, 0.45));
            this._part(head, this.box(headR * 2.55, headR * 0.9, headR * 2.45), hd, 0, headR * 1.62, 0);
            for (const side of [-1, 1]) {
                this._part(head, this.box(headR * 0.22, headR * 1.1, headR * 2.3), hd, side * headR * 1.22, headR * 0.7, -headR * 0.05);
            }
            this._part(head, this.box(headR * 2.4, headR * 1.6, headR * 0.4), hd, 0, headR * 0.9, -headR * 1.15);
            const peak = this._part(head, this.cone(headR * 0.9, headR * 1.3, 5), hd, 0, headR * 2.4, -headR * 0.3);
            peak.rotation.x = -0.35;
        }
        if (cfg.hat) {
            const hm = this._mat(inst, this._shade(primary, 0.6));
            this._part(head, this.cyl(headR * 2.0, headR * 2.0, headR * 0.16, 9), hm, 0, headR * 1.8, 0);
            this._part(head, this.cone(headR * 1.1, headR * 2.4, 8), hm, 0, headR * 3.0, 0);
        }
        if (cfg.crown) {
            const cm = this._mat(inst, 0xf5c542, { rough: 0.3, metal: 0.8, emissive: 0xf5c542, glow: 0.35 });
            this._part(head, this.cyl(headR * 1.05, headR * 1.05, headR * 0.5, 6), cm, 0, headR * 1.75, 0);
        }
        // Skeleton Lord art: a broken, irregular crown of bone spikes
        if (cfg.spikeCrown) {
            const cm = this._mat(inst, cfg.crownColor || 0xa89a72, { metal: 0.4 });
            this._part(head, this.cyl(headR * 1.0, headR * 1.05, headR * 0.34, 8), cm, 0, headR * 1.72, 0);
            const spikes = [1.0, 0.62, 0.85, 0.55, 0.9, 0.68];
            for (let i = 0; i < spikes.length; i++) {
                const a = (i / spikes.length) * Math.PI * 2;
                const sp = this._part(head, this.cone(headR * 0.15, headR * spikes[i], 4), cm,
                    Math.sin(a) * headR * 0.82, headR * (1.9 + spikes[i] * 0.5), Math.cos(a) * headR * 0.82);
                sp.rotation.z = -Math.sin(a) * 0.22;
                sp.rotation.x = Math.cos(a) * 0.22;
            }
        }
        // Demon Lord art: massive bull horns sweeping out then up, over a
        // browed, jawed face rather than a flat plate
        if (cfg.bullHorns) {
            const brow = this._mat(inst, this._shade(skin, 0.62));
            this._part(head, this.box(headR * 2.2, headR * 0.3, headR * 0.3), brow, 0, headR * 1.22, headR * 1.0);
            this._part(head, this.box(headR * 1.5, headR * 0.42, headR * 0.34), brow, 0, headR * 0.16, headR * 0.98);
            for (const side of [-1, 1]) {
                this._part(head, this.cone(headR * 0.1, headR * 0.22, 4), brow,
                    side * headR * 0.44, headR * 0.34, headR * 1.02);
            }
            const hm = this._mat(inst, cfg.hornColor || 0x5c4c44, { metal: 0.3 });
            for (const side of [-1, 1]) {
                const base = this._part(head, this.cone(headR * 0.46, headR * 1.5, 6), hm,
                    side * headR * 1.15, headR * 1.5, -headR * 0.1);
                base.rotation.z = -side * 1.15;
                const mid = this._part(head, this.cone(headR * 0.34, headR * 1.35, 6), hm,
                    side * headR * 2.05, headR * 2.05, -headR * 0.1);
                mid.rotation.z = -side * 0.55;
                const tip = this._part(head, this.cone(headR * 0.2, headR * 1.15, 5), hm,
                    side * headR * 2.35, headR * 2.95, -headR * 0.1);
                tip.rotation.z = -side * 0.12;
            }
        }
        if (cfg.horns) {
            const hornMat = this._mat(inst, 0x30241c, { rough: 0.6 });
            for (const side of [-1, 1]) {
                const horn = this._part(head, this.cone(headR * 0.34, headR * 1.5, 5), hornMat, side * headR * 1.05, headR * 2.0, 0);
                horn.rotation.z = -side * 0.5;
                horn.rotation.x = -0.15;
            }
        }
        torso.add(head);
        P.head = head;

        // Arms + shoulder pads
        for (const side of [-1, 1]) {
            const arm = new THREE.Group();
            arm.position.set(side * (torsoW / 2 + armW * 0.55), torsoH * 0.92, 0);
            this._part(arm, this.box(armW * 1.15, armLen, armW * 1.15), matP, 0, -armLen / 2, 0);
            this._part(arm, this.box(armW * 0.95, armLen * 0.22, armW * 0.95), matSkin, 0, -armLen * 0.95, 0);
            if (cfg.pads) {
                this._part(arm, this.box(armW * 1.7, armW * 1.1, armW * 1.7), matS, 0, armLen * 0.08, 0);
            }
            // Flared, spiked pauldrons — the silhouette cue for both boss lords
            if (cfg.spikePads) {
                this._part(arm, this.cyl(armW * 1.75, armW * 2.6, armW * 1.6, 6), matS, 0, armLen * 0.1, 0);
                for (const a of [-0.5, 0.5]) {
                    const sp = this._part(arm, this.cone(armW * 0.44, armW * 1.25, 4), matS,
                        side * armW * 1.45, armLen * 0.24, a * armW * 1.1);
                    sp.rotation.z = -side * 0.55;
                }
            }
            torso.add(arm);
            P[side < 0 ? 'armL' : 'armR'] = arm;
        }

        // Cape: hangs from the shoulders, sways in update()
        if (cfg.cape) {
            const cape = new THREE.Group();
            cape.position.set(0, torsoH * 0.98, -torsoD * 0.55);
            const cm = this._mat(inst, cfg.capeColor || this._shade(primary, 0.4));
            // Heroic capes reach the floor and flare past the shoulders so
            // they still read from the front
            const capeLen = heroic ? (legH + torsoH) * 0.95 : h * 0.42;
            const capeW = torsoW * (heroic ? 1.25 : 0.95);
            this._part(cape, this.box(capeW, capeLen, h * 0.015), cm, 0, -capeLen / 2, 0);
            if (heroic) {
                for (const side of [-1, 1]) {
                    const fold = this._part(cape, this.box(capeW * 0.34, capeLen * 0.95, h * 0.014), cm,
                        side * capeW * 0.52, -capeLen * 0.5, h * 0.02);
                    fold.rotation.z = side * 0.09;
                }
                // Frayed hem — a clean rectangle reads as cardboard
                for (let i = -2; i <= 2; i++) {
                    const rag = this._part(cape, this.cone(capeW * 0.13, capeLen * (0.1 + (Math.abs(i) % 2) * 0.09), 4),
                        cm, i * capeW * 0.24, -capeLen * 1.02, 0);
                    rag.rotation.x = Math.PI;
                }
            }
            torso.add(cape);
            P.cape = cape;
        }

        // Tail (imps, demons)
        if (cfg.tail) {
            const tail = new THREE.Group();
            tail.position.set(0, legH * 0.35, -torsoD * 0.5);
            const tm = this._part(tail, this.cone(h * 0.035, h * 0.4, 5), matSkin, 0, 0, -h * 0.18);
            tm.rotation.x = Math.PI / 2 + 0.5;
            body.add(tail);
            P.tail = tail;
        }

        // Weapon in right hand, optional dual/shield on left
        if (cfg.weapon && cfg.weapon !== 'none') {
            // Chunky oversized weapons. Melee gear rests angled well forward —
            // straight up puts the blade beside the head where it reads as a
            // floating block rather than a held weapon.
            const tilt = (cfg.weapon === 'staff' || cfg.weapon === 'bow') ? 0 : 0.62;
            const w = this._buildWeapon(inst, cfg.weapon, h, accent, cfg.weaponFx);
            inst.weaponFx = cfg.weaponFx;
            w.position.y = -armLen * 0.92;
            w.scale.setScalar(1.35);
            w.rotation.x = tilt;
            P.armR.add(w);
            P.weaponR = w;
            if (cfg.dual) {
                const w2 = this._buildWeapon(inst, cfg.weapon, h, accent);
                w2.position.y = -armLen * 0.92;
                w2.scale.set(-1.35, 1.35, 1.35); // mirror so the blade faces outward
                w2.rotation.x = tilt;
                P.armL.add(w2);
                P.weaponL = w2;
            }
        }
        if (cfg.shield) {
            const sm = this._mat(inst, secondary, { rough: 0.45, metal: 0.4 });
            const bossMat = this._mat(inst, accent, { emissive: accent, glow: 0.5 });
            const shield = new THREE.Group();
            shield.position.set(-armW * 0.9, -armLen * 0.62, 0);
            if (cfg.shield === 'tower') {
                this._part(shield, this.box(h * 0.05, h * 0.42, h * 0.26), sm, 0, 0, 0);
                this._part(shield, this.box(h * 0.055, h * 0.1, h * 0.06), bossMat, 0, 0, 0);
            } else {
                const disc = this._part(shield, this.cyl(h * 0.15, h * 0.15, h * 0.035, 8), sm, 0, 0, 0);
                disc.rotation.z = Math.PI / 2;
                const bump = this._part(shield, this.sph(h * 0.045, 6), bossMat, -h * 0.025, 0, 0);
                bump.castShadow = false;
            }
            P.armL.add(shield);
        }

        inst.animKind = 'humanoid';
        inst.dims = { h, legH, torsoH, armLen };
    },

    // ============================================================
    // NON-HUMANOID RIGS
    // ============================================================

    _buildSlime(inst, cfg) {
        const h = cfg.h;
        const matB = this._mat(inst, cfg.primary, { rough: 0.3 });
        matB.transparent = true;
        matB.opacity = 0.92;
        // The king is a tall bell/teardrop, not a ball (see Slimeking art)
        const blob = cfg.king
            ? this._part(inst.body, this.cyl(h * 0.26, h * 0.46, h * 0.8, 12), matB, 0, h * 0.4, 0)
            : this._part(inst.body, this.sph(h * 0.5, 9), matB, 0, h * 0.42, 0);
        if (!cfg.king) blob.scale.y = 0.82;
        inst.parts.blob = blob;
        if (cfg.king) {
            const cap = this._part(inst.body, this.sph(h * 0.3, 10), matB, 0, h * 0.78, 0);
            cap.scale.y = 0.72;
        }

        // The king's art has small beady eyes, not the cartoon saucers the
        // lesser slimes get
        const eyeH = cfg.king ? h * 0.76 : h * 0.52;
        const eyeZ = cfg.king ? h * 0.22 : h * 0.38;
        const eyeR = cfg.king ? h * 0.105 : h * 0.17;
        const eyeS = cfg.king ? 0.052 : 0.08;
        const eyeW = this._mat(inst, 0xffffff);
        const eyeB = this._mat(inst, 0x181418);
        for (const side of [-1, 1]) {
            this._part(inst.body, this.sph(h * eyeS, 6), eyeW, side * eyeR, eyeH, eyeZ);
            this._part(inst.body, this.sph(h * eyeS * 0.55, 5), eyeB, side * eyeR, eyeH, eyeZ + h * 0.035);
        }

        if (cfg.cape) {
            // Heavy gold cape down the back — the king's clearest silhouette cue
            const cm = this._mat(inst, cfg.capeColor || 0xd4a843);
            const cape = new THREE.Group();
            cape.position.set(0, h * 0.88, -h * 0.2);
            this._part(cape, this.box(h * 0.72, h * 0.13, h * 0.16), cm, 0, 0, 0);
            const panel = this._part(cape, this.box(h * 0.64, h * 0.82, h * 0.06), cm, 0, -h * 0.44, -h * 0.02);
            panel.rotation.x = -0.1;
            for (const t of [-1, 0, 1]) {
                this._part(cape, this.cone(h * 0.11, h * 0.2, 4), cm, t * h * 0.21, -h * 0.9, -h * 0.06);
            }
            inst.body.add(cape);
            inst.parts.cape = cape;
        }
        if (cfg.crown) {
            const cm = this._mat(inst, 0xf0c850, { metal: 0.8, emissive: 0xf5c542, glow: 0.3 });
            const y = cfg.king ? h * 1.0 : h * 0.86;
            inst.parts.crown = this._part(inst.body, this.cyl(h * 0.17, h * 0.19, h * 0.09, 8), cm, 0, y, 0);
            for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2;
                this._part(inst.body, this.cone(h * 0.05, h * 0.15, 4), cm,
                    Math.sin(a) * h * 0.16, y + h * 0.11, Math.cos(a) * h * 0.16);
            }
        }
        inst.animKind = 'slime';
        inst.dims = { h };
    },

    // Slime King gets his own build: a smooth cone reads as a gumdrop, so the
    // body is overlapping spheres with base lobes, hanging drips and a gloss
    // highlight — the lumpy, wet silhouette is what says "slime".
    _buildSlimeKing(inst, cfg) {
        const h = cfg.h;
        const P = inst.parts;
        const body = inst.body;
        const green = cfg.primary;
        const matB = this._mat(inst, green);
        const matDark = this._mat(inst, this._shade(green, 0.72));
        const matLight = this._mat(inst, this._shade(green, 1.6));

        // Stacked, deeply-overlapping spheres give an organic outline.
        // Taller than wide, matching the art's proportions.
        P.base = this._part(body, this.sph(h * 0.40, 12), matB, 0, h * 0.36, 0);
        P.base.scale.set(1.02, 0.84, 0.98);
        P.mid = this._part(body, this.sph(h * 0.345, 12), matB, 0, h * 0.62, 0);
        P.mid.scale.set(1.0, 0.95, 1.0);
        P.dome = this._part(body, this.sph(h * 0.28, 12), matB, 0, h * 0.84, 0);

        // Shoulder bulges — the art has clear lumps where the cape sits
        for (const side of [-1, 1]) {
            this._part(body, this.sph(h * 0.15, 9), matB, side * h * 0.27, h * 0.66, 0);
        }

        // Lobes pooling at the base + drips running down the sides
        P.lobes = [];
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2 + 0.4;
            const r = h * (0.095 + (i % 3) * 0.025);
            const lobe = this._part(body, this.sph(r, 8), matB,
                Math.sin(a) * h * 0.38, h * 0.1, Math.cos(a) * h * 0.38);
            lobe.scale.y = 0.72;
            P.lobes.push(lobe);
        }
        P.drips = [];
        for (const d of [[-0.4, 0.34], [0.41, 0.28], [-0.19, 0.48]]) {
            const drip = this._part(body, this.sph(h * 0.07, 8), matB, h * d[0], h * d[1], h * 0.14);
            drip.scale.set(0.9, 1.9, 0.9);
            P.drips.push(drip);
        }

        // Wet highlight — the single strongest "this is goo" cue
        const hi = this._part(body, this.sph(h * 0.1, 9), matLight, -h * 0.12, h * 0.92, h * 0.12, true);
        hi.scale.set(1, 0.6, 0.7);
        hi.castShadow = false;
        const hi2 = this._part(body, this.sph(h * 0.05, 7), matLight, -h * 0.26, h * 0.68, h * 0.2, true);
        hi2.castShadow = false;

        // Face. Depths are set from the local surface radius — anything
        // shallower sinks inside the blob and vanishes.
        const eyeW = this._mat(inst, 0xf4f4ec);
        const eyeB = this._mat(inst, 0x14210f);
        for (const side of [-1, 1]) {
            this._part(body, this.sph(h * 0.052, 8), eyeW, side * h * 0.1, h * 0.88, h * 0.235);
            this._part(body, this.sph(h * 0.028, 6), eyeB, side * h * 0.103, h * 0.875, h * 0.275, true);
        }
        const mouth = this._part(body, this.sph(h * 0.055, 8), eyeB, 0, h * 0.755, h * 0.3, true);
        mouth.scale.set(1.8, 0.6, 0.45);
        mouth.castShadow = false;

        // Gold cape: collar ring plus panels that read from the front
        const gold = this._mat(inst, cfg.capeColor || 0xd4a843);
        const goldDark = this._mat(inst, this._shade(cfg.capeColor || 0xd4a843, 0.72));
        // Mantle sits BEHIND and on top of the shoulders. A full collar ring
        // at head height reads as a scarf across the face.
        const cape = new THREE.Group();
        cape.position.set(0, h * 0.7, 0);
        this._part(cape, this.box(h * 0.62, h * 0.16, h * 0.26), gold, 0, h * 0.02, -h * 0.2);
        // Pads must clear the shoulder bulges or the gold never shows in front
        for (const side of [-1, 1]) {
            const pad = this._part(cape, this.sph(h * 0.19, 9), gold, side * h * 0.36, h * 0.01, -h * 0.02);
            pad.scale.set(1, 0.55, 1.05);
        }
        this._part(cape, this.box(h * 0.58, h * 0.8, h * 0.05), gold, 0, -h * 0.42, -h * 0.32);
        for (const side of [-1, 1]) {
            const panel = this._part(cape, this.box(h * 0.22, h * 0.66, h * 0.05), goldDark,
                side * h * 0.38, -h * 0.34, -h * 0.16);
            panel.rotation.y = -side * 0.7;
        }
        body.add(cape);
        P.cape = cape;

        // Crown: rounded points on a band, with a jewel
        const cm = this._mat(inst, 0xf0c850, { metal: 0.8, emissive: 0xf5c542, glow: 0.3 });
        this._part(body, this.cyl(h * 0.15, h * 0.17, h * 0.08, 10), cm, 0, h * 1.02, 0);
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            const pt = this._part(body, this.cone(h * 0.045, h * 0.13, 5), cm,
                Math.sin(a) * h * 0.14, h * 1.11, Math.cos(a) * h * 0.14);
            pt.rotation.z = -Math.sin(a) * 0.2;
            pt.rotation.x = Math.cos(a) * 0.2;
        }
        this._part(body, this.sph(h * 0.045, 7), this._mat(inst, 0xff5566, { emissive: 0xcc2233, glow: 1.2 }),
            0, h * 1.08, h * 0.13, true);

        inst.animKind = 'slimeking';
        inst.dims = { h };
    },

    _buildElemental(inst, cfg) {
        const h = cfg.h;
        const core = this._part(inst.body, this.sph(h * 0.26, 7),
            this._mat(inst, 0xffdd66, { emissive: 0xffaa22, glow: 2.6, rough: 0.4 }), 0, h * 0.5, 0, true);
        core.castShadow = false;
        inst.parts.blob = core;
        const flameMat = this._mat(inst, 0xff6611, { emissive: 0xff4400, glow: 1.8, rough: 0.6 });
        flameMat.transparent = true;
        flameMat.opacity = 0.85;
        inst.parts.flames = [];
        for (let i = 0; i < 5; i++) {
            const f = this._part(inst.body, this.cone(h * 0.11, h * 0.4, 5), flameMat,
                Math.sin(i * 2.4) * h * 0.16, h * 0.62, Math.cos(i * 2.4) * h * 0.16, true);
            f.castShadow = false;
            inst.parts.flames.push(f);
        }
        const eyeB = this._mat(inst, 0x331100);
        for (const side of [-1, 1]) {
            this._part(inst.body, this.sph(h * 0.05, 5), eyeB, side * h * 0.1, h * 0.55, h * 0.22);
        }
        inst.animKind = 'elemental';
        inst.dims = { h };
    },

    _buildDragon(inst, cfg) {
        const h = cfg.h;
        const matP = this._mat(inst, cfg.primary);
        const matS = this._mat(inst, this._shade(cfg.primary, 0.55));
        const matBelly = this._mat(inst, 0xe8cf9a);
        const body = inst.body;
        const P = inst.parts;

        // Bipedal wyvern (per the art): stands upright on two hind legs,
        // wings as arms, long tail counterbalancing behind.

        // Digitigrade hind legs: thigh angled back, shin forward, clawed foot
        for (const side of [-1, 1]) {
            const leg = new THREE.Group();
            leg.position.set(side * h * 0.17, h * 0.46, 0);
            const thigh = this._part(leg, this.box(h * 0.14, h * 0.3, h * 0.17), matP, 0, -h * 0.13, -h * 0.04);
            thigh.rotation.x = -0.3;
            const shin = this._part(leg, this.box(h * 0.09, h * 0.28, h * 0.09), matS, 0, -h * 0.32, h * 0.02);
            shin.rotation.x = 0.25;
            this._part(leg, this.box(h * 0.13, h * 0.06, h * 0.2), matS, 0, -h * 0.44, h * 0.08);
            for (const t of [-1, 0, 1]) {
                this._part(leg, this.cone(h * 0.022, h * 0.06, 4), matBelly, t * h * 0.04, -h * 0.45, h * 0.17);
            }
            body.add(leg);
            P[side < 0 ? 'legL' : 'legR'] = leg;
        }

        // Upright torso, leaning slightly forward, pale belly plates
        const torso = new THREE.Group();
        torso.position.set(0, h * 0.4, 0);
        torso.rotation.x = 0.3;   // crouched forward, as in the idle art
        this._part(torso, this.box(h * 0.28, h * 0.4, h * 0.24), matP, 0, h * 0.2, 0);
        // Belly scutes: banded plates, not one flat panel
        for (let i = 0; i < 5; i++) {
            this._part(torso, this.box(h * (0.16 - i * 0.012), h * 0.045, h * 0.05), matBelly,
                0, h * (0.05 + i * 0.062), h * 0.125);
        }
        this._part(torso, this.box(h * 0.36, h * 0.16, h * 0.22), matP, 0, h * 0.38, 0);
        for (let i = 0; i < 4; i++) {
            const spike = this._part(torso, this.cone(h * 0.045, h * 0.14, 4), matS, 0, h * 0.08 + i * h * 0.12, -h * 0.15);
            spike.rotation.x = -0.5;
        }
        body.add(torso);
        P.torso = torso;

        // Neck rises from the SHOULDERS, not the waist — anchoring it low
        // buries the head in the chest
        const neck = new THREE.Group();
        neck.position.set(0, h * 0.8, h * 0.02);
        const n1 = this._part(neck, this.box(h * 0.15, h * 0.26, h * 0.15), matP, 0, h * 0.12, h * 0.02);
        n1.rotation.x = -0.2;
        const n2 = this._part(neck, this.box(h * 0.13, h * 0.2, h * 0.13), matP, 0, h * 0.3, h * 0.09);
        n2.rotation.x = 0.35;
        this._part(neck, this.box(h * 0.1, h * 0.18, h * 0.05), matBelly, 0, h * 0.2, h * 0.11);

        const head = new THREE.Group();
        head.position.set(0, h * 0.42, h * 0.15);
        head.rotation.x = 0.2;
        this._part(head, this.box(h * 0.2, h * 0.16, h * 0.22), matP, 0, 0, 0);
        this._part(head, this.box(h * 0.14, h * 0.1, h * 0.22), matP, 0, -h * 0.015, h * 0.2);
        const jaw = this._part(head, this.box(h * 0.12, h * 0.045, h * 0.2), matBelly, 0, -h * 0.07, h * 0.2);
        P.jaw = jaw;
        // Teeth along the upper jaw
        for (let i = -2; i <= 2; i++) {
            if (!i) continue;
            const tooth = this._part(head, this.cone(h * 0.014, h * 0.05, 4), matBelly,
                i * h * 0.03, -h * 0.045, h * 0.23 + Math.abs(i) * h * 0.01, true);
            tooth.rotation.x = Math.PI;
        }
        // Brow ridge over the eyes
        for (const side of [-1, 1]) {
            this._part(head, this.box(h * 0.06, h * 0.03, h * 0.12), matS, side * h * 0.085, h * 0.075, h * 0.09);
        }
        const eyeMat = this._mat(inst, 0xffdd22, { emissive: 0xffaa00, glow: 2.4 });
        for (const side of [-1, 1]) {
            const e = this._part(head, this.box(h * 0.045, h * 0.045, h * 0.03), eyeMat, side * h * 0.085, h * 0.04, h * 0.11, true);
            e.castShadow = false;
            // horns sweep BACK off the skull, as in the art
            const horn = this._part(head, this.cone(h * 0.04, h * 0.26, 5), matS, side * h * 0.075, h * 0.1, -h * 0.1);
            horn.rotation.x = -1.05;
            horn.rotation.z = -side * 0.2;
            const jawSpike = this._part(head, this.cone(h * 0.025, h * 0.1, 4), matS, side * h * 0.075, -h * 0.03, -h * 0.02);
            jawSpike.rotation.x = -1.4;
        }
        neck.add(head);
        body.add(neck);
        P.neck = neck; P.head = head;

        // Wings mounted high on the shoulders, spar + membrane + ribs
        for (const side of [-1, 1]) {
            const wing = new THREE.Group();
            wing.position.set(side * h * 0.17, h * 0.8, -h * 0.06);
            wing.rotation.y = side * 0.85;  // angled back, still reading as wings
            wing.rotation.x = -0.35;
            this._part(wing, this.box(h * 0.8, h * 0.06, h * 0.08), matS, side * h * 0.4, 0, 0);
            // Membrane split into panels so it can ripple in flight
            const panels = [];
            for (let i = 0; i < 3; i++) {
                const panel = this._part(wing, this.box(h * 0.26, h * 0.022, h * (0.5 + i * 0.05)), matP,
                    side * h * (0.15 + i * 0.26), -h * 0.04, -h * 0.3);
                panel.rotation.x = 0.18;
                panels.push(panel);
            }
            for (let i = 1; i <= 3; i++) {
                const rib = this._part(wing, this.box(h * 0.028, h * 0.035, h * 0.56), matS, side * h * 0.18 * i, -h * 0.03, -h * 0.3);
                rib.rotation.x = 0.18;
            }
            P[(side < 0 ? 'membL' : 'membR')] = panels;
            const claw = this._part(wing, this.cone(h * 0.035, h * 0.16, 4), matS, side * h * 0.8, 0, 0);
            claw.rotation.z = -side * 1.4;
            body.add(wing);
            P[side < 0 ? 'wingL' : 'wingR'] = wing;
        }

        // Long tail sweeping down and back
        const tail = new THREE.Group();
        tail.position.set(0, h * 0.5, -h * 0.14);
        const t1 = this._part(tail, this.box(h * 0.16, h * 0.15, h * 0.34), matP, 0, -h * 0.06, -h * 0.17);
        t1.rotation.x = 0.35;
        // Second segment is its own group so the tail can wave, not swing rigidly
        const tail2 = new THREE.Group();
        tail2.position.set(0, -h * 0.16, -h * 0.3);
        const t2 = this._part(tail2, this.box(h * 0.11, h * 0.1, h * 0.32), matP, 0, -h * 0.06, -h * 0.12);
        t2.rotation.x = 0.25;
        const tip = this._part(tail2, this.cone(h * 0.06, h * 0.28, 5), matS, 0, -h * 0.14, -h * 0.38);
        tip.rotation.x = -Math.PI / 2 + 0.2;
        for (let i = 0; i < 3; i++) {
            const fin = this._part(tail2, this.cone(h * 0.035, h * 0.1, 4), matS, 0, -h * 0.02 + i * h * 0.01, -h * (0.2 + i * 0.08));
            fin.rotation.x = -0.4;
        }
        tail.add(tail2);
        body.add(tail);
        P.tail = tail; P.tail2 = tail2;

        inst.animKind = 'dragon';
        inst.dims = { h };
    },

    _buildLich(inst, cfg) {
        const h = cfg.h;
        const matRobe = this._mat(inst, cfg.primary);
        const P = inst.parts;
        const body = inst.body;

        const matDark = this._mat(inst, cfg.robeDark || this._shade(cfg.primary, 0.6));

        // Floating tattered robe: tall and narrow, matching the art's
        // silhouette rather than a squat cone
        const robe = this._part(body, this.cyl(h * 0.12, h * 0.25, h * 0.78, 9), matRobe, 0, h * 0.42, 0);
        P.skirt = robe;
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            const rag = this._part(body, this.cone(h * 0.05, h * 0.14 + (i % 3) * h * 0.05, 4), matDark,
                Math.sin(a) * h * 0.22, h * 0.09, Math.cos(a) * h * 0.22);
            rag.rotation.x = Math.PI;
        }
        const torso = new THREE.Group();
        torso.position.y = h * 0.82;
        this._part(torso, this.box(h * 0.24, h * 0.26, h * 0.14), matRobe, 0, 0, 0);
        // shoulder mantle + the blue rune worn on the chest
        this._part(torso, this.box(h * 0.36, h * 0.09, h * 0.19), matDark, 0, h * 0.11, 0);
        const rune = this._part(torso, this.box(h * 0.07, h * 0.08, h * 0.02),
            this._mat(inst, 0x55bbff, { emissive: 0x3399ff, glow: 2.2 }), 0, -h * 0.02, h * 0.09, true);
        rune.castShadow = false;
        this._pulse(inst, rune, 2.2, 2.4, 0.45);
        body.add(torso);
        P.torso = torso;

        // Pale skull under a deep hood — no crown, per the art
        const head = new THREE.Group();
        head.position.y = h * 0.21;
        this._part(head, this.box(h * 0.16, h * 0.16, h * 0.16), this._mat(inst, 0xd6cca4), 0, 0, 0);
        this._part(head, this.box(h * 0.12, h * 0.05, h * 0.14), this._mat(inst, 0xc4b992), 0, -h * 0.08, h * 0.01);
        const socket = this._mat(inst, 0x140f1c);
        for (const side of [-1, 1]) {
            this._part(head, this.box(h * 0.045, h * 0.05, h * 0.02), socket, side * h * 0.042, h * 0.015, h * 0.08, true);
        }
        // hood: cowl over the crown of the skull, open at the face
        this._part(head, this.box(h * 0.2, h * 0.09, h * 0.2), matDark, 0, h * 0.1, 0);
        for (const side of [-1, 1]) {
            this._part(head, this.box(h * 0.03, h * 0.16, h * 0.2), matDark, side * h * 0.095, h * 0.02, 0);
        }
        this._part(head, this.box(h * 0.2, h * 0.2, h * 0.04), matDark, 0, h * 0.03, -h * 0.095);
        const peak = this._part(head, this.cone(h * 0.11, h * 0.18, 5), matDark, 0, h * 0.19, -h * 0.03);
        peak.rotation.x = -0.3;
        torso.add(head);
        P.head = head;

        // Arms in tattered sleeves, with skeletal hands showing at the cuffs
        const boneMat = this._mat(inst, 0xd6cca4);
        for (const side of [-1, 1]) {
            const arm = new THREE.Group();
            arm.position.set(side * h * 0.18, h * 0.05, 0);
            this._part(arm, this.box(h * 0.07, h * 0.2, h * 0.07), matRobe, 0, -h * 0.1, 0);
            this._part(arm, this.box(h * 0.085, h * 0.06, h * 0.085), matDark, 0, -h * 0.2, 0);
            this._part(arm, this.box(h * 0.05, h * 0.07, h * 0.05), boneMat, 0, -h * 0.26, 0);
            for (let i = -1; i <= 1; i++) {
                this._part(arm, this.box(h * 0.014, h * 0.05, h * 0.014), boneMat, i * h * 0.017, -h * 0.31, h * 0.01, true);
            }
            torso.add(arm);
            P[side < 0 ? 'armL' : 'armR'] = arm;
        }

        // Necromantic wisps orbiting the robe
        const wispMat = this._mat(inst, 0x66ccff, { emissive: 0x3399ff, glow: 2.4 });
        inst.wisps = [];
        for (let i = 0; i < 3; i++) {
            const w = this._part(body, this.sph(h * 0.035, 6), wispMat, 0, 0, 0, true);
            w.castShadow = false;
            inst.wisps.push({
                mesh: w, r: h * (0.34 + i * 0.05), y: h * (0.45 + i * 0.17),
                speed: 0.7 + i * 0.25, phase: i * 2.1, bob: h * 0.05,
            });
            this._pulse(inst, w, 2.4, 3 + i, 0.4);
        }
        const staff = this._buildWeapon(inst, 'skullstaff', h, 0x3aa8f0);
        staff.position.y = -h * 0.24;
        P.armR.add(staff);
        P.weaponR = staff;

        inst.animKind = 'lich';
        inst.dims = { h };
    },

    // ============================================================
    // RECIPES
    // ============================================================

    CLASS_RIGS: {
        brawler:      { weapon: 'none', bulk: 1.05 },
        berserker:    { weapon: 'axe', dual: true, bulk: 1.12, capeColor: 0x551111 },
        guardian:     { weapon: 'sword', shield: 'tower', helmet: 'cap', pads: true, bulk: 1.18 },
        paladin:      { weapon: 'glowsword', shield: 'round', helmet: 'cap', pads: true, accent: 0xffd75e },
        warlord:      { weapon: 'axe', dual: true, helmet: 'horned', cape: true, pads: true, bulk: 1.22 },
        reaper:       { weapon: 'scythe', hood: true, cape: true, eyes: 0xff3333, eyeGlow: true },
        juggernaut:   { weapon: 'hammer', helmet: 'cap', pads: true, bulk: 1.32 },
        sentinel:     { weapon: 'spear', shield: 'tower', helmet: 'cap', pads: true, bulk: 1.15 },
        crusader:     { weapon: 'glowsword', helmet: 'winged', cape: true, pads: true, accent: 0xffd75e },
        templar:      { weapon: 'glowhammer', helmet: 'cap', cape: true, pads: true, accent: 0xffe9a0 },
        mage:         { robe: true, weapon: 'staff', hat: true, accent: 0xbb66ff },
        fire_mage:    { robe: true, weapon: 'staff', hat: true, accent: 0xff7722 },
        frost_mage:   { robe: true, weapon: 'staff', hat: true, accent: 0x66ccff },
        arcane_mage:  { robe: true, weapon: 'staff', hat: true, accent: 0xaa44ff },
        warlock:      { robe: true, weapon: 'staff', hood: true, accent: 0x66ff66, eyes: 0x88ff88, eyeGlow: true },
        pyromancer:   { robe: true, weapon: 'staff', hood: true, cape: true, accent: 0xff5511 },
        inferno_mage: { robe: true, weapon: 'staff', hat: true, cape: true, accent: 0xffaa00 },
        cryomancer:   { robe: true, weapon: 'staff', hood: true, cape: true, accent: 0x99e8ff },
        ice_warden:   { robe: true, weapon: 'staff', helmet: 'cap', cape: true, accent: 0xbbf0ff },
        necromancer:  { robe: true, weapon: 'staff', hood: true, cape: true, accent: 0x55ff99, eyes: 0x66ff99, eyeGlow: true },
    },

    MOB_RIGS: {
        slime:          { kind: 'slime', h: 2.2 },
        goblin:         { kind: 'humanoid', h: 2.5, skin: 0x7aa040, weapon: 'club', hair: false },
        skeleton:       { kind: 'humanoid', h: 3.0, skin: 0xe4dfc4, weapon: 'sword', sockets: true, hair: false },
        orc:            { kind: 'humanoid', h: 3.3, skin: 0x55803a, weapon: 'axe', bulk: 1.25, pads: true, hair: false },
        troll:          { kind: 'humanoid', h: 3.9, skin: 0x62734c, weapon: 'club', bulk: 1.4, hair: false },
        demon:          { kind: 'humanoid', h: 3.3, skin: 0xb03028, horns: true, tail: true, weapon: 'none', hair: false, eyes: 0xffdd22, eyeGlow: true },
        imp:            { kind: 'humanoid', h: 2.0, skin: 0xe05538, horns: true, tail: true, weapon: 'none', hair: false },
        archer:         { kind: 'humanoid', h: 2.9, skin: 0xd9a878, weapon: 'bow', hood: true },
        dark_mage:      { kind: 'humanoid', h: 2.9, robe: true, weapon: 'staff', hood: true, accent: 0xbb44ff, eyes: 0xcc66ff, eyeGlow: true },
        fire_elemental: { kind: 'elemental', h: 3.2 },
        // Boss rigs are matched to the painted spritesheets in assets/ and
        // pin their own colors, so the palette does not follow monsters.js
        slime_king:     { kind: 'slimeking', h: 6.0, primary: 0x3fbf3f,
                          cape: true, capeColor: 0xd4a843 },
        skeleton_lord:  { kind: 'humanoid', h: 6.0, primary: 0x6e6a55, secondary: 0x474433,
                          skin: 0xcfc8ac, sockets: true, hair: false, weapon: 'greatsword',
                          accent: 0x8cc4ea, spikeCrown: true, crownColor: 0xa89a72,
                          cape: true, capeColor: 0x6b3a7a, tabard: 0x7a4488,
                          plates: true, spikePads: true, trim: 0x6b3a7a, bulk: 1.12, heroic: true, ribs: true, weaponFx: 'frost' },
        dragon:         { kind: 'dragon', h: 6.5, primary: 0x8a2828 },
        lich:           { kind: 'lich', h: 6.0, primary: 0x4a2f5c, robeDark: 0x31203f },
        demon_lord:     { kind: 'humanoid', h: 6.5, primary: 0x5e2620, secondary: 0x38150f,
                          skin: 0x8a3428, weapon: 'flamesword', accent: 0xffa030,
                          bullHorns: true, hornColor: 0x7d6c5e, hair: false,
                          robe: true, plates: true, spikePads: true, trim: 0x1d0c0a,
                          cape: true, capeColor: 0x38130f, bulk: 1.3, heroic: true, embers: 0xff6a1e, weaponFx: 'fire',
                          eyes: 0xff4020, eyeGlow: true },
    },

    // ============================================================
    // LIFECYCLE
    // ============================================================

    create(entity, isPlayer) {
        const inst = {
            root: new THREE.Group(),
            body: new THREE.Group(),
            parts: {},
            mats: [],
            phase: Math.random() * Math.PI * 2,
            yaw: 0,
            deathAt: 0,
            key: this.keyFor(entity, isPlayer),
        };
        inst.root.add(inst.body);

        if (isPlayer) {
            const rig = Object.assign({}, this.CLASS_RIGS[entity.className] ||
                (entity.classData.type === 'melee' ? this.CLASS_RIGS.brawler : this.CLASS_RIGS.mage));
            rig.h = 4.4;
            rig.primary = new THREE.Color(entity.classData.color).getHex();
            this._ow = rig.h * 0.0135;
            this._buildHumanoid(inst, rig);
        } else {
            const rig = Object.assign({}, this.MOB_RIGS[entity.typeId] ||
                { kind: 'humanoid', h: entity.boss ? 6 : 3, weapon: entity.type === 'ranged' ? 'staff' : 'club' });
            // A rig may pin its own palette (bosses match the painted art);
            // otherwise it takes the tint from the monster definition
            if (rig.primary === undefined) rig.primary = new THREE.Color(entity.color || '#888888').getHex();
            this._ow = rig.h * 0.0135;
            if (rig.kind === 'slimeking') this._buildSlimeKing(inst, rig);
            else if (rig.kind === 'slime') this._buildSlime(inst, rig);
            else if (rig.kind === 'elemental') this._buildElemental(inst, rig);
            else if (rig.kind === 'dragon') this._buildDragon(inst, rig);
            else if (rig.kind === 'lich') this._buildLich(inst, rig);
            else this._buildHumanoid(inst, rig);
        }
        return inst;
    },

    keyFor(entity, isPlayer) {
        return isPlayer ? 'class_' + entity.className : 'mob_' + entity.typeId;
    },

    dispose(inst) {
        for (const m of inst.mats) m.dispose();
        inst.mats.length = 0;
    },

    // ============================================================
    // ANIMATION - pose from time each frame
    // ctx: { state, attackP (0..1 through the swing), fx, fy,
    //        time(ms), flash, frozen }
    // ============================================================

    _easeIn(x) { return x * x; },
    _easeOut(x) { return 1 - (1 - x) * (1 - x); },

    // Progress through the current action. The renderer supplies real timing;
    // the viewer (and any caller without it) falls back to a readable loop.
    _actionP(ctx, loopMs) {
        return ctx.attackP !== undefined ? Math.min(1, Math.max(0, ctx.attackP))
                                         : (ctx.time % loopMs) / loopMs;
    },

    // Overhead chop: wind up, accelerate through the strike, settle back.
    // Returns arm angle plus whole-body lean/lunge/squash for follow-through.
    _chop(p) {
        const N = -0.35, RAISED = -2.7, STRUCK = 0.5;
        if (p < 0.35) {
            const a = this._easeOut(p / 0.35);
            return { arm: N + (RAISED - N) * a, lean: 0.17 * a, lunge: -0.11 * a, sq: -0.06 * a };
        }
        if (p < 0.55) {
            const a = this._easeIn((p - 0.35) / 0.20);
            return { arm: RAISED + (STRUCK - RAISED) * a, lean: 0.17 - 0.48 * a, lunge: -0.11 + 0.42 * a, sq: -0.06 + 0.16 * a };
        }
        const a = this._easeOut((p - 0.55) / 0.45);
        return { arm: STRUCK + (N - STRUCK) * a, lean: -0.31 * (1 - a), lunge: 0.31 * (1 - a), sq: 0.10 * (1 - a) };
    },

    // Straight jab for unarmed fighters — cocks back, snaps out, retracts
    _punch(p) {
        const N = 0;
        if (p < 0.30) {
            const a = this._easeOut(p / 0.30);
            return { arm: N + 0.6 * a, twist: 0.28 * a, lunge: -0.09 * a, sq: -0.05 * a };
        }
        if (p < 0.48) {
            const a = this._easeIn((p - 0.30) / 0.18);
            return { arm: 0.6 - 2.4 * a, twist: 0.28 - 0.65 * a, lunge: -0.09 + 0.38 * a, sq: -0.05 + 0.13 * a };
        }
        const a = this._easeOut((p - 0.48) / 0.52);
        return { arm: -1.8 + (N + 1.8) * a, twist: -0.37 * (1 - a), lunge: 0.29 * (1 - a), sq: 0.08 * (1 - a) };
    },

    // Charge the orb, then thrust it forward on release
    _castPose(p) {
        const N = -0.35;
        if (p < 0.55) {
            const a = this._easeOut(p / 0.55);
            return { arm: N + (-2.1 - N) * a, lean: 0.15 * a, lunge: -0.07 * a, orb: 1 + 0.55 * a, glow: 1 + 1.9 * a };
        }
        if (p < 0.72) {
            const a = this._easeIn((p - 0.55) / 0.17);
            return { arm: -2.1 + 1.0 * a, lean: 0.15 - 0.34 * a, lunge: -0.07 + 0.32 * a, orb: 1.55 - 0.65 * a, glow: 2.9 + 1.8 * a };
        }
        const a = this._easeOut((p - 0.72) / 0.28);
        return { arm: -1.1 + (N + 1.1) * a, lean: -0.19 * (1 - a), lunge: 0.25 * (1 - a), orb: 0.9 + 0.1 * a, glow: 4.7 - 3.7 * a };
    },

    update(inst, entity, ctx) {
        const t = ctx.time / 1000 + inst.phase;

        // Face movement/aim direction (smoothed shortest-path turn)
        if (ctx.fx || ctx.fy) {
            const target = Math.atan2(ctx.fx, ctx.fy);
            let d = target - inst.yaw;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            inst.yaw += d * 0.25;
        }
        inst.root.rotation.y = inst.yaw;

        // Reset per-frame pose
        inst.body.position.set(0, 0, 0);
        inst.body.rotation.set(0, 0, 0);
        inst.body.scale.set(1, 1, 1);

        // Hit flash + frozen tint FIRST, so anim functions can drive glow
        // (orb pulse, elemental core) on top without being overwritten
        for (const m of inst.mats) {
            if (ctx.flash) {
                // Toon bands are darker than the old PBR shading, so the old
                // flash level blew the whole rig out to flat white
                m.emissive.setRGB(1, 1, 1);
                m.emissiveIntensity = 0.26;
            } else {
                m.emissive.copy(m.userData.be);
                m.emissiveIntensity = m.userData.bei;
            }
            if (ctx.frozen) m.color.copy(m.userData.bc).lerp(this._frostColor, 0.55);
            else if (ctx.flash) m.color.copy(m.userData.bc).lerp(this._flashColor, 0.45);
            else m.color.copy(m.userData.bc);
        }

        switch (inst.animKind) {
            case 'humanoid': this._animHumanoid(inst, ctx, t); break;
            case 'slime': this._animSlime(inst, ctx, t); break;
            case 'slimeking': this._animSlimeKing(inst, ctx, t); break;
            case 'elemental': this._animElemental(inst, ctx, t); break;
            case 'dragon': this._animDragon(inst, ctx, t); break;
            case 'lich': this._animLich(inst, ctx, t); break;
        }

        // Registered glow pulses (blades, embers, runes). Runs after the anim
        // pass so it wins over the material reset; skipped while flashing so
        // hit feedback stays readable.
        if (inst.pulses && !ctx.flash) {
            for (const p of inst.pulses) {
                p.mesh.material.emissiveIntensity = p.base * (1 + Math.sin(t * p.speed + p.phase) * p.amt);
            }
        }
        // Flame tongues: stretch and sway on their own phase so the fire licks
        if (inst.flames) {
            for (const f of inst.flames) {
                const s = 1 + Math.sin(t * f.speed + f.phase) * f.amt;
                f.mesh.scale.set(1 - (s - 1) * 0.45, s, 1 - (s - 1) * 0.45);
                f.mesh.rotation.z = f.base + Math.sin(t * f.speed * 0.6 + f.phase) * f.sway;
            }
        }
        // Orbiting motes (lich wisps)
        if (inst.wisps) {
            for (const w of inst.wisps) {
                const a = t * w.speed + w.phase;
                w.mesh.position.set(Math.sin(a) * w.r, w.y + Math.sin(t * 1.8 + w.phase) * w.bob, Math.cos(a) * w.r);
            }
        }

        // Getting hit shakes the whole rig
        if (ctx.flash) inst.body.position.x += Math.sin(ctx.time * 0.07) * 0.055;
    },

    // Register an emissive mesh to breathe over time
    _pulse(inst, mesh, base, speed, amt) {
        (inst.pulses || (inst.pulses = [])).push({
            mesh, base, speed, amt, phase: Math.random() * Math.PI * 2,
        });
    },
    _frostColor: null, // set below (THREE may not exist at parse time in tests)

    _animHumanoid(inst, ctx, t) {
        const P = inst.parts;
        const st = ctx.state;

        // Neutral pose: weapon arms angle out-front so weapons clear the body
        if (P.legL) { P.legL.rotation.set(0, 0, 0); P.legR.rotation.set(0, 0, 0); }
        P.armL.rotation.set(P.weaponL ? -0.35 : 0, 0, P.weaponL ? 0.3 : 0.06);
        P.armR.rotation.set(P.weaponR ? -0.35 : 0, 0, P.weaponR ? -0.3 : -0.06);
        if (P.torso) P.torso.rotation.set(0, 0, 0);
        if (P.head) P.head.rotation.set(0, 0, 0);
        if (P.cape) {
            P.cape.rotation.x = 0.12 + Math.sin(t * 1.6) * 0.05;
            P.cape.rotation.z = Math.sin(t * 1.15) * 0.045;
        }
        if (P.jaw) P.jaw.rotation.x = Math.sin(t * 1.3) * 0.04;
        if (P.tail) P.tail.rotation.y = Math.sin(t * 3) * 0.3;

        if (st === 'death') {
            const p = Math.min(1, (ctx.time - inst.deathAt) / 650);
            const fall = this._easeIn(p);
            // bounce once as it lands, then settle
            const settle = p > 0.8 ? Math.sin((p - 0.8) / 0.2 * Math.PI * 2) * 0.07 * (1 - p) / 0.2 : 0;
            inst.body.rotation.x = -fall * 1.52 + settle;
            inst.body.position.y = Math.sin(p * Math.PI) * 0.18;
            inst.body.scale.set(1 + fall * 0.07, 1 - fall * 0.07, 1);
            return;
        }

        if (st === 'walk') {
            const s = Math.sin(t * 11);
            const hop = Math.abs(s);
            const plant = 1 - hop; // 1 when a foot lands, 0 at the top of the step
            if (P.legL) {
                P.legL.rotation.x = s * 0.75;
                P.legR.rotation.x = -s * 0.75;
            } else if (P.skirt) {
                P.skirt.rotation.x = s * 0.06;
            }
            P.armL.rotation.x += -s * 0.5;
            P.armR.rotation.x += s * 0.5;
            inst.body.position.y = hop * 0.10;
            inst.body.rotation.x = 0.10;                    // lean into the run
            inst.body.rotation.z = Math.sin(t * 5.5) * 0.05; // weight shift
            inst.body.scale.set(1 + plant * 0.05, 1 - plant * 0.07, 1 + plant * 0.05);
            if (P.head) {
                P.head.rotation.x = -0.07;                   // keep eyes on the horizon
                P.head.rotation.z = -Math.sin(t * 5.5) * 0.05;
            }
            if (P.cape) P.cape.rotation.x = 0.35 + s * 0.09;
        } else if (st === 'attack') {
            const p = this._actionP(ctx, 900);
            if (P.weaponR) {
                const c = this._chop(p);
                P.armR.rotation.x = c.arm;
                // dual wield: the off-hand chops on the opposite beat
                if (P.weaponL) P.armL.rotation.x = this._chop((p + 0.5) % 1).arm;
                inst.body.rotation.x = c.lean;
                inst.body.position.z = c.lunge;
                inst.body.scale.set(1 - c.sq * 0.45, 1 + c.sq, 1 - c.sq * 0.45);
                if (P.head) P.head.rotation.x = -c.lean * 0.55;
            } else {
                // Unarmed: alternate fists on each new swing
                if (inst._pp !== undefined && p < inst._pp - 0.3) inst.punchSide = -(inst.punchSide || 1);
                inst._pp = p;
                const side = inst.punchSide || 1;
                const c = this._punch(p);
                (side > 0 ? P.armR : P.armL).rotation.x = c.arm;
                if (P.torso) P.torso.rotation.y = c.twist * side;
                inst.body.position.z = c.lunge;
                inst.body.scale.set(1 - c.sq * 0.45, 1 + c.sq, 1 - c.sq * 0.45);
            }
        } else if (st === 'cast') {
            const c = this._castPose(this._actionP(ctx, 1000));
            P.armR.rotation.x = c.arm;
            P.armR.rotation.z = -0.5; // hold the staff out to the side, clear of the face
            P.armL.rotation.x = -0.85 + Math.sin(t * 4) * 0.12;
            inst.body.rotation.x = c.lean;
            inst.body.position.z = c.lunge;
            if (P.head) P.head.rotation.x = -c.lean * 0.5;
            if (P.orb) {
                P.orb.scale.setScalar(c.orb);
                P.orb.material.emissiveIntensity = 1.4 + c.glow * 0.85;
            }
        } else {
            // idle: breathe, shift weight, glance around
            const breath = Math.sin(t * 2.2);
            P.armL.rotation.x += breath * 0.06;
            P.armR.rotation.x += Math.sin(t * 2.2 + 0.4) * 0.06;
            inst.body.position.y = breath * 0.03;
            inst.body.scale.set(1 - breath * 0.012, 1 + breath * 0.018, 1 - breath * 0.012);
            inst.body.rotation.z = Math.sin(t * 1.1) * 0.03;
            if (P.head) {
                P.head.rotation.y = Math.sin(t * 0.7) * 0.13;
                P.head.rotation.z = Math.sin(t * 0.9) * 0.04;
            }
            if (P.orb) P.orb.material.emissiveIntensity = 2.0 + Math.sin(t * 3) * 0.5;
        }
    },

    _animSlime(inst, ctx, t) {
        const P = inst.parts;
        const h = inst.dims.h;
        if (ctx.state === 'attack') {
            // Pounce: compress hard, launch, splat back down
            const p = this._actionP(ctx, 800);
            let lift, sq;
            if (p < 0.3) { const a = this._easeOut(p / 0.3); lift = 0; sq = 0.3 * a; }
            else if (p < 0.6) { const a = this._easeOut((p - 0.3) / 0.3); lift = a; sq = 0.3 - 0.55 * a; }
            else { const a = this._easeIn((p - 0.6) / 0.4); lift = 1 - a; sq = -0.25 + 0.25 * a; }
            inst.body.position.y = lift * h * 0.3;
            inst.body.position.z = lift * h * 0.12;
            P.blob.scale.set(1 + sq, 0.82 - sq * 0.9, 1 + sq);
        } else if (ctx.state === 'walk') {
            const hop = Math.abs(Math.sin(t * 7));
            const plant = 1 - hop;
            inst.body.position.y = hop * h * 0.16;
            P.blob.scale.set(1 + plant * 0.18, 0.82 - plant * 0.16 + hop * 0.12, 1 + plant * 0.18);
        } else {
            const sq = Math.sin(t * 4) * 0.06;
            P.blob.scale.set(1 - sq, 0.82 + sq, 1 - sq);
        }
    },

    // Gelatinous secondary motion: each mass wobbles on its own phase so the
    // body undulates instead of scaling as one rigid lump.
    _animSlimeKing(inst, ctx, t) {
        const P = inst.parts;
        const h = inst.dims.h;
        let squash = 0, lift = 0;

        if (ctx.state === 'attack') {
            const p = this._actionP(ctx, 850);
            if (p < 0.3) { const a = this._easeOut(p / 0.3); squash = 0.26 * a; lift = 0; }
            else if (p < 0.6) { const a = this._easeOut((p - 0.3) / 0.3); squash = 0.26 - 0.5 * a; lift = a; }
            else { const a = this._easeIn((p - 0.6) / 0.4); squash = -0.24 + 0.24 * a; lift = 1 - a; }
            inst.body.position.y = lift * h * 0.26;
            inst.body.position.z = lift * h * 0.1;
        } else if (ctx.state === 'walk') {
            const hop = Math.abs(Math.sin(t * 6.5));
            inst.body.position.y = hop * h * 0.13;
            squash = (1 - hop) * 0.16;
        } else {
            squash = Math.sin(t * 2.6) * 0.05;
        }

        // Wobble travels up the body: base leads, dome lags
        const wob = (phase, amt) => Math.sin(t * 3.4 + phase) * amt;
        P.base.scale.set(1.08 + squash + wob(0, 0.035), 0.82 - squash * 0.9 + wob(2.2, 0.03), 1.0 + squash + wob(0.7, 0.035));
        P.mid.scale.set(1.02 + squash * 0.7 + wob(1.1, 0.04), 0.92 - squash * 0.6 + wob(3.0, 0.035), 1.0 + squash * 0.7 + wob(1.8, 0.04));
        P.dome.scale.set(1 + squash * 0.4 + wob(2.4, 0.045), 1 - squash * 0.35 + wob(4.1, 0.04), 1 + squash * 0.4 + wob(3.1, 0.045));

        for (let i = 0; i < P.lobes.length; i++) {
            const l = P.lobes[i];
            l.scale.set(1 + Math.sin(t * 3.8 + i) * 0.09, 0.72 + Math.sin(t * 4.2 + i * 1.7) * 0.07, 1 + Math.cos(t * 3.6 + i) * 0.09);
        }
        for (let i = 0; i < P.drips.length; i++) {
            const d = P.drips[i];
            d.scale.y = 1.9 + Math.sin(t * 2.8 + i * 2.1) * 0.45;   // drips stretch and recoil
            d.scale.x = d.scale.z = 0.9 - Math.sin(t * 2.8 + i * 2.1) * 0.06;
        }
        if (P.cape) {
            P.cape.rotation.x = 0.05 + Math.sin(t * 2.2) * 0.05;
            P.cape.rotation.z = Math.sin(t * 1.7) * 0.035;
        }
    },

    _animElemental(inst, ctx, t) {
        const P = inst.parts;
        inst.body.position.y = 0.25 + Math.sin(t * 3.2) * 0.18;
        for (let i = 0; i < P.flames.length; i++) {
            const f = P.flames[i];
            f.scale.y = 1 + Math.sin(t * 9 + i * 1.7) * 0.35;
            f.rotation.y = t * 1.5 + i;
        }
        P.blob.material.emissiveIntensity = 2.4 + Math.sin(t * 11) * 0.7;
    },

    _animDragon(inst, ctx, t) {
        const P = inst.parts;
        const walking = ctx.state === 'walk';
        const flap = walking ? 6.5 : 2.6;
        const beat = Math.sin(t * flap);
        P.wingL.rotation.z = -0.12 - beat * 0.4;
        P.wingR.rotation.z = 0.12 + beat * 0.4;
        P.tail.rotation.y = Math.sin(t * 2.2) * 0.3;
        // second segment lags, so the tail waves instead of swinging as a rod
        P.tail2.rotation.y = Math.sin(t * 2.2 - 0.9) * 0.34;
        P.tail2.rotation.x = Math.sin(t * 1.7) * 0.1;
        P.neck.rotation.x = Math.sin(t * 1.8) * 0.07;
        P.neck.rotation.y = Math.sin(t * 0.9) * 0.12;
        P.head.rotation.x = 0.2;
        P.head.rotation.y = Math.sin(t * 0.9 + 0.6) * 0.1;
        P.torso.rotation.x = 0.3;
        if (P.jaw) P.jaw.rotation.x = 0.06 + Math.sin(t * 1.5) * 0.05;
        const br = Math.sin(t * 2.4) * 0.02;   // breathing
        P.torso.scale.set(1 + br, 1 - br * 0.5, 1 + br);
        inst.body.position.set(0, Math.sin(t * 2.6) * 0.07, 0);

        // Membrane panels ripple with a delay down the wing
        for (const key of ['membL', 'membR']) {
            const panels = P[key];
            if (!panels) continue;
            for (let i = 0; i < panels.length; i++) {
                panels[i].rotation.x = 0.18 + Math.sin(t * flap - i * 0.7) * (walking ? 0.22 : 0.12);
            }
        }

        if (walking) {
            // Two-legged stride with a body bob on each step
            const s = Math.sin(t * 8);
            P.legL.rotation.x = s * 0.55;
            P.legR.rotation.x = -s * 0.55;
            inst.body.position.y += Math.abs(s) * 0.12;
            inst.body.rotation.z = Math.sin(t * 4) * 0.04;
        } else {
            P.legL.rotation.x = 0;
            P.legR.rotation.x = 0;
        }

        if (ctx.state === 'attack' || ctx.state === 'cast') {
            // Rear back, then throw the head forward to breathe fire
            const p = this._actionP(ctx, 950);
            let rear, lunge;
            if (p < 0.42) { const a = this._easeOut(p / 0.42); rear = 0.6 * a; lunge = -0.14 * a; }
            else if (p < 0.6) { const a = this._easeIn((p - 0.42) / 0.18); rear = 0.6 - 1.25 * a; lunge = -0.14 + 0.45 * a; }
            else { const a = this._easeOut((p - 0.6) / 0.4); rear = -0.65 * (1 - a); lunge = 0.31 * (1 - a); }
            P.neck.rotation.x += rear;
            P.head.rotation.x += -rear * 0.55;
            P.torso.rotation.x += rear * 0.3;
            if (P.jaw) P.jaw.rotation.x = 0.06 + Math.max(0, -rear) * 0.9;  // maw opens on the breath
            inst.body.position.z = lunge;
            // wings flare wide on the roar
            P.wingL.rotation.z -= 0.5;
            P.wingR.rotation.z += 0.5;
        }
    },

    _animLich(inst, ctx, t) {
        const P = inst.parts;
        inst.body.position.y = 0.5 + Math.sin(t * 2.6) * 0.2;
        P.skirt.rotation.y = Math.sin(t * 1.4) * 0.1;
        if (ctx.state === 'attack' || ctx.state === 'cast') {
            const c = this._castPose(this._actionP(ctx, 1100));
            P.armR.rotation.x = c.arm;
            P.armL.rotation.x = -1.4 + Math.sin(t * 5) * 0.1;
            inst.body.position.z = c.lunge;
            inst.body.rotation.x = c.lean * 0.6;
            if (P.orb) {
                P.orb.scale.setScalar(c.orb);
                P.orb.material.emissiveIntensity = 1.4 + c.glow * 0.9;
            }
        } else {
            P.armR.rotation.x = -0.4 + Math.sin(t * 2.6) * 0.08;
            P.armL.rotation.x = -0.3 + Math.cos(t * 2.2) * 0.08;
            if (P.orb) {
                P.orb.scale.setScalar(1);
                P.orb.material.emissiveIntensity = 2.2 + Math.sin(t * 3) * 0.6;
            }
        }
        if (P.head) P.head.rotation.y = Math.sin(t * 0.9) * 0.2;
    },
};

// THREE is guaranteed loaded before this script (boot.js order)
Characters3D._frostColor = new THREE.Color(0x88ccff);
Characters3D._flashColor = new THREE.Color(0xffd8d8);
