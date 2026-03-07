// ============================================================
// PARTICLE SYSTEM - The Inevitable Ruin
// ============================================================

const Particles = {
    list: [],

    spawn(x, y, color, count = 5, speed = 100, life = 0.5, size = 3) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = speed * (0.5 + Math.random() * 0.5);
            this.list.push({
                x, y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                life,
                maxLife: life,
                color,
                size: size * (0.5 + Math.random()),
            });
        }
    },

    spawnDamageNumber(x, y, damage, color = '#fff') {
        const isString = typeof damage === 'string';
        const text = isString ? damage : Math.round(damage).toString();
        const big = isString ? text.length > 6 : damage > 50;
        this.list.push({
            x: x + (Math.random() - 0.5) * 10,
            y,
            vx: (Math.random() - 0.5) * 30,
            vy: -70,
            life: 1.0,
            maxLife: 1.0,
            color,
            size: 0,
            text,
            fontSize: big ? 22 : 18,
        });
    },

    update(dt) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const p = this.list[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.list.splice(i, 1);
            }
        }
    },

    draw(ctx) {
        for (const p of this.list) {
            const alpha = Math.max(0, p.life / p.maxLife);
            if (p.text) {
                ctx.globalAlpha = alpha;
                ctx.font = `bold ${p.fontSize}px monospace`;
                ctx.textAlign = 'center';
                // Dark outline for readability
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                ctx.strokeText(p.text, p.x, p.y);
                ctx.fillStyle = p.color;
                ctx.fillText(p.text, p.x, p.y);
            } else {
                ctx.globalAlpha = alpha * 0.8;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    },

    clear() {
        this.list = [];
    },
};
