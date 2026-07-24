# Beachside Sections — Interaction Prototype

A throwaway interaction test rig for the section/grouping behavior defined in
[`section-interaction-spec.md`](./section-interaction-spec.md). Built to let a
designer *feel* the interaction — auto-grow, membership, escape, overlapping
sections, section vs. scene drag — not to be production code.

## Run it

```bash
npm i
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`).

```bash
npm run build     # typecheck + production build, if you need it
npm run preview   # serve the production build locally
```

## How it's organized

```
src/
  types.ts                  Canvas domain types (Scene, Section, DragState, ...)
  lib/                       Pure, framework-free logic — the actual "rules"
    geometry.ts               rect containment / intersection / grow math
    dragLogic.ts               drop-target + wrap-padding decisions (the highlight contract)
    membership.ts              thin lookup over each scene's stored sectionId
    coords.ts                  screen <-> world conversions
    seed.ts                    12 default scenes + the 7 test scenarios
    constants.ts, id.ts
  store/
    canvasStore.ts             single Zustand store: state + every mutation/interaction
  hooks/
    useDerivedState.ts         live drag positions, highlight target, leaving/capture sets
    useKeyboardShortcuts.ts
  canvas/
    CanvasOriginContext.tsx    screen->world conversion shared with drag handlers
  components/
    Canvas/                    the infinite canvas: scenes, sections, labels, handles, overlays
    Toolbar/                   bottom tool pill (select / pan / annotate-placeholder / section) — undo/redo are keyboard-only
    LayerPanel/                left panel: sections with nested members + loose scenes
    DebugPanel/                live membership readout + bounds toggle + grow tuning sliders
    ScenariosDropdown/         resets canvas state to one of the 7 test scenarios
    ContextMenu/, Toast/
```

**Why it's structured this way:** `lib/` holds every geometry rule as plain,
testable functions with no React or store dependency — `dragLogic.ts` in
particular is the single source of truth for "would dropping here create
membership", called identically during live drag-over (for the highlight) and
at commit (to actually grow/capture). That's what keeps the highlight
grammar honest: the same function decides both, so they can't drift apart.

Membership (`SceneModel.sectionId`) is a **stored** field, not derived from
geometry on every read. That's a deliberate departure from "geometry is
truth": sections are now allowed to overlap, so "is this scene fully inside
a section" can be true for two different sections at once — pure geometric
derivation can't say which one actually owns it. Instead, ownership is
assigned only at discrete commit moments (a scene drop, a section-move
sweep capturing a loose scene, a resize pushing a member out) and left alone
otherwise — which is exactly what makes "overlapping a section never
reshuffles what's inside another one" hold.

State lives in one Zustand store (`canvasStore.ts`) rather than several
slices — this is a tuning rig, not a production app, so one file you can
read top-to-bottom beats a "properly" decomposed architecture. Undo/redo is
plain snapshotting (`{scenes, sections}` before each committing mutation),
which trivially satisfies "auto-grow + the drop that caused it is one undo
step" — there's only one snapshot push per commit, however many things it
touches.

## Keymap

| Key | Action |
|---|---|
| `V` | Select tool |
| `H` | Pan tool (or hold `Space` to pan temporarily, or middle-mouse-drag) |
| `S` | Section tool — drag to draw a new section (200×150 min) |
| `Cmd/Ctrl` + `Alt` + `G` | Wrap selected scenes in a new section (48px padding) — or, with a section selected instead, dissolve it (toggle semantics) |
| `Cmd/Ctrl` + `D` | Duplicate selected section (with members) |
| `Delete` / `Backspace` | Delete selected section **and its member scenes** |
| `Cmd/Ctrl` + `Z` | Undo |
| `Shift` + `Cmd/Ctrl` + `Z` | Redo |
| `Esc` | Cancel active drag/draw, close rename, or deselect |
| Mouse wheel / trackpad pinch | Zoom, centered on cursor (10%–400%) |
| Click anywhere inside a section | Select the section (label, border, or open interior — a scene on top still selects itself, never the section beneath it) |
| Drag a section's **label** or **open interior** | Move the section + its members (a plain click with no movement just selects) |
| Drag a section's **border** (8px band, whole edge) | Resize that edge (corners resize both axes) |
| Shift-click scene | Add/remove from selection |
| Drag on empty canvas (outside any section) | Marquee select |
| Double-click section label | Rename |
| Right-click a section (anywhere in it) | Rename / Duplicate / Dissolve / Delete |
| Right-click a selected scene | Create section (wrap) |

Sections can freely overlap one another — drawing, moving, resizing, and
auto-grow are never blocked or clamped by a neighboring section. `Dissolve`
removes just the boundary (its scenes go loose); the default `Delete` removes
the section **and** whatever's currently assigned to it.

## Debug panel

Top-right overlay:
- **Live membership readout** — reflects each scene's stored `sectionId` in real time, so if it ever disagrees with what you see on screen, that's a bug, not a display lag.
- **Visualize scene bounds** — outlines every scene's true rect, useful for eyeballing "fully inside" edge cases at a glance.
- **Grow padding** (0–64px, default 24) and **grow duration** (0–400ms, default 180) sliders — tune the auto-grow feel live, no reload.

## Scenarios dropdown

Top-left. Resets the whole canvas to one of the 7 test cases (plus the
default 12-scene sandbox), each seeded to make the interaction obvious on the
first drag:

1. **Basic capture** — drop a loose scene half-overlapping Section 1 → grows + captures; undo reverts both.
2. **Overlap on growth** — dropping a bridging scene grows Section 1 into Section 2's space; Section 2 keeps its own pre-existing member untouched.
3. **Escape** — drag a member most of the way out → drops loose, section unchanged.
4. **Section sweep** — drag Section 1 over loose scenes → fully-enclosed ones captured on drop.
5. **Overlap on move** — drag Section 1 into Section 2 → moves freely (no clamping), both sections keep their own members.
6. **Shrink out** — resize Section 1 inward past a member → "leaving" treatment during the drag, escape on commit.
7. **Wrap selection** — marquee scenes → `Cmd/Ctrl+Alt+G` → section with 48px padding, label in rename mode.

## Explicitly skipped (per brief)

Lock, touch support, section list/navigation panel, generation auto-grow
(§6c), persistence, real images, scene resize, performance beyond ~50 scenes.
