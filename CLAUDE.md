# The Inevitable Ruin - Project Guide

HTML5 Canvas top-down arena RPG / endless tower crawler.
Repo: truediger/the-inevitable-ruin

## Architecture

**Hybrid Renderer:** Three.js for 3D floor/walls + transparent 2D canvas overlay for all sprites (player, monsters, projectiles, loot). Gameplay sprites are drawn via `Renderer3D.render()` -> `drawSprite2D()` on the 2D overlay, NOT in the 3D scene.

**Key Files:**
| File | Purpose |
|---|---|
| `js/sprites.js` | Sprite loader, frame data, draw methods (draw, drawBoss, drawMob, drawProjectile) |
| `js/classes.js` | Class definitions, stat trees, skill pools. `spriteSheet` property overrides default sprite |
| `js/renderer3d.js` | 3D/2D hybrid renderer. `drawSprite2D`, `renderLoot2D`, `renderProjectiles2D` |
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

**Exception:** Guardian uses 7-col (192x192px cells). Always verify grid with boundary pixel analysis.

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

- **Triple isAttacking check:** Animation state is checked in `player.js` (2D draw), `renderer3d.js:getPlayerFrame`, AND `renderer3d.js:drawSprite2D`. All three must be updated for new animation triggers.
- **castTimer:** Ranged classes use `castTimer` (set on auto-attack and skill use) to trigger cast animation frames.
- **Sprite key lookup:** `entity.classData.spriteSheet || (type === 'melee' ? 'melee' : 'ranged')` -- the fallback chain for sprite selection.

## UI Theme

- Background: `bg_temple.png` used on main menu, character select, and game-over screens
- Cards: dark purple (`rgba(10-15, 5-10, 20-25, 0.85)`), purple border (`#665588`), `backdrop-filter: blur(6px)`
- Title: red with glow + dark drop shadow for readability over busy BG
- Buttons: purple gradient matching temple aesthetic

## Bosses

5 bosses with existing sprite assets:
- Slime King (green, melee, splits into minions)
- Skeleton Lord (bone-yellow, melee, Bone Storm nova)
- Dragon (red, ranged, Fire Breath cone)
- Lich (purple, ranged, teleport + Dark Ritual nova)
- Demon Lord (dark red, melee, Hellfire Slam ground AoE)
