// ============================================================
// TOUCH CONTROLS - The Inevitable Ruin
// Virtual joystick (left side) + skill tap (right side)
// ============================================================

const Touch = {
    active: false,
    joystick: null, // { id, startX, startY, currentX, currentY }
    dx: 0,
    dy: 0,
    outerRadius: 70,
    innerRadius: 28,

    init(canvas) {
        // Only activate on touch devices
        if (!('ontouchstart' in window)) return;
        this.active = true;

        // Hide WASD keys on touch devices
        const wasd = document.getElementById('hud-controls');
        if (wasd) wasd.style.display = 'none';

        // Prevent all default touch behavior on canvas
        canvas.style.touchAction = 'none';

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            for (const t of e.changedTouches) {
                const x = t.clientX;
                const y = t.clientY;

                // Left 40% of screen = joystick
                if (x < window.innerWidth * 0.4 && !this.joystick) {
                    this.joystick = {
                        id: t.identifier,
                        startX: x,
                        startY: y,
                        currentX: x,
                        currentY: y,
                    };
                }
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (const t of e.changedTouches) {
                if (this.joystick && t.identifier === this.joystick.id) {
                    this.joystick.currentX = t.clientX;
                    this.joystick.currentY = t.clientY;
                }
            }
            this.updateMovement();
        }, { passive: false });

        const endTouch = (e) => {
            for (const t of e.changedTouches) {
                if (this.joystick && t.identifier === this.joystick.id) {
                    this.joystick = null;
                    this.dx = 0;
                    this.dy = 0;
                }
            }
        };

        canvas.addEventListener('touchend', endTouch);
        canvas.addEventListener('touchcancel', endTouch);

        // Make skill slots respond to touch (works alongside joystick)
        document.addEventListener('touchstart', (e) => {
            const el = e.target.closest('.skill-slot');
            if (el) {
                e.preventDefault();
                e.stopPropagation();
                el.click(); // fires addEventListener handlers
            }
        }, { passive: false });
    },

    updateMovement() {
        if (!this.joystick) {
            this.dx = 0;
            this.dy = 0;
            return;
        }

        let dx = this.joystick.currentX - this.joystick.startX;
        let dy = this.joystick.currentY - this.joystick.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 10) {
            this.dx = 0;
            this.dy = 0;
            return;
        }

        this.dx = dx / dist;
        this.dy = dy / dist;
    },

    getMovement() {
        return { x: this.dx, y: this.dy };
    },

    draw(ctx) {
        if (!this.active || !this.joystick) return;

        const j = this.joystick;
        const R = this.outerRadius;
        const r = this.innerRadius;

        // Calculate thumb position clamped to outer radius
        let dx = j.currentX - j.startX;
        let dy = j.currentY - j.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let thumbX = j.currentX;
        let thumbY = j.currentY;
        if (dist > R) {
            thumbX = j.startX + (dx / dist) * R;
            thumbY = j.startY + (dy / dist) * R;
        }

        // Direction angle for the arc indicator
        const angle = Math.atan2(dy, dx);

        ctx.save();

        // -- Outer circle (dark, translucent) --
        ctx.beginPath();
        ctx.arc(j.startX, j.startY, R, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // -- Directional arrow triangles (subtle, at N/S/E/W) --
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#ffffff';
        const arrowDist = R * 0.7;
        const arrowSize = 8;
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 - Math.PI / 2; // start from top
            const ax = j.startX + Math.cos(a) * arrowDist;
            const ay = j.startY + Math.sin(a) * arrowDist;
            ctx.beginPath();
            ctx.moveTo(ax + Math.cos(a) * arrowSize, ay + Math.sin(a) * arrowSize);
            ctx.lineTo(ax + Math.cos(a + 2.3) * arrowSize, ay + Math.sin(a + 2.3) * arrowSize);
            ctx.lineTo(ax + Math.cos(a - 2.3) * arrowSize, ay + Math.sin(a - 2.3) * arrowSize);
            ctx.closePath();
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // -- Direction arc (bright blue, shows where you're pointing) --
        if (dist > 10) {
            ctx.beginPath();
            ctx.arc(j.startX, j.startY, R - 4, angle - 0.6, angle + 0.6);
            ctx.strokeStyle = '#3399ff';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.7;
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Glow on the arc
            ctx.beginPath();
            ctx.arc(j.startX, j.startY, R - 4, angle - 0.4, angle + 0.4);
            ctx.strokeStyle = '#66bbff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.4;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // -- Inner thumb (blue circle with gradient) --
        const gradient = ctx.createRadialGradient(
            thumbX - 4, thumbY - 4, 2,
            thumbX, thumbY, r
        );
        gradient.addColorStop(0, '#66bbff');
        gradient.addColorStop(0.5, '#2288ee');
        gradient.addColorStop(1, '#1166cc');

        ctx.beginPath();
        ctx.arc(thumbX, thumbY, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.85;
        ctx.fill();

        // Thumb border
        ctx.strokeStyle = '#55aaff';
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.6;
        ctx.stroke();

        // Thumb highlight (top-left shine)
        ctx.beginPath();
        ctx.arc(thumbX - 5, thumbY - 5, r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.globalAlpha = 1;
        ctx.fill();

        ctx.restore();
    },
};
