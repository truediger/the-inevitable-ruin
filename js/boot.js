// ============================================================
// BOOT - loads Three.js as ES modules (post-processing lives in
// examples/jsm, which has no UMD build), exposes globals, then
// loads the classic game scripts in order.
// ============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

window.THREE = THREE;
window.PostFX = { EffectComposer, RenderPass, UnrealBloomPass, OutputPass };

const SCRIPTS = [
    'js/background.js',
    'js/loot.js',
    'js/touch.js',
    'js/sprites.js',
    'js/classes.js',
    'js/input.js',
    'js/particles.js',
    'js/save.js',
    'js/leaderboard.js',
    'js/projectiles.js',
    'js/monsters.js',
    'js/player.js',
    'js/tower.js',
    'js/ui.js',
    'js/vfx.js?v=6',
    'js/characters3d.js?v=22',
    'js/props3d.js?v=4',
    'js/renderer3d.js?v=37',
    'js/main.js?v=3',
];

for (const src of SCRIPTS) {
    await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Failed to load ' + src));
        document.body.appendChild(s);
    });
}
