// ============================================================
// INPUT HANDLER - The Inevitable Ruin
// ============================================================

const Input = {
    keys: {},
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,

    init(canvas) {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            // Prevent scrolling with arrow keys/space
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
            this.updateControlKeys();
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            this.updateControlKeys();
        });

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            this.mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
            this.mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
        });

        canvas.addEventListener('mousedown', () => { this.mouseDown = true; });
        canvas.addEventListener('mouseup', () => { this.mouseDown = false; });

        // Lose focus cleanup
        window.addEventListener('blur', () => {
            this.keys = {};
            this.mouseDown = false;
        });
    },

    isDown(key) {
        return !!this.keys[key.toLowerCase()];
    },

    updateControlKeys() {
        const keys = ['w', 'a', 's', 'd'];
        for (const k of keys) {
            const el = document.querySelector(`.ctrl-key[data-key="${k}"]`);
            if (el) {
                if (this.keys[k]) el.classList.add('active');
                else el.classList.remove('active');
            }
        }
    },

    getMovement() {
        let dx = 0, dy = 0;
        if (this.isDown('w') || this.isDown('arrowup')) dy -= 1;
        if (this.isDown('s') || this.isDown('arrowdown')) dy += 1;
        if (this.isDown('a') || this.isDown('arrowleft')) dx -= 1;
        if (this.isDown('d') || this.isDown('arrowright')) dx += 1;
        // Normalize diagonal
        if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx /= len;
            dy /= len;
        }
        // Merge touch joystick
        if (typeof Touch !== 'undefined' && Touch.active) {
            const t = Touch.getMovement();
            if (t.x !== 0 || t.y !== 0) {
                dx = t.x;
                dy = t.y;
            }
        }
        return { x: dx, y: dy };
    },
};
