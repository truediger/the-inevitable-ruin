# The Inevitable Ruin - Project Guide

Three.js top-down-ish arena RPG / endless tower crawler.
Repo: truediger/the-inevitable-ruin

**Must be served over HTTP** (`npx serve .` or `python -m http.server`) — WebGL textures taint from `file://`.

## Architecture

**Script loading:** `index.html` has an import map + `js/boot.js` (ES module). boot.js imports Three.js r160 and the post-processing addons (`examples/jsm` has no UMD build), exposes `window.THREE` + `window.PostFX`, then injects the classic game scripts sequentially. Because injected scripts can land after the window `load` event, `main.js` checks `document.readyState` before wiring its load listener. Bump the `?v=` query on a script in boot.js's SCRIPTS list to cache-bust it.

**3D Renderer:** Everything gameplay-visible lives in the Three.js scene. The environment is real geometry: textured floor plane, brick walls + pillars extruded along `Game.playBoundaryPx` (the collision polygon — visuals and collision share the same data), flickering torch sprites with capped point lights (max 4), biome palettes in `Renderer3D.BIOMES` keyed by background name. Rendering goes through an `EffectComposer` (RenderPass -> UnrealBloomPass -> OutputPass) with ACES filmic tone mapping; anything meant to glow (staff orbs, torch flames, glow weapons, boss eyes) is authored as emissive material so bloom picks it up. Characters and monsters are procedural low-poly rigs from `js/characters3d.js` — primitives only, no mesh assets, built forward = +Z, animated by stateless pose-from-time formulas (`_animHumanoid`, `_animSlime`, `_animDragon`, `_animLich`, `_animElemental`). They are **cel-shaded**: `MeshToonMaterial` with a stepped `gradientMap` ramp (`_RAMP_MATTE` for cloth/skin, `_RAMP_SHINY` for metal) plus an inverted-hull outline — a `BackSide` shell of the same cached geometry, expanded per-axis so the line width stays even on thin parts (`_addOutline`). Hit-flash is a white emissive override plus a color lerp; frozen is a lerp toward ice blue; shadows are real (castShadow on parts). Loot and projectiles are `THREE.Sprite`s. The camera smoothly follows a point 45% of the way from arena center to the player (`CAM_FOLLOW`). The 2D canvas overlay draws ONLY damage numbers (and the menu fallback). The biome panorama remains a CSS background behind the WebGL canvas, visible above the walls.

**Key Files:**
| File | Purpose |
|---|---|
| `js/boot.js` | ES-module bootstrap: Three.js + PostFX globals, then sequential game-script loading |
| `js/vfx.js` | Pooled effects: immediate-mode shapes (`ring`/`disc`/`glow`/`beam`/`arc`) + transient particles (`burst`/`dust`) |
| `js/props3d.js` | Procedural set dressing — per-biome prop factories (`statue`, `altar`, `brazier`, `crystal`, …) + wall-hugging placement |
| `js/characters3d.js` | Procedural low-poly character rigs: `CLASS_RIGS`/`MOB_RIGS` recipes, weapon builders, animation |
| `js/sprites.js` | Sprite loader, frame data. Still used for projectiles, loot, and UI portraits (NOT characters) |
| `js/classes.js` | Class definitions, stat trees, skill pools |
| `js/renderer3d.js` | Full 3D renderer: `buildEnvironment`, `_renderEntity` (character rigs), `renderLoot3D`, `renderProjectiles3D`, `renderEffects`, composer setup |
| `js/player.js` | Player entity, combat, skills, input handling |
| `js/monsters.js` | Monster definitions, AI behavior, boss abilities |
| `js/ui.js` | UI manager, menus, class select, HUD |
| `js/tower.js` | Floor progression, spawning, game loop |
| `css/style.css` | All styling, menu themes, character select |

## Class Hierarchy

```
Brawler (Tier 1) -> brawler spritesheet
  Berserker (Lv6) -> berserker spritesheet
    Warlord (Lv15), Reaper (Lv15)
  Guardian (Lv6) -> guardian spritesheet (7-col / 192px)
    Juggernaut (Lv15), Sentinel (Lv15)
  Paladin (Lv6) -> paladin spritesheet
    Crusader (Lv15), Templar (Lv15)

Mage (Tier 1) -> ranged (mage) spritesheet
  Fire Mage (Lv6) -> fire_mage spritesheet
    Pyromancer (Lv15), Inferno Mage (Lv15)
  Frost Mage (Lv6) -> frost_mage spritesheet
    Cryomancer (Lv15), Ice Warden (Lv15)
  Arcane Mage (Lv6) -> arcane_mage spritesheet
    Necromancer (Lv15)
  Warlock (Lv6) -> warlock spritesheet
```

## Sprite System

**Adding a new class spritesheet (3 steps):**
1. Process image: copy to `assets/`, remove background, clean labels
2. Add to `sprites.js`: entry in `toLoad` map + `frameData` block
3. Add `spriteSheet: 'key'` to relevant class definitions in `classes.js`

**Standard frame layout:** 8 columns x 4 rows, 168x192px cells (1344x768 total)
- Row 0: idle, Row 1: walk, Row 2: attack/cast, Row 3: attack2/death
- Col 0: front, Col 1: front-angle, Col 2: back-angle, Col 3: back, Col 4: side, Col 5-7: walk cycle/extra

**Exceptions:** Guardian uses 7-col (192x192px cells). Paladin doesn't follow any grid — it's a scattered pose collection, mapped via the `frames` format: a 4x8 array of explicit `{x,y,w,h}` source rects, one per semantic slot (row = state, col = direction/frame), plus `flipSide: true` because its side poses face left natively. `getFrame` uses `frames` when present, falling back to `cols`/`rows`. Always verify grid with boundary pixel analysis (alpha-gap bands per row AND per column — check that assumed row boundaries don't cut through sprites).

**Boss frame layout:** 9 columns x 6 rows (per-sheet dimensions vary)
- Row 0: idle down, Row 1: walk down, Row 2: walk up, Row 3: walk side, Row 4: attack, Row 5: death

## AI Spritesheet Processing Pipeline

When processing AI-generated spritesheets:

1. **Detect grid layout first.** Count opaque pixels at 168px vs 192px column boundaries. AI generators don't always produce 8 columns.
2. **Background removal:** Color distance from sampled corner + saturation < 15% + brightness > 100. The brightness gate protects dark armor from being erased along with gray background.
3. **Remove text labels:** Connected component analysis per cell, erase fragments < 300 pixels.
4. **Remove floor shadows:** Low-saturation + brightness < 100 in bottom 32px of each cell.
5. **Erode fringe:** Remove isolated opaque pixels (<=1 opaque neighbor).

## AI Art Prompt Rules

- Always include "NO TEXT LABELS" prominently
- Specify exact pixel dimensions ("total image 1344x768, each cell 168x192")
- Use "solid flat gray (#888888) background"
- Never use trademarked terms: no "Pixar", "chibi", "Disney"
- Use "stylized 3D-rendered cartoon proportions, big head, small body" instead
- Describe distinctive visual elements (armor color, weapon, accessories)
- Specify row contents explicitly (Row 1: idle, Row 2: walk, etc.)

## Render Path Gotchas

- **Animation state** lives in `renderer3d.js:_charState`, which returns `{state, p}` where `p` is 0..1 progress through an attack. Attacks animate on their own clock (`ATTACK_MS`/`CAST_MS`), started when `swingTimer`/`castTimer` *jumps up* — driving the pose off the raw timer makes a 0.15s swing a twitch. Monsters derive `p` from `attackSpeed - attackTimer`. New animation triggers go there.
- **Attack poses are phase curves,** not sine waves: `_chop`/`_punch`/`_castPose` return arm angle plus body lean/lunge/squash for anticipation → strike → recovery. `_actionP` falls back to a time loop when no `attackP` is supplied (that's how viewer.html animates).
- **Material pass runs BEFORE the anim pass** in `update()` — the flash/frozen loop resets `emissiveIntensity` on every material, so anything animating glow (staff orb, elemental core) must run after it or be silently overwritten.
- **Outline thickness** comes from `Characters3D._ow`, set in `create()` from rig height; `_part(..., noOutline)` skips the shell for glowing bits (orbs, glow eyes, flames) and tiny details are auto-skipped. Outlines share one material — never dispose it per instance. Set `Characters3D.OUTLINES = false` to drop them if draw calls ever matter.
- **Rig rebuilds on class change:** `Characters3D.keyFor` (className / typeId) is compared each frame; mismatch disposes and rebuilds the rig — this is how spec-into-a-new-class updates the model.
- **Geometry is cached and shared** (`Characters3D._geoCache`) — NEVER dispose geometries per-instance; `Characters3D.dispose` only disposes materials. Prune entity rigs via `_pruneChars` or materials leak.
- **Pose-from-time animation:** every anim function fully re-sets rotations each frame. Never accumulate rotation across frames or states will corrupt each other.
- **Environment rebuilds** whenever `envKey` (biome + arena size + floor-image-loaded flag) changes — resize and biome transitions are both covered by this one check.
- **Environment teardown disposes everything it traverses.** Cached geometry/materials shared with the character rigs are tagged `userData.shared` and skipped — without that tag, changing biome frees geometry the rigs are still drawing with. Tag anything shared that gets parented into `envGroup`.
- **Props are static** (`Props3D.populate`, one call per environment build) and are placed along the wall polygon using its inward normal; the play boundary *is* the wall line, so anything further in gets walked through. Layout is seeded from biome + polygon, so it's stable per environment but varies per biome. Prop flames are pushed into `this.torches` and flicker with `t.base` as their size.
- **Biome is driven by `Tower.floor`,** not `Background.current` — `main.js` calls `Background.setFloor(Tower.floor)` every frame, so assigning `current` directly is silently reverted. Set the floor to test a biome (`.skill-refs/smoketest/props_shots.js` does this and also guards the shared-geometry regression).
- **Sprites are legacy for characters** but still the live path for projectiles (`projFrameData`), loot images, and UI class portraits.
- **VFX is pooled, never allocated per frame.** `VFX.begin()` runs before entities, `VFX.end()` + `VFX.update(camera)` after effects; draw calls in between grab a hidden pool object and configure it. Nothing is created or disposed during play — the old `renderEffects` rebuilt and disposed every mesh each frame.
- **Effects glow via HDR, not opacity.** `_tint` multiplies color above 1.0; the composer's HalfFloat target keeps the overflow and `UnrealBloomPass` (threshold 1.0) blooms it. Raising `opacity` instead just makes an effect muddy.
- **Effect timers decay in the game loop** (`skillEffect.timer`, `explosion.timer`) — when screenshotting effects, capture within ~60ms of triggering or they've already faded. `.skill-refs/smoketest/vfx_shots.js` forces each effect and captures them.
- **One-shot spawns need edge detection:** explosion shards key off `_seenExp`, hit sparks off `inst._wasFlash`, footstep dust off a sign flip of the same walk sine the rig animates on. Transient particles are capped at `VFX.MAX_PARTICLES` and silently dropped when exhausted.
- **Smoke test:** `.skill-refs/smoketest/smoke.js` (gitignored) drives a headless Edge run: serves on :8321, starts a brawler + mage run, screenshots, and dumps console errors.
- **Character viewer:** `viewer.html` renders every class + mob rig in a labeled lineup (`?state=idle|walk|attack|cast`); `.skill-refs/smoketest/viewer_shots.js` screenshots each row. Always review rigs there, not in random gameplay shots.

## UI Theme

- Background: `bg_temple.png` used on main menu, character select, and game-over screens
- Cards: dark purple (`rgba(10-15, 5-10, 20-25, 0.85)`), purple border (`#665588`), `backdrop-filter: blur(6px)`
- Title: red with glow + dark drop shadow for readability over busy BG
- Buttons: purple gradient matching temple aesthetic

## Bosses

5 bosses. **The 3D rigs are matched to the painted spritesheets in `assets/`** — open the PNG before changing a boss rig; the names alone are misleading (the Dragon is a bipedal wyvern, not a quadruped; the Demon Lord is an armored knight, not a bare-skinned demon). Boss entries in `MOB_RIGS` pin their own `primary`/`secondary`, so their palette does NOT follow the `color` in `monsters.js` (`create()` only fills `primary` when a rig leaves it undefined).

| Boss | Art (assets/) | Rig signature | Mechanic |
|---|---|---|---|
| Slime King | `Slimeking.png` | lumpy blob of overlapping spheres, base lobes + drips, gloss highlight, face, gold mantle, jewelled crown (`_buildSlimeKing`) | splits into minions |
| Skeleton Lord | `Skeletonlord.png` | bone armor over an exposed ribcage, toothed skull with jaw + brow, spike crown, frayed purple cape + tabard, fullered blue greatsword | Bone Storm nova |
| Dragon | `Dragon.png` | **bipedal** wyvern: hind legs, banded belly scutes, toothed jaw, back-swept horns, panelled membrane wings, two-segment tail | Fire Breath cone |
| Lich | `Lich.png` | tattered robe, open hood over a pale skull, skeletal hands, blue skull staff, chest rune, orbiting wisps | teleport + Dark Ritual |
| Demon Lord | `Demonlord.png` | dark plate with molten ember cracks, pale bull horns, browed demon face, robe skirt, flaming sword with fire licks | Hellfire Slam |

**Enchanted weapons carry a live aura.** A rig sets `weaponFx: 'fire' | 'frost'`; `_buildWeapon` then adds the matching static detail (fire licks / rime shards) and drops an `fxAnchor` Object3D at mid-blade. Each frame `Renderer3D._weaponAura` reads that anchor's **world** position — so the aura follows the full swing — and calls `VFX.weaponAura`, which owns the look for both elements (embers rise, frost sinks). `bosses.html` calls the same function, so the review page and the game can't drift apart.

**Every boss carries secondary motion** — jiggle (slime), membrane ripple / tail wave / breathing / jaw (dragon), cape sway, wisp orbit, blade and ember pulses. Two generic hooks drive the last ones: `_pulse(inst, mesh, base, speed, amt)` registers an emissive mesh to breathe, and `inst.wisps` entries orbit. Both run in `update()` *after* the anim pass (the material reset would otherwise clobber them) and pulses are skipped while `ctx.flash` is set so hit feedback stays readable.

**Two proportion profiles** in `_buildHumanoid`: chibi (~3 heads, players — matches the big-head class art) and `heroic: true` (~6.5 heads, boss lords). Heroic also adds boots, floor-length flared capes and bigger pauldrons; sharing the chibi profile made the lords read as stubby children.

**Detail sunk inside a body is the most common rig bug.** Faces, mouths and mantles must be placed past the *local* surface radius of whatever sphere they sit on — a mouth at z=0.26 on a blob whose surface is at z=0.33 simply disappears. When a feature "doesn't show up", check depth before rebuilding it.

**Viewers:** `bosses.html` shows each boss's spritesheet frame above its live rig (idle/walk/attack) — use it to judge art fidelity. `viewer.html?per=1&camy=9&camz=19` isolates one rig per row for close review; the default 5-across layout is too small to judge boss detail.
