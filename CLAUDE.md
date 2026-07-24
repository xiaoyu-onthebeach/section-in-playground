# Prototype brief: Beachside Sections v1 interaction test

You are building an **interaction prototype** to validate the section/grouping behavior defined in `section-interaction-spec.md` (same directory — read it fully first; it is the source of truth). This is a throwaway test rig, not production code. Optimize for interaction fidelity and tweakability, not architecture.

## Goal

Let a designer feel and evaluate:
1. Auto-grow on drop (does growth feel right? padding? animation timing?)
2. Fully-inside membership + drop highlight feedback (is the outcome always predictable before release?)
3. Escape behavior when dragging scenes out
4. No-overlap clamping when moving/resizing sections
5. Section move (label drag) carrying members vs. scene drag moving one scene

## Stack

- React 18 + TypeScript + Vite
- Zustand for canvas state
- Plain CSS or CSS modules; no UI framework needed
- Render the canvas with absolutely-positioned divs inside a pan/zoom transform container (no need for WebGL/canvas element)

## Scope

### Build
- Infinite canvas: pan (space+drag or middle-mouse), zoom (wheel/pinch, 10%–400%), zoom centered on cursor
- **Mock scenes**: ~12 pre-seeded rectangles (mixed sizes, e.g. 160×200 to 320×240) filled with distinct pastel colors + an ID label, scattered across the canvas. Scenes are draggable. Multi-select with shift-click and marquee. No resize of scenes needed (nice-to-have).
- **Sections** per the spec:
  - Create path A: toolbar "Section" tool (`S`), drag to draw, 200×150 min
  - Create path B: select scenes → `Cmd/Ctrl+Alt+G` wraps with 48px padding
  - Default naming `Section N`, inline rename on create, rename on double-click label
  - Visual style: blue border 1.5px `#377ADD`, fill same blue at 6% opacity, blue label chip top-left with white 12px text, **label fixed screen size** (counter-scale against zoom)
  - Membership = fully inside; recompute on drop/resize-commit/section-move-commit
  - Drop feedback: highlight state (border 2.5px, fill 10%) only when release would result in membership; larger-intersection rule when two sections intersect the drag
  - **Auto-grow on drop**: partial intersection → grow overflowed sides to scene bounds + 24px, ~180ms ease-out; blocked if growth would overlap another section (then drop = loose scene, no highlight during drag)
  - Escape: member dragged/dropped not-fully-inside loses membership; no snap-back
  - No overlapping sections: moving/resizing a section clamps against neighbors (slide-along)
  - Section move: drag label or 8px border band moves section + members as a unit; dragging over loose scenes captures fully-enclosed ones on drop (light outline feedback during drag)
  - Section resize: 8 handles; members never move; scenes falling out of containment get a desaturated "leaving" treatment during the drag, escape on commit
  - Delete = boundary only (keep scenes); "Delete with contents" via right-click context menu with count confirmation; Dissolve as separate context-menu verb
  - Duplicate section (`Cmd/Ctrl+D`) with members, offset to free position
  - Undo/redo (`Cmd/Ctrl+Z` / `Shift+Cmd/Ctrl+Z`) for: scene move, section create/move/resize/rename/delete/dissolve/duplicate, drop+auto-grow as ONE step
- **Debug panel** (small fixed overlay): live membership readout (`Section 1: [s3, s7]`), toggle to visualize scene bounds, sliders for grow padding (0–64px) and grow animation duration (0–400ms) so the feel can be tuned live

### Skip
- Lock, touch support, section list/navigation panel, generation auto-grow (§6c), persistence, real images, scene resize (optional), performance beyond ~50 scenes

## Interaction details that matter (do not approximate)

- Highlight grammar is the contract: **highlight visible ⇔ release creates/keeps membership**. Test every branch (fully inside, partial+growable, partial+blocked, outside, escaping).
- Growth expands only the overflowed side(s); opposite edges never move.
- Membership is derived from geometry after commit — never a stored list updated imperatively. If geometry and reported membership can disagree, the model is wrong.
- Auto-grow and the drop that caused it are a single undo step.
- Label counter-scaling: chip stays 12px on screen at any zoom, clamped to section on-screen width.

## Test scenarios (build a "Scenarios" dropdown that resets state to each)

1. **Basic capture**: drop a loose scene half-overlapping Section 1 → grows + captures; undo → both revert
2. **Blocked growth**: two sections 40px apart; drop a scene bridging the gap overlapping Section 1 toward Section 2 → no highlight, drop leaves loose scene
3. **Escape**: drag a member 30% past the edge → drops loose, section unchanged
4. **Section sweep**: drag Section 1 over three loose scenes → fully-enclosed ones captured on drop
5. **Clamp**: drag Section 1 into Section 2 → slides along the edge, never overlaps
6. **Shrink out**: resize Section 1 inward past two members → leaving treatment during drag, escape on commit
7. **Wrap selection**: marquee 4 scenes → Cmd+Alt+G → section with 48px padding, label in rename mode

## Definition of done

All 7 scenarios pass by hand-testing; debug panel confirms membership matches geometry at every step; README.md with run instructions (`npm i && npm run dev`) and a keymap table.
