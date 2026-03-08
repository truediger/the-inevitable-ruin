// ============================================================
// SAVE SYSTEM - The Inevitable Ruin
// ============================================================

const SaveSystem = {
    STORAGE_KEY: 'inevitable_ruin_saves',
    MAX_SLOTS: 10,

    getAllSaves() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    },

    save(slotIndex, gameState) {
        const saves = this.getAllSaves();
        saves[slotIndex] = {
            timestamp: Date.now(),
            player: gameState.player,
            floor: gameState.floor,
            wave: gameState.wave,
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(saves));
    },

    load(slotIndex) {
        const saves = this.getAllSaves();
        return saves[slotIndex] || null;
    },

    deleteSave(slotIndex) {
        const saves = this.getAllSaves();
        saves[slotIndex] = null;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(saves));
    },

    getNextFreeSlot() {
        const saves = this.getAllSaves();
        for (let i = 0; i < this.MAX_SLOTS; i++) {
            if (!saves[i]) return i;
        }
        return saves.length < this.MAX_SLOTS ? saves.length : -1;
    },
};
