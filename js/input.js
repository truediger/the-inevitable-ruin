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
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
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
        return { x: dx, y: dy };
    },
};
