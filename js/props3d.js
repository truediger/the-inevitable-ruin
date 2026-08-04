// ============================================================
// PROPS 3D - procedural set dressing for the arena.
//
// Built from the same primitives, toon materials and outline shells as
// the character rigs (Characters3D helpers) so props and actors read as
// one world. Everything is static: props are created once per
// environment build and never touched per frame, except registered
// flames which the renderer flickers alongside the wall torches.
//
// Placement hugs the wall polygon. The play boundary is also the wall
// line, so anything further in would be walked through.
// ============================================================

const Props3D = {
    MAX_PROPS: 22,

    // Landmark props need presence; debris should stay underfoot
    SCALE_MUL: {
        statue: 1.55, altar: 1.3, brazier: 1.3, sarcophagus: 1.25,
        firePit: 1.2, brokenPillar: 1.15, stalagmite: 1.25, banner: 1.1,
    },

    // Which props belong to which biome, with relative weight
    SETS: {
        bg_crypt: [['bones', 3], ['sarcophagus', 2], ['candles', 3], ['brokenPillar', 2], ['rubble', 3], ['urn', 2]],
        bg_cavern: [['stalagmite', 4], ['crystal', 3], ['rubble', 3], ['bones', 1], ['brokenPillar', 1]],
        bg_chamber: [['firePit', 2], ['rubble', 3], ['brokenPillar', 2], ['banner', 2], ['urn', 2], ['bones', 1]],
        bg_temple: [['statue', 3], ['altar', 2], ['brazier', 3], ['banner', 2], ['brokenPillar', 1], ['urn', 2]],
    },

    // Props that mount on the wall face rather than standing on the floor
    WALL_MOUNTED: { banner: true },

    _rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6d2b79f5) >>> 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },
    _hash(str) {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    },

    // ---- prop factories: origin at the base, facing +Z ----

    _stone(inst, tint) {
        return Characters3D._mat(inst, tint);
    },

    brazier(inst, s, ctx) {
        const g = new THREE.Group();
        const C = Characters3D;
        const metal = this._stone(inst, 0x4a4038);
        for (const a of [0, 2.09, 4.19]) {
            const leg = C._part(g, C.box(s * 0.09, s * 0.72, s * 0.09), metal,
                Math.sin(a) * s * 0.2, s * 0.36, Math.cos(a) * s * 0.2);
            leg.rotation.x = -Math.cos(a) * 0.18;
            leg.rotation.z = Math.sin(a) * 0.18;
        }
        C._part(g, C.cyl(s * 0.42, s * 0.26, s * 0.3, 9), metal, 0, s * 0.85, 0);
        C._part(g, C.cyl(s * 0.44, s * 0.44, s * 0.07, 9), metal, 0, s * 1.0, 0);
        const coals = C._part(g, C.sph(s * 0.3, 7),
            C._mat(inst, 0xff7a22, { emissive: 0xff5500, glow: 2.4 }), 0, s * 0.95, 0, true);
        coals.scale.y = 0.45;
        coals.castShadow = false;
        this._flame(g, ctx, 0, s * 1.25, 0, s * 1.5);
        return g;
    },

    firePit(inst, s, ctx) {
        const g = new THREE.Group();
        const C = Characters3D;
        const rock = this._stone(inst, 0x574d45);
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            const r = C._part(g, C.box(s * 0.26, s * 0.22, s * 0.22), rock,
                Math.sin(a) * s * 0.6, s * 0.11, Math.cos(a) * s * 0.6);
            r.rotation.y = a;
        }
        const coals = C._part(g, C.sph(s * 0.5, 8),
            C._mat(inst, 0xff8830, { emissive: 0xff5a10, glow: 2.2 }), 0, s * 0.08, 0, true);
        coals.scale.y = 0.3;
        coals.castShadow = false;
        this._flame(g, ctx, 0, s * 0.5, 0, s * 2.0);
        return g;
    },

    candles(inst, s, ctx) {
        const g = new THREE.Group();
        const C = Characters3D;
        const base = this._stone(inst, 0x5b5348);
        C._part(g, C.cyl(s * 0.32, s * 0.36, s * 0.12, 8), base, 0, s * 0.06, 0);
        const wax = C._mat(inst, 0xe8e0cc);
        const hs = [0.5, 0.72, 0.38];
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + 0.5;
            const x = Math.sin(a) * s * 0.17, z = Math.cos(a) * s * 0.17;
            C._part(g, C.cyl(s * 0.07, s * 0.08, s * hs[i], 6), wax, x, s * hs[i] / 2 + s * 0.12, z);
            this._flame(g, ctx, x, s * (hs[i] + 0.2), z, s * 0.42);
        }
        return g;
    },

    statue(inst, s, ctx) {
        const g = new THREE.Group();
        const C = Characters3D;
        const stone = this._stone(inst, ctx.stone);
        const dark = this._stone(inst, ctx.stoneDark);
        C._part(g, C.box(s * 0.95, s * 0.22, s * 0.95), dark, 0, s * 0.11, 0);
        C._part(g, C.box(s * 0.78, s * 0.5, s * 0.78), stone, 0, s * 0.47, 0);
        C._part(g, C.box(s * 0.92, s * 0.14, s * 0.92), dark, 0, s * 0.79, 0);
        // robed figure: tapered body, shoulders, head, arms crossed forward
        C._part(g, C.cyl(s * 0.26, s * 0.42, s * 1.0, 8), stone, 0, s * 1.36, 0);
        C._part(g, C.box(s * 0.62, s * 0.26, s * 0.38), stone, 0, s * 1.94, 0);
        C._part(g, C.box(s * 0.3, s * 0.34, s * 0.3), stone, 0, s * 2.24, 0);
        const eye = C._mat(inst, 0x1a1a20);
        for (const side of [-1, 1]) {
            C._part(g, C.box(s * 0.07, s * 0.06, s * 0.04), eye, side * s * 0.08, s * 2.26, s * 0.16);
            const arm = C._part(g, C.box(s * 0.16, s * 0.6, s * 0.16), stone, side * s * 0.32, s * 1.6, s * 0.1);
            arm.rotation.x = -0.35;
        }
        return g;
    },

    altar(inst, s, ctx) {
        const g = new THREE.Group();
        const C = Characters3D;
        const stone = this._stone(inst, ctx.stone);
        const dark = this._stone(inst, ctx.stoneDark);
        C._part(g, C.box(s * 1.1, s * 0.16, s * 0.8), dark, 0, s * 0.08, 0);
        C._part(g, C.box(s * 0.7, s * 0.62, s * 0.5), stone, 0, s * 0.47, 0);
        C._part(g, C.box(s * 1.2, s * 0.16, s * 0.9), stone, 0, s * 0.86, 0);
        const crystal = C._part(g, C.cone(s * 0.16, s * 0.5, 5),
            C._mat(inst, ctx.glow, { emissive: ctx.glow, glow: 2.6 }), 0, s * 1.19, 0, true);
        crystal.castShadow = false;
        return g;
    },

    brokenPillar(inst, s, ctx) {
        const g = new THREE.Group();
        const C = Characters3D;
        const stone = this._stone(inst, ctx.stone);
        const dark = this._stone(inst, ctx.stoneDark);
        C._part(g, C.box(s * 0.78, s * 0.16, s * 0.78), dark, 0, s * 0.08, 0);
        C._part(g, C.cyl(s * 0.28, s * 0.32, s * 1.15, 8), stone, 0, s * 0.73, 0);
        // sheared top
        const top = C._part(g, C.cyl(s * 0.3, s * 0.28, s * 0.22, 8), stone, 0, s * 1.38, 0);
        top.rotation.z = 0.26;
        // fallen drum resting beside it
        const fallen = C._part(g, C.cyl(s * 0.27, s * 0.29, s * 0.55, 8), stone, s * 0.85, s * 0.27, s * 0.3);
        fallen.rotation.z = Math.PI / 2;
        fallen.rotation.y = 0.4;
        return g;
    },

    rubble(inst, s, ctx) {
        const g = new THREE.Group();
        const C = Characters3D;
        const stone = this._stone(inst, ctx.stoneDark);
        const r = ctx.rng;
        for (let i = 0; i < 6; i++) {
            const sz = s * (0.16 + r() * 0.22);
            const m = C._part(g, C.box(sz, sz * 0.75, sz * 0.9), stone,
                (r() - 0.5) * s * 1.1, sz * 0.38, (r() - 0.5) * s * 0.9);
            m.rotation.set(r() * 0.4, r() * Math.PI, r() * 0.4);
        }
        return g;
    },

    bones(inst, s, ctx) {
        const g = new THREE.Group();
        const C = Characters3D;
        const bone = C._mat(inst, 0xd8d2bc);
        const dark = C._mat(inst, 0x2a2622);
        // skull
        C._part(g, C.box(s * 0.3, s * 0.26, s * 0.3), bone, 0, s * 0.13, 0);
        C._part(g, C.box(s * 0.22, s * 0.1, s * 0.12), bone, 0, s * 0.06, s * 0.18);
        for (const side of [-1, 1]) {
            C._part(g, C.box(s * 0.08, s * 0.09, s * 0.04), dark, side * s * 0.07, s * 0.16, s * 0.16);
        }
        // ribcage + a long bone
        for (let i = 0; i < 4; i++) {
            const rib = C._part(g, C.box(s * 0.34, s * 0.05, s * 0.05), bone,
                -s * 0.1, s * 0.05, -s * (0.22 + i * 0.16));
            rib.rotation.z = 0.1 + i * 0.05;
        }
        const femur = C._part(g, C.box(s * 0.5, s * 0.07, s * 0.07), bone, s * 0.4, s * 0.04, s * 0.2);
        femur.rotation.y = 0.7;
        return g;
    },

    sarcophagus(inst, s, ctx) {
        const g = new THREE.Group();
        const C = Characters3D;
        const stone = this._stone(inst, ctx.stone);
        const dark = this._stone(inst, ctx.stoneDark);
        C._part(g, C.box(s * 0.85, s * 0.5, s * 1.9), stone, 0, s * 0.25, 0);
        C._part(g, C.box(s * 0.95, s * 0.14, s * 2.0), dark, 0, s * 0.57, 0);
        // carved effigy on the lid
        C._part(g, C.box(s * 0.28, s * 0.1, s * 0.28), stone, 0, s * 0.68, -s * 0.6);
        C._part(g, C.box(s * 0.42, s * 0.1, s * 0.9), stone, 0, s * 0.67, s * 0.1);
        return g;
    },

    urn(inst, s, ctx) {
        const g = new THREE.Group();
        const C = Characters3D;
        const clay = this._stone(inst, 0x8a6244);
        C._part(g, C.cyl(s * 0.3, s * 0.18, s * 0.2, 9), clay, 0, s * 0.1, 0);
        C._part(g, C.cyl(s * 0.22, s * 0.34, s * 0.42, 9), clay, 0, s * 0.4, 0);
        C._part(g, C.cyl(s * 0.16, s * 0.2, s * 0.16, 9), clay, 0, s * 0.68, 0);
        C._part(g, C.cyl(s * 0.22, s * 0.22, s * 0.06, 9), clay, 0, s * 0.78, 0);
        return g;
    },

    crystal(inst, s, ctx) {
        const g = new THREE.Group();
        const C = Characters3D;
        const gem = C._mat(inst, ctx.glow, { emissive: ctx.glow, glow: 2.0 });
        const rock = this._stone(inst, ctx.stoneDark);
        C._part(g, C.box(s * 0.7, s * 0.16, s * 0.6), rock, 0, s * 0.08, 0);
        const r = ctx.rng;
        for (let i = 0; i < 4; i++) {
            const hh = s * (0.5 + r() * 0.7);
            const c = C._part(g, C.cone(s * 0.13, hh, 5), gem,
                (r() - 0.5) * s * 0.5, hh / 2 + s * 0.1, (r() - 0.5) * s * 0.4, true);
            c.rotation.z = (r() - 0.5) * 0.5;
            c.rotation.x = (r() - 0.5) * 0.4;
            c.castShadow = false;
        }
        return g;
    },

    stalagmite(inst, s, ctx) {
        const g = new THREE.Group();
        const C = Characters3D;
        const rock = this._stone(inst, ctx.stone);
        const r = ctx.rng;
        for (let i = 0; i < 3; i++) {
            const hh = s * (0.7 + r() * 1.3);
            const c = C._part(g, C.cone(s * (0.2 + r() * 0.14), hh, 6), rock,
                (r() - 0.5) * s * 0.8, hh / 2, (r() - 0.5) * s * 0.7);
            c.rotation.z = (r() - 0.5) * 0.18;
        }
        return g;
    },

    banner(inst, s, ctx) {
        const g = new THREE.Group();
        const C = Characters3D;
        const rod = this._stone(inst, 0x4a4038);
        const cloth = C._mat(inst, ctx.banner);
        C._part(g, C.box(s * 0.9, s * 0.09, s * 0.09), rod, 0, 0, 0);
        C._part(g, C.box(s * 0.74, s * 1.5, s * 0.04), cloth, 0, -s * 0.78, 0);
        // frayed lower edge
        for (const side of [-1, 0, 1]) {
            C._part(g, C.cone(s * 0.16, s * 0.28, 4), cloth, side * s * 0.24, -s * 1.62, 0);
        }
        return g;
    },

    _flame(parent, ctx, x, y, z, size) {
        if (!ctx.flameTex) return;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: ctx.flameTex, color: ctx.torch,
            blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
        }));
        sprite.position.set(x, y, z);
        sprite.scale.set(size * 0.75, size, 1);
        parent.add(sprite);
        ctx.flames.push({ flame: sprite, phase: Math.random() * Math.PI * 2, base: size });
    },

    // ---- placement ----

    populate(group, poly, biomeKey, ctx) {
        const set = this.SETS[biomeKey] || this.SETS.bg_crypt;
        if (poly.length < 3) return [];

        const rng = this._rng(this._hash(biomeKey + poly.length + Math.round(poly[0].x * 10)));
        ctx.rng = rng;
        ctx.flames = [];

        // Weighted pick table
        const bag = [];
        for (const [name, w] of set) for (let i = 0; i < w; i++) bag.push(name);

        let cx = 0, cz = 0;
        for (const p of poly) { cx += p.x; cz += p.z; }
        cx /= poly.length; cz /= poly.length;

        let placed = 0, lastName = '';
        // Walk segments in a rotating order so props don't cluster on one wall
        for (let pass = 0; pass < 2 && placed < this.MAX_PROPS; pass++) {
            for (let i = 0; i < poly.length && placed < this.MAX_PROPS; i++) {
                if (rng() < 0.26) continue;
                const a = poly[i], b = poly[(i + 1) % poly.length];
                const dx = b.x - a.x, dz = b.z - a.z;
                const len = Math.hypot(dx, dz);
                if (len < 3) continue;
                const ux = dx / len, uz = dz / len;

                // inward normal: pick whichever of the two points at the centroid
                let nx = -uz, nz = ux;
                if ((cx - a.x) * nx + (cz - a.z) * nz < 0) { nx = -nx; nz = -nz; }

                // Re-roll once on a repeat so runs of identical props break up
                let name = bag[Math.floor(rng() * bag.length)];
                if (name === lastName) name = bag[Math.floor(rng() * bag.length)];
                lastName = name;
                const wallMounted = this.WALL_MOUNTED[name];
                const t = 0.2 + rng() * 0.6;
                const inset = wallMounted ? 0.55 : 1.35 + rng() * 0.9;
                const x = a.x + ux * len * t + nx * inset;
                const z = a.z + uz * len * t + nz * inset;

                const s = ctx.baseScale * (0.85 + rng() * 0.4) * (this.SCALE_MUL[name] || 1);
                const inst = { mats: [] };
                Characters3D._ow = s * 0.035;
                const prop = this[name](inst, s, ctx);
                prop.position.set(x, wallMounted ? ctx.wallHeight * 0.82 : 0, z);
                prop.rotation.y = Math.atan2(nx, nz) + (wallMounted ? 0 : (rng() - 0.5) * 0.7);
                prop.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
                group.add(prop);
                placed++;
            }
        }
        return ctx.flames;
    },
};
