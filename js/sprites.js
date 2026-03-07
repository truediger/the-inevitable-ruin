// ============================================================
// SPRITE SYSTEM - The Inevitable Ruin
// ============================================================

const Sprites = {
    sheets: {},
    loaded: false,

    // Exact frame rectangles found by scanning alpha channel gaps
    // Each frame is { x, y, w, h } in the source image
    frameData: {
        melee: {
            cols: [
                { x: 0, w: 93 },      // col 0: front
                { x: 128, w: 93 },     // col 1: front-angle
                { x: 254, w: 97 },     // col 2: back-angle
                { x: 385, w: 92 },     // col 3: back
                { x: 512, w: 96 },     // col 4: side
                { x: 636, w: 107 },    // col 5: side-walk1
                { x: 763, w: 111 },    // col 6: side-walk2
                { x: 889, w: 113 },    // col 7: side-walk3/extra
            ],
            rows: [
                { y: 1, h: 131 },      // row 0: idle
                { y: 144, h: 128 },    // row 1: walk
                { y: 281, h: 132 },    // row 2: attack
                { y: 418, h: 137 },    // row 3: attack2 / death
            ],
        },
        ranged: {
            cols: [
                { x: 0, w: 80 },       // col 0: front
                { x: 128, w: 88 },     // col 1: front-angle
                { x: 258, w: 86 },     // col 2: back-angle
                { x: 392, w: 82 },     // col 3: back
                { x: 511, w: 89 },     // col 4: side
                { x: 634, w: 105 },    // col 5: side-walk1
                { x: 761, w: 108 },    // col 6: side-walk2
                { x: 883, w: 112 },    // col 7: extra/death
            ],
            rows: [
                { y: 1, h: 121 },      // row 0: idle
                { y: 140, h: 122 },    // row 1: walk
                { y: 269, h: 134 },    // row 2: cast
                { y: 411, h: 130 },    // row 3: cast2 / death
            ],
        },
    },

    load(callback) {
        const toLoad = {
            melee: 'assets/melee_spritesheet.png',
            ranged: 'assets/mage_spritesheet.png',
            floor: 'assets/floor.png',
            boss_demon_lord: 'assets/Demonlord.png',
            boss_dragon: 'assets/Dragon.png',
            boss_lich: 'assets/Lich.png',
            boss_skeleton_lord: 'assets/Skeletonlord.png',
            boss_slime_king: 'assets/Slimeking.png',
            slime_minion: 'assets/slimMinion.png',
            goblin: 'assets/goblin.png',
            skeleton: 'assets/skeleton.png',
            orc: 'assets/orc.png',
            troll: 'assets/troll.png',
            archer: 'assets/archer.png',
            imp: 'assets/imp.png',
            mage_mob: 'assets/mage_mob.png',
            fire_elemental: 'assets/fire_elemental.png',
            proj_arrow: 'assets/arrow.png',
            proj_firebolt: 'assets/firebolt.png',
            proj_frostbolt: 'assets/frostbolt.png',
            proj_purple_bolt: 'assets/PurpleBolt.png',
        };

        let remaining = Object.keys(toLoad).length;

        for (const [key, src] of Object.entries(toLoad)) {
            const img = new Image();
            img.onload = () => {
                this.sheets[key] = img;
                remaining--;
                if (remaining === 0) {
                    this.loaded = true;
                    if (callback) callback();
                }
            };
            img.onerror = () => {
                console.warn(`Failed to load sprite: ${src}`);
                remaining--;
                if (remaining === 0) {
                    this.loaded = true;
                    if (callback) callback();
                }
            };
            img.src = src;
        }
    },

    // Layout (8 cols x 4 rows):
    // Col 0: front, Col 1: front-angle, Col 2: back-angle, Col 3: back
    // Col 4: side, Col 5: side-walk1, Col 6: side-walk2, Col 7: extra
    // Row 0: idle, Row 1: walk, Row 2: action, Row 3: action2+death

    getDirectionCol(facingX, facingY) {
        const angle = ((Math.atan2(facingY, facingX) * 180 / Math.PI) + 360) % 360;

        if (angle >= 315 || angle < 45) {
            return { col: 4, flip: false };    // Right
        } else if (angle >= 45 && angle < 135) {
            return { col: 0, flip: false };    // Down (front)
        } else if (angle >= 135 && angle < 225) {
            return { col: 4, flip: true };     // Left (mirror right)
        } else {
            return { col: 3, flip: false };    // Up (back)
        }
    },

    getFrame(sheetKey, col, row) {
        const fd = this.frameData[sheetKey];
        const c = fd.cols[Math.min(col, fd.cols.length - 1)];
        const r = fd.rows[Math.min(row, fd.rows.length - 1)];
        return { x: c.x, y: r.y, w: c.w, h: r.h };
    },

    draw(ctx, sheetKey, x, y, facingX, facingY, state, drawSize, flashWhite) {
        const sheet = this.sheets[sheetKey];
        if (!sheet) return false;

        const fd = this.frameData[sheetKey];
        if (!fd) return false;

        const dir = this.getDirectionCol(facingX, facingY);
        let col = dir.col;
        const flip = dir.flip;
        let row = 0;

        const time = performance.now();

        if (state === 'death') {
            row = 3;
            col = 6 + (Math.floor(time / 400) % 2); // cols 6-7 on row 3
        } else if (state === 'attack' || state === 'cast') {
            const frame = Math.floor(time / 200) % 3;
            if (col === 0 || col === 1) {
                // Front-facing action: use cols 0-1 on rows 2-3
                row = 2 + (frame > 1 ? 1 : 0);
                col = frame > 1 ? 0 : frame;
            } else {
                row = 2;
            }
        } else if (state === 'walk') {
            row = 1;
            if (col === 4) {
                // Side walk: cycle cols 4,5,6
                col = 4 + (Math.floor(time / 180) % 3);
            }
            // Front (col 0) and back (col 3) stay on their column — no alternation
            // since cols 0/1 and 2/3 are different facing angles, not walk frames
        }

        const frame = this.getFrame(sheetKey, col, row);

        // Scale to desired draw size (drawSize = target height in pixels)
        const scale = drawSize / frame.h;
        const drawW = frame.w * scale;
        const drawH = frame.h * scale;

        ctx.save();
        ctx.translate(x, y);

        if (flip) {
            ctx.scale(-1, 1);
        }

        ctx.imageSmoothingEnabled = false;

        ctx.drawImage(
            sheet,
            frame.x, frame.y, frame.w, frame.h,
            -drawW / 2, -drawH / 2, drawW, drawH
        );

        // White flash overlay when hit
        if (flashWhite) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.restore();
        return true;
    },

    // Boss sprite sheets: 9-col x 6-row layout (per-sheet frame data)
    // Row 0: Idle Down, Row 1: Walk Down, Row 2: Walk Up
    // Row 3: Walk Side, Row 4: Attack Down, Row 5: Death
    bossFrameData: {
        boss_slime_king:    { cols: 9, colW: 72,  rowStarts: [0, 93, 182, 273, 357, 451],  rowHeights: [93, 89, 91, 84, 94, 108] },
        boss_dragon:        { cols: 9, colW: 73,  rowStarts: [0, 95, 180, 271, 358, 453],  rowHeights: [95, 85, 91, 87, 95, 106] },
        boss_skeleton_lord: { cols: 9, colW: 72, rowStarts: [9, 93, 186, 285, 372, 465], rowHeights: [84, 93, 92, 87, 93, 87] },
        boss_demon_lord:    { cols: 9, colW: 247, rowStarts: [30, 350, 661, 962, 1257, 1563], rowHeights: [251, 240, 241, 240, 246, 255] },
        boss_lich:          { cols: 9, colW: 114, rowStarts: [0, 147, 283, 428, 557, 698], rowHeights: [147, 136, 145, 129, 141, 181] },
        slime_minion:       { cols: 7, colW: 248, colOffset: 1, rowStarts: [0, 338, 649, 959, 1254, 1582], rowHeights: [338, 311, 310, 295, 328, 338] },
        // Regular mob sprites (same 9-col x 6-row layout)
        goblin:             { cols: 9, colW: 248, rowStarts: [125, 413, 710, 1028, 1280, 1600], rowHeights: [162, 174, 184, 180, 229, 206] },
        skeleton:           { cols: 9, colW: 248, rowStarts: [132, 413, 711, 1028, 1280, 1635], rowHeights: [150, 174, 182, 176, 226, 171] },
        orc:                { cols: 9, colW: 248, rowStarts: [88, 420, 711, 1027, 1280, 1605], rowHeights: [195, 167, 183, 182, 231, 207] },
        troll:              { cols: 9, colW: 248, rowStarts: [80, 414, 708, 1027, 1280, 1633], rowHeights: [203, 174, 186, 178, 233, 178] },
        archer:             { cols: 9, colW: 248, rowStarts: [52, 413, 709, 1032, 1280, 1618], rowHeights: [232, 197, 206, 175, 239, 196] },
        imp:                { cols: 9, colW: 248, rowStarts: [79, 419, 709, 1026, 1280, 1629], rowHeights: [203, 168, 185, 179, 237, 192] },
        mage_mob:           { cols: 9, colW: 248, rowStarts: [57, 320, 640, 1032, 1280, 1618], rowHeights: [262, 150, 392, 248, 338, 194] },
        fire_elemental:     { cols: 9, colW: 248, rowStarts: [66, 390, 694, 1010, 1254, 1596], rowHeights: [224, 199, 200, 196, 255, 227] },
    },

    // Projectile sprite data (single-row animation strips)
    projFrameData: {
        proj_arrow:       { cols: 6, colW: 248, rowStart: 63, rowHeight: 149 },
        proj_firebolt:    { cols: 9, colW: 248, rowStart: 81, rowHeight: 184 },
        proj_frostbolt:   { cols: 9, colW: 248, rowStart: 59, rowHeight: 185 },
        proj_purple_bolt: { cols: 9, colW: 248, rowStart: 1, rowHeight: 251 },
    },

    drawBoss(ctx, sheetKey, x, y, facingX, facingY, state, drawSize, flashWhite) {
        const sheet = this.sheets[sheetKey];
        if (!sheet) return false;

        const fd = this.bossFrameData[sheetKey];
        if (!fd) return false;

        const sheetW = sheet.naturalWidth || sheet.width;
        const numCols = fd.cols;
        const colW = fd.colW;

        const time = performance.now();
        let row, col, flip = false;

        const angle = ((Math.atan2(facingY, facingX) * 180 / Math.PI) + 360) % 360;
        const facingUp = angle >= 225 && angle < 315;
        const facingLeft = angle >= 135 && angle < 225;
        const facingRight = angle >= 315 || angle < 45;

        if (state === 'death') {
            row = 5;
            col = Math.floor(time / 300) % numCols;
        } else if (state === 'attack') {
            row = 4;
            col = Math.floor(time / 150) % numCols;
        } else if (state === 'walk') {
            // Directional walk rows
            if (facingUp) {
                row = 2; // Walk Up
            } else if (facingLeft || facingRight) {
                row = 3; // Walk Side
                flip = facingLeft;
            } else {
                row = 1; // Walk Down
            }
            col = Math.floor(time / 150) % numCols;
        } else {
            // Idle
            row = 0;
            col = Math.floor(time / 200) % numCols;
            if (facingLeft) flip = true;
        }

        const sx = (col + (fd.colOffset || 0)) * colW;
        const sy = fd.rowStarts[row] || 0;
        const sw = Math.min(colW, sheetW - sx);
        const sh = fd.rowHeights[row] || colW;

        // Use idle row (row 0) height as reference so all rows render at consistent size
        const refH = fd.rowHeights[0] || sh;
        const scale = drawSize / refH;
        const drawW = sw * scale;
        const drawH = sh * scale;

        ctx.save();
        ctx.translate(x, y);
        if (flip) ctx.scale(-1, 1);
        ctx.imageSmoothingEnabled = false;

        ctx.drawImage(
            sheet,
            sx, sy, sw, sh,
            -drawW / 2, -drawH / 2, drawW, drawH
        );

        if (flashWhite) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.restore();
        return true;
    },

    // Regular mob sprites — same directional logic as bosses
    drawMob(ctx, sheetKey, x, y, facingX, facingY, state, drawSize, flashWhite) {
        const sheet = this.sheets[sheetKey];
        if (!sheet) return false;

        const fd = this.bossFrameData[sheetKey];
        if (!fd) return false;

        const sheetW = sheet.naturalWidth || sheet.width;
        const numCols = fd.cols;
        const colW = fd.colW;

        const time = performance.now();
        let row, col, flip = false;

        const angle = ((Math.atan2(facingY, facingX) * 180 / Math.PI) + 360) % 360;
        const facingUp = angle >= 225 && angle < 315;
        const facingLeft = angle >= 135 && angle < 225;
        const facingRight = angle >= 315 || angle < 45;

        if (state === 'death') {
            row = 5;
            col = Math.floor(time / 300) % numCols;
        } else if (state === 'attack') {
            row = 4;
            col = Math.floor(time / 150) % numCols;
        } else if (state === 'walk') {
            if (facingUp) {
                row = 2;
            } else if (facingLeft || facingRight) {
                row = 3;
                flip = facingLeft;
            } else {
                row = 1;
            }
            col = Math.floor(time / 150) % numCols;
        } else {
            row = 0;
            col = Math.floor(time / 200) % numCols;
        }

        const sx = (col + (fd.colOffset || 0)) * colW;
        const sy = fd.rowStarts[row] || 0;
        const sw = Math.min(colW, sheetW - sx);
        const sh = fd.rowHeights[row] || colW;

        // Use idle row (row 0) height as reference so all rows render at consistent size
        const refH = fd.rowHeights[0] || sh;
        const scale = drawSize / refH;
        const drawW = sw * scale;
        const drawH = sh * scale;

        ctx.save();
        ctx.translate(x, y);
        if (flip) ctx.scale(-1, 1);
        ctx.imageSmoothingEnabled = false;

        ctx.drawImage(
            sheet,
            sx, sy, sw, sh,
            -drawW / 2, -drawH / 2, drawW, drawH
        );

        if (flashWhite) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.restore();
        return true;
    },

    drawProjectile(ctx, spriteKey, x, y, vx, vy, drawSize) {
        const sheet = this.sheets[spriteKey];
        if (!sheet) return false;

        const fd = this.projFrameData[spriteKey];
        if (!fd) return false;

        const time = performance.now();
        const col = Math.floor(time / 100) % fd.cols;

        const sx = col * fd.colW;
        const sy = fd.rowStart;
        const sw = fd.colW;
        const sh = fd.rowHeight;

        const scale = drawSize / sh;
        const drawW = sw * scale;
        const drawH = sh * scale;

        const angle = Math.atan2(vy, vx);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.imageSmoothingEnabled = false;

        ctx.drawImage(
            sheet,
            sx, sy, sw, sh,
            -drawW / 2, -drawH / 2, drawW, drawH
        );

        ctx.restore();
        return true;
    },
};
