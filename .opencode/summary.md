## Goal
- Build a professional desktop soccer tactics board app (like TacticalPad) as an Electron application.

## Constraints & Preferences
- Must be a desktop app (Electron), not a single HTML file.
- Must have drag-and-drop player tokens, formation presets, drawing tools, equipment, connections, text, and export.
- Must run on Windows (current dev environment) with cross-platform support.

## Progress
### Done
- **Text tool rewritten** — now uses a centered modal dialog with text input + size slider (range 8–72).
- **Text type changed** from `type: 'textbox'` (bounding box with word-wrap) to `type: 'text'` (point text at `x, y` with centered alignment).
- **Text rendering** — draws text directly on the pitch (no background rectangle, no clip).
- **Text drag support** — select mode detects text hit, sets `dragTextIndex`, drags position via `mousemove`, commits on `mouseup`.
- **Dialog size control** — `textDialogSize` range slider in the dialog, updates `d.fontSize` on OK.
- **Double-click re-edit** — opens the dialog for existing text.
- **Equipment buttons with SVG icons** — each equipment button in the right panel now shows a colored SVG icon instead of text label.
- **Realistic 3D equipment visuals** — cone (gradient taper + reflective bands + base), ball (radial-gradient sphere with pentagon panels + glossy highlight), mannequin (yellow soccer dummy with radial head, shoulder stubs, forearms, chest number, base stand), hurdle (tubular frame + highlight + feet pads), ring (torus with highlight/shadows), pole (cylindrical gradient + disc base + reflective stripes), flag (waving curved cloth + fold detail + pole knob), ladder (dual rail + rungs), leader (3D arrow with depth + highlight).
- **Connection shapes** (triangle + connector) fully implemented and reworked.
- `history.push()` accepts 4th argument `connections`; `history.js` stores/restores it.
- All previous fixes remain: C1–C5, H1–H7, M1/M5/M6/M7/M9, animation system, print support, GIF encoder, horizontal pitch, eraser cursor, equipment labels removed, two-column player list, drag jitter fix, 60fps option, duplicateSelection fix.
- Added `roundRect` polyfill in `DrawingEngine` constructor.

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Text is now `type: 'text'` with single `x, y` position instead of `type: 'textbox'` bounding box — simpler, feels like Photoshop/Paint point text.
- Text input uses a centered modal dialog (`#textDialog`) instead of transparent overlay.
- Dialog includes its own size slider so user controls font size at creation time.
- Equipment buttons use inline SVG icons instead of text.
- Mannequin is yellow soccer training dummy with 3D shading.
- All equipment uses canvas gradients for 3D appearance (linear/radial gradients, highlights, shadows).

## Next Steps
- Fine-tune equipment 3D visuals if needed.
- Any remaining UX polish.

## Critical Context
- Pitch dimensions (horizontal): PITCH_W=1050, PITCH_H=680.
- `history.push()` takes 4 arguments: `players`, `drawings`, `equipment`, `connections`.
- Text drawings (`type: 'text'`) store `x, y, text, fontSize, color, opacity` — rendered centered at `(x, y)`.
- Text dialog: `#textDialog` (overlay), `#textDialogInput` (text), `#textDialogSize` (slider), OK/Cancel buttons.
- Text drag uses `dragTextIndex` variable alongside `dragPlayerIndex`/`dragEquipIndex`.
- Equipment buttons: `.eq-btn svg { width:22px; height:22px; }`.

## Relevant Files
- `src/js/app.js`: Text tool mousedown handler (creates `type: 'text'`), `showTextEditor`/`finishTextEdit` (modal dialog), text drag (`dragTextIndex`), selected text outline.
- `src/js/drawings.js`: `case 'text':` in `draw()` (renders centered text, no background), `hitTest`/`hitTestText` detect text by distance from `(x, y)`.
- `src/js/equipment.js`: All equipment `draw()` cases with full 3D rendering.
- `src/js/history.js`: `push()` accepts 4th argument `connections`.
- `src/css/app.css`: `.text-dialog-*` modal styles, `.eq-btn svg` icon sizing.
- `src/index.html`: `#textDialog` modal HTML with input, size slider, OK/Cancel; SVG icons in `.eq-btn` buttons.
