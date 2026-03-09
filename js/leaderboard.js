// ============================================================
// LEADERBOARD - The Inevitable Ruin
// Firebase Realtime Database integration
// ============================================================

const Leaderboard = {
    db: null,
    scoresRef: null,
    MAX_ENTRIES: 100,
    lastSubmitTime: 0,
    RATE_LIMIT_MS: 10000,

    init() {
        // =====================================================
        // PASTE YOUR FIREBASE CONFIG HERE
        // Get it from: Firebase Console > Project Settings > Your Apps
        // =====================================================
        const firebaseConfig = {
            apiKey: "AIzaSyDdgkck_-0hSKig8xIaIYO57iX_D2tFnLM",
            authDomain: "the-inevitable-ruin.firebaseapp.com",
            databaseURL: "https://the-inevitable-ruin-default-rtdb.firebaseio.com",
            projectId: "the-inevitable-ruin",
            storageBucket: "the-inevitable-ruin.firebasestorage.app",
            messagingSenderId: "506742629688",
            appId: "1:506742629688:web:2a7f866340c17c55150dcd"
        };

        if (firebaseConfig.apiKey === "YOUR_API_KEY") {
            console.warn('Leaderboard: Firebase not configured. Paste your config in js/leaderboard.js');
            return;
        }

        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            this.db = firebase.database();
            this.scoresRef = this.db.ref('scores');
        } catch (err) {
            console.error('Leaderboard init error:', err);
        }
    },

    validateEntry(entry) {
        if (!entry.name || typeof entry.name !== 'string') return false;
        entry.name = entry.name.replace(/[<>&"']/g, '').trim();
        if (entry.name.length < 1 || entry.name.length > 20) return false;
        if (typeof entry.floor !== 'number' || entry.floor < 1 || entry.floor > 9999) return false;
        if (typeof entry.level !== 'number' || entry.level < 1 || entry.level > 9999) return false;
        return true;
    },

    async submitScore(entry) {
        if (!this.scoresRef) return { success: false, error: 'Leaderboard not configured.' };

        const now = Date.now();
        if (now - this.lastSubmitTime < this.RATE_LIMIT_MS) {
            return { success: false, error: 'Please wait before submitting again.' };
        }

        if (!this.validateEntry(entry)) {
            return { success: false, error: 'Invalid score data.' };
        }

        try {
            await this.scoresRef.push({
                name: entry.name,
                floor: entry.floor,
                level: entry.level,
                className: entry.className,
                classHistory: entry.classHistory || [],
                timestamp: firebase.database.ServerValue.TIMESTAMP,
            });
            this.lastSubmitTime = Date.now();
            return { success: true };
        } catch (err) {
            console.error('Leaderboard submit error:', err);
            return { success: false, error: 'Failed to submit score.' };
        }
    },

    async fetchScores(limit) {
        limit = limit || this.MAX_ENTRIES;
        if (!this.scoresRef) return [];

        try {
            const snapshot = await this.scoresRef
                .orderByChild('floor')
                .limitToLast(limit)
                .once('value');

            const scores = [];
            snapshot.forEach(child => {
                scores.push({ id: child.key, ...child.val() });
            });

            // Multi-field sort: floor desc, level desc, timestamp asc
            scores.sort((a, b) => {
                if (b.floor !== a.floor) return b.floor - a.floor;
                if (b.level !== a.level) return b.level - a.level;
                return (a.timestamp || 0) - (b.timestamp || 0);
            });

            return scores.slice(0, limit);
        } catch (err) {
            console.error('Leaderboard fetch error:', err);
            return [];
        }
    },
};
