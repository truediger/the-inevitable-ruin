// ============================================================
// BACKGROUND SYSTEM - 3D Dungeon Panoramas
// ============================================================

const Background = {
    images: {},
    current: null,
    loaded: false,
    parallaxX: 0,
    parallaxY: 0,
    // Ambient color tints per background
    tints: {
        bg_crypt: { r: 60, g: 80, b: 120, a: 0.08 },
        bg_cavern: { r: 80, g: 50, b: 30, a: 0.08 },
        bg_chamber: { r: 70, g: 40, b: 40, a: 0.08 },
        bg_temple: { r: 50, g: 70, b: 60, a: 0.08 },
    },
    // Floor-to-background mapping
    floorMap: [
        { maxFloor: 5, bg: 'bg_crypt' },
        { maxFloor: 10, bg: 'bg_cavern' },
        { maxFloor: 15, bg: 'bg_chamber' },
        { maxFloor: Infinity, bg: 'bg_temple' },
    ],

    init() {
        const names = ['bg_crypt', 'bg_cavern', 'bg_chamber', 'bg_temple'];
        let loadCount = 0;
        names.forEach(name => {
            const img = new Image();
            img.src = `assets/${name}.png`;
            img.onload = () => {
                loadCount++;
                if (loadCount === names.length) {
                    this.loaded = true;
                }
            };
            this.images[name] = img;
        });
        this.current = 'bg_crypt';
    },

    // Pick background based on current tower floor
    setFloor(floor) {
        for (let i = 0; i < this.floorMap.length; i++) {
            if (floor <= this.floorMap[i].maxFloor) {
                this.current = this.floorMap[i].bg;
                return;
            }
        }
    },

    // Update parallax offset based on player position in arena
    updateParallax(playerX, playerY, arenaW, arenaH) {
        // Normalize player pos to -1..1
        const nx = (playerX / arenaW - 0.5) * 2;
        const ny = (playerY / arenaH - 0.5) * 2;
        // Smooth follow
        this.parallaxX += (nx - this.parallaxX) * 0.05;
        this.parallaxY += (ny - this.parallaxY) * 0.05;
    },

    draw(ctx, w, h) {
        if (!this.loaded || !this.current) return;

        const img = this.images[this.current];
        if (!img || !img.complete || img.naturalWidth === 0) return;

        // Parallax shift — max 40px in each direction
        const maxShift = 40;
        const shiftX = this.parallaxX * maxShift;
        const shiftY = this.parallaxY * maxShift;

        // Cover the canvas, slightly oversized for parallax room
        const oversize = maxShift * 2;
        const drawW = w + oversize;
        const drawH = h + oversize;
        const drawX = -oversize / 2 + shiftX;
        const drawY = -oversize / 2 + shiftY;

        // Draw the panorama stretched to fill
        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        // Heavy darken so gameplay elements pop
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, w, h);

        // Radial vignette — darker edges, lighter center
        const gradient = ctx.createRadialGradient(
            w / 2, h / 2, Math.min(w, h) * 0.25,
            w / 2, h / 2, Math.max(w, h) * 0.75
        );
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        // Subtle ambient tint from the background
        const tint = this.tints[this.current];
        if (tint) {
            ctx.fillStyle = `rgba(${tint.r}, ${tint.g}, ${tint.b}, ${tint.a})`;
            ctx.fillRect(0, 0, w, h);
        }
    },
};
