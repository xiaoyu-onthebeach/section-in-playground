# Beachside Canvas — Sections v1 Interaction Spec

**Status:** Draft v0.10
**Owner:** Xiaoyu
**Scope:** Basic, goal-agnostic spatial sections for grouping scenes on the infinite canvas. No lineage-derived grouping, no smart collections — those are explicitly deferred.

**v0.2 changes:** sections may now overlap freely (no-overlap clamping removed from draw/move/resize/auto-grow); overlapping a section never changes what another section contains; selecting a section now works from anywhere in its area, not just the label/border; default Delete now removes a section's member scenes along with it (Dissolve remains the boundary-only path).

**v0.3 changes:** the border is now a resize grab along its whole length, not just the small handles — moving a section moved to the label.

**v0.4 changes:** the open interior is a move-drag target too (in addition to the label) — a plain click still just selects; only the border resizes.

**v0.5 changes:** section border/handles/hit-band are now fixed screen size regardless of zoom (matching the label text); fill is no longer a subtle blue wash — empty sections get a flat `#2F2F37` at 80% opacity, sections with a member get a color sampled from that scene's image (its darker half) at the same 80%.

**v0.6 changes:** the member-fill sampling method changed from a luminance-based darkest-slice average to true dominant-color extraction — pixels are quantized into color buckets and ranked by pixel occupancy (how much of the image they cover), and the darker of the top 2 dominant buckets is used as the fill.

**v0.7 changes:** plain wheel / two-finger trackpad scroll now pans the canvas directly (no key or tool needed) instead of always zooming — Ctrl/Cmd+wheel zooms instead (this also covers trackpad pinch-to-zoom for free, since browsers report that gesture as a wheel event with `ctrlKey` set). Space+drag, middle-mouse-drag, and the Pan tool are unchanged.

**v0.8 changes:** section corners now show a proper diagonal resize cursor and resize both axes even before the section is selected; double-clicking the section icon opens the rename input (existing text pre-selected) — committing a name shows it as a text tag next to the icon, committing an empty one hides the tag again (the underlying name stays intact for the layer/debug panels); overlapping sections now interleave in z-order by creation order, so a front section's fill can visually cover a scene owned by a different, overlapping back section (membership itself is unaffected); deleting a scene now auto-shrinks its section inward on whichever edge(s) the removal actually left empty (a center removal that doesn't change the members' bounding box never shrinks anything); double-clicking a member scene generates 4 new scenes, joins them to the same section, and grows the section to contain them — one undo step.

**v0.9 changes:** generated variations (double-click a member scene) now lay out in a single horizontal row below the source scene instead of a 2x2 grid. Wrap-selection padding (Cmd/Ctrl+Alt+G) default raised from 48px to 64px, and is now a live-adjustable debug panel slider (24–100px).

**v0.10 changes:** the section color story moved from a fixed blue token to a neutral, parameterized one — resting border defaults to `#40404A` and empty-state fill to `#26262C` at 80% opacity, both live-adjustable (border/icon color pickers in the debug panel), with selected/highlighted states staying on their own dedicated blue-toned tokens (§3). Section z-order is no longer just implicit creation order — sections can be explicitly reordered (**Bring to Front** / **Send to Back**), and a scene visually covered by a section in front of it (own section behind an overlapping one, or a loose scene "trapped" inside a section it isn't a member of) now renders behind that front section's fill *and* its real members, tinted rather than hidden (§7). **Sections are now multi-selectable** (shift-click, or marquee across more than one) with **group move** and **group resize** (proportional, relative to the selection's combined bounding box) (§8). The section right-click menu was redesigned wholesale — new items **Copy** (⌘C) and **Bring to Front/Send to Back** (⌘]/⌘[), "Dissolve" relabeled **"Clear section"**, plus a stubbed **Export as PNGs** — and now bulk-acts on the whole selection as one undo step when the clicked section is already part of a multi-selection (§8). Right-clicking empty canvas now opens a menu to create a new scene or section at that point (§4). Generated variations (§6c) now dodge existing scenes by dropping below everything on the canvas if the default row-below placement would land on top of something. Canvas background dot spacing increased (32px → 80px, prototype-only polish).

---

## 1. Concept & principles

A **section** is a labeled rectangular region on the canvas. It is a *region*, not a container object: membership is defined purely by geometry. Users are free to group scenes by any logic they want (theme, campaign, stage, iteration) — the system imposes no meaning.

Principles:

1. **Placement determines membership.** A scene becomes a member of a section when a specific action puts it fully inside that section's bounds (a drop, a section sweeping over it, a wrap). Sections may overlap, so "fully inside" can be true of more than one section at once — membership is therefore an explicit assignment made at that moment, not a live re-derivation; it only changes via another such action (drop, sweep, resize-escape), never as a side effect of a *different* section moving to overlap it.
2. **The user's placement is intent.** The system never silently moves scenes the user placed.
3. **Boundaries are cheap.** Creating, dissolving, and reshaping sections must feel low-stakes and always reversible.
4. **Section chrome never competes with artwork.** Visual styling stays quiet under colorful generated imagery.

---

## 2. Terminology

| Term | Definition |
|---|---|
| Section | A labeled rectangular region on the canvas |
| Member | A scene fully inside a section's bounds |
| Loose scene | A scene not inside any section |
| Label | The section's name chip, rendered top-left above the section border |
| Escape | A member leaving membership by being moved/resized so it is no longer fully inside |

---

## 3. Visual style

✅ **(updated, v0.10)** The color story moved from a single fixed blue token to a **neutral, parameterized** one: resting border and fill default to neutral grays rather than blue, and both are live-adjustable rather than hardcoded (a debug-panel affordance in this prototype; a real settings surface in product). Selected/highlighted feedback states are the exception — those stay on their own dedicated tokens regardless of the resting-state color, so the interaction grammar (§6a's highlight-means-membership contract) is never ambiguous.

| Element | Spec |
|---|---|
| Border (resting) | 1.5px solid, default color `#40404A` (neutral gray). Adjustable live from the debug panel's border color picker — a prototype stand-in for a future product setting, not real product UI. **Width is fixed screen size:** always 1.5px on screen no matter the zoom level (v0.5), same for the 8px edge hit-band and the selection/resize handles. The corner radius is the one exception — it's defined in canvas units (24), so it scales up/down with zoom like the rest of the box. |
| Fill ✅ (updated, v0.10) | **Empty section:** flat `#26262C` at 80% opacity (was `#2F2F37`/80% in v0.5 — same model, cooler/darker neutral). **Once it has a member:** unchanged from v0.6 — the member's top-2 dominant colors by pixel occupancy, darker of the two, same 80% opacity, replacing the empty-state color (first member by scene order is the source with multiple). Auto-pick is a debug-panel toggle; off by default (fixed design default fill for every section, sampling never runs). |
| Label | **No chip background** — just the section icon (glyph color defaults to white, also live-adjustable) with a subtle dark hover-only background swatch behind the icon alone, plus optional name text (white, drop-shadow for legibility over any background) when the section has been explicitly named (§4 Naming). Supersedes the earlier "blue chip" description — there is no persistent colored background in the built label. |
| Label text | 12px medium. **Fixed screen size** — does not scale with canvas zoom (see §9 Zoom). |
| Highlight state (drop target) | Border thickens to 2.5px and switches to `--section-border-highlight`; fill switches to `--section-fill-highlight`. ✅ *(v0.10)* Both are now the same tokens as the selected/hover states below — `rgba(255,255,255,0.45)` border, `rgba(255,255,255,0.06)` fill — rather than their own separate blue. They're still independent CSS tokens from the resting-state color, so they stay consistent even if the resting border/fill is changed via the debug panel. Applied during drag-over only (see §6). |
| Invalid state | Border flashes red-500 briefly (e.g. rejected overlap). No persistent red state. |
| Selected state | Border 1.5px, switches to `--section-border-selected` (`rgba(255,255,255,0.45)`, a soft white) + selection handles at corners/edges, consistent with scene selection styling. Same width as resting — only the color changes. |
| Right-click menu ✅ (new, v0.10) | Frosted-glass popover: 228px wide, `rgba(38, 38, 44, 0.88)` background, `1px solid #40404A` border, 8px corner radius, `blur(16px)` backdrop-filter, `0px 4px 32px 4px rgba(0,0,0,0.24)` shadow. See §8.1 for the full item list. |
| Toolbar tooltip ✅ (new, v0.10) | The Section tool button shows a custom hover tooltip (dark rounded bubble + downward pointer tail) reading "Section" with the `S` shortcut in a muted tone, matching the app's other floating-surface styling. |

Z-order: section fill and border always render **below** all scenes belonging to *that* section, but sections themselves now have an explicit, reorderable stacking order (§7) — a front section's fill can cover a back section's members, and a scene visually covered this way renders behind that front section entirely (including its label/menu chrome — §7.1), not just behind its fill.

---

## 4. Creation

Two creation paths:

### 4a. Draw an empty section
- Section tool in toolbar (shortcut: `S` — confirm no conflict with existing tools).
- Cursor becomes crosshair; user drags to draw the region.
- **Minimum size on release: 200 × 150 canvas units.** A drag smaller than this snaps up to minimum (prevents invisible slivers).
- Drawing over an existing section is allowed — sections may overlap (see §7).

### 4b. Wrap a selection
- Select 1+ scenes → right-click → **"Create section"**, or shortcut `⌘⌥G` (Mac) / `Ctrl+Alt+G` (Win).
- Section is created around the selection bounding box with **64px padding** on all sides by default (debug panel slider, 24–100px) — overlapping an existing section doesn't shrink or block it.

### 4c. From the canvas right-click menu ✅ (new, v0.10)
- Right-click **empty canvas** (not on a scene or a section) → **"Create new section"** creates an empty section at minimum size (200 × 150), centered on the click point. Any loose scenes it happens to fully enclose are captured immediately, same as 4a's draw-to-create.
- The same menu also offers **"Create new scene"**, a new loose scene (not a section feature per se, but the counterpart action on the same surface) centered on the click point.
- Right-clicking a scene or a section opens their own respective menus instead (§8.1) — this menu is specifically the empty-canvas case.

### Naming
- Default name: `Section N` (lowest unused integer).
- ⚠️ **Correction (v0.10):** none of the three creation paths above currently auto-enter inline rename mode — every new section starts **icon-only** (no name tag shown) until the user double-clicks the label or uses the context menu's "Rename section." This diverges from the original "immediately enters inline rename mode" intent; treat that as descoped for this prototype rather than a bug, and revisit if/when this becomes a production feature.
- Rename anytime via double-click on the label, or **"Rename section"** in the right-click menu (§8.1) — the latter is disabled when more than one section is selected (renaming is inherently single-target). Max display length ~24 chars; longer names truncate with ellipsis + full name on hover tooltip. Committing a name turns the name tag on (visible next to the icon); committing empty text turns it back off — the underlying name is unaffected either way and still shows in the debug panel's membership list.

---

## 5. Membership model

- **Rule: fully-inside, at the moment of commit.** A scene becomes a member when a transaction (scene drop, section-move sweep, wrap) commits with it fully inside a section's bounds. Partial overlap at that moment = not a member.
- Membership is **assigned by the committing transaction**, not recomputed from live geometry on every read — sections can overlap, so a member scene may also sit geometrically inside a second, unrelated section without that changing anything. It only changes via: scene drop/resize creating or breaking containment, a section move sweeping up a loose scene, or a section resize pushing a member out.
- One scene belongs to at most one section at a time (single assignment), but which section a scene is inside geometrically is no longer necessarily unique now that sections can overlap — the assignment, not the geometry, is what's authoritative.
- Empty sections are valid and persist. Deleting all member scenes does not delete the section.

---

## 6. Drag & drop, and auto-grow

### 6a. Drop feedback (during drag)
While a scene (or multi-selection of scenes) is being dragged:

- If dropping at the current position **would result in membership** (scene fully inside, or partially intersecting — growth always succeeds, see 6b), the target section shows the **highlight state**.
- Only one section can highlight at a time. If the dragged scene intersects two sections, highlight the one with the **larger intersection area** — growth (if any) applies only to that section; the other section's geometry and members are untouched.

### 6b. Auto-grow on user drop ✅ (decided)
When the user drops a scene:

| Drop position | Result |
|---|---|
| Fully inside section | Becomes member. No growth. |
| Partially intersecting section bounds | Becomes member. **Section auto-grows** to contain the scene's full bounds + 24px padding on the overflowed side(s). Growth animates ~180ms ease-out. Growth is never blocked — it may cause the section to overlap another section; that other section's geometry and members are unaffected (§7). |
| Fully outside all sections | Loose scene. |

- Growth only ever **expands** the overflowed side(s); other edges never move.
- Growth never displaces other scenes or sections.
- There is **no "fit to content" command** in v1. Sections shrink only when the user resizes them manually.
- Multi-selection drop: treat the selection bounding box as one unit; same rules apply.

### 6c. Auto-grow on generation
This section describes the full production intent; **out of scope for this prototype's build** (see CLAUDE.md). What's actually built is a deliberately simpler subset, current as of v0.10:

- Double-clicking a member scene generates 4 new scenes in a single horizontal row directly below it, left-aligned to the source (v0.9), and the section always auto-grows to contain them (same animation as 6b) — there's no "blocked direction" concept and no toast; growth is never refused.
- ✅ **(new, v0.10)** If that direct row-below position would land on top of an *existing* scene (member or loose, anywhere on the canvas), the row instead drops to below the bottommost edge of every existing scene — simplest way to guarantee empty space without a real bin-packing search. Same left-alignment as the direct-fit case; only the vertical position changes.
- Full section-aware placement (grow **down, then right**, blocked-direction fallback, "no room to grow" toast, generated scenes constrained inside the section as long as there's free space) remains the production-intent design above but is not implemented — flag before building the real feature.

### 6d. Escape (moving/resizing a member)
- Dragging a member so it is no longer fully inside → on drop, it **escapes** (loses membership). No growth, no snap-back.
- During the drag, the moment the drop position would end membership, the section's highlight is absent — the same feedback grammar as 6a, so users always see the outcome before releasing.
- Resizing a member scene so it pokes past the boundary → same rule: on commit, it escapes. The section never grows because of a scene-side resize.

---

## 7. Overlapping sections ✅ (decided, v0.2)

- Sections may freely intersect. Not constrained at any mutation: create (§4), draw, move, resize, or auto-grow (§6).
- **Move:** dragging a section over another is unconstrained — no clamping, no slide-along. It passes through / on top of the neighbor exactly where the cursor puts it.
- **Resize:** dragging an edge into a neighbor is likewise unconstrained; only the creation minimum (200 × 150) applies.
- **Overlap never touches membership.** When Section B ends up overlapping Section A (by move, resize, or auto-grow), Section A's members and Section B's members are exactly whatever they already were — overlapping doesn't re-derive, reassign, or contest ownership of anything. See §5.
- No dedicated nesting affordance in v1 (no parent/child relationship, no indent) — a section fully overlapping another is visually equivalent to nesting but carries no special semantics beyond §5.
- Rendering: overlapping fill regions simply stack (each at 80% opacity — whichever section paints on top, per its z-order position, dominates the overlap); overlapping borders cross each other. No special-cased visual treatment for the overlap region itself.
- Selection: clicking in an area covered by more than one section's interior selects whichever section is visually on top at that point (see §8 Selection).

### 7.1 Z-order is explicit and reorderable ✅ (new, v0.10)
- Every section has a position in a shared front-to-back order. New sections join at the front; **Bring to Front** / **Send to Back** (§8.1) let the user move one or more sections explicitly, without changing anything about geometry or membership.
- A section's own real members always render above that section's own fill, regardless of its position in the shared order.
- When Section A sits in front of Section B (whether by creation order or an explicit reorder) and their bounds overlap, any scene that's visually caught in that overlap and isn't a member of A renders **behind A's fill and behind A's real members** — this applies whether that scene is a genuine member of B, or a loose scene that happens to sit inside A's bounds without being a member of anything.
- That covered scene isn't hidden outright: its image gets a translucent dark tint (simulating "this is behind something," not "this is gone"), and its floating name label + "…" menu button (a separate screen-space layer, unaware of section stacking on its own) dim to match rather than disappearing.
- The overlapping portion of a covered scene becomes non-interactive — the front section's own fill/resize-bands sit on top there, so clicks land on the section, not the scene underneath. Any non-overlapping portion of that same scene is unaffected and stays fully interactive. A scene currently being dragged is always exempt (renders fully live, uncovered) so the user can see exactly what they're placing.

---

## 8. Core interactions

### 8.1 Right-click menu ✅ (new, v0.10)
Right-clicking a section opens a menu that operates on either just that section, or — if it's already part of a multi-selection (see Multi-select below) — the whole selection at once (menu items pick up a `(N)` count suffix and hide their keyboard-shortcut hint when acting in bulk). Right-clicking a section that *isn't* currently selected replaces the selection with just that one first, same as a plain click. Items, top to bottom:

| Item | Shortcut | Notes |
|---|---|---|
| Copy section | ⌘C | See Copy/Paste below |
| Duplicate section | ⌘D | See Duplicate below |
| Bring to front | ⌘] | See Bring to Front/Send to Back below |
| Send to back | ⌘[ | " |
| *divider* | | |
| Rename section | — | No keyboard shortcut exists for this. Disabled when more than one section is targeted (rename is inherently single-target) |
| Clear section | `⌘⌥G`* | This is the boundary-only removal — see Dissolve below (relabeled "Clear section" in the UI; same behavior). *Only when no scenes are also selected — otherwise `⌘⌥G` wraps a selection instead (§4b) |
| *divider* | | |
| Export as PNGs | — | Stub in this prototype — shows a "not implemented" toast. Real export (rasterizing each member's image out to files) is a production feature, not built here. |
| Delete | `Delete`/`Backspace` | Destructive — see Delete below |

Right-clicking a **loose/selected scene** instead shows a single item, **"Create section"** (same as §4b's wrap-selection shortcut). Right-clicking **empty canvas** shows the §4c menu ("Create new scene" / "Create new section").

### Move ✅ (updated, v0.10 — group move)
- Dragging the **label**, or dragging any **open interior** point (not the border, not a scene), moves the section **and all member scenes** as one unit. A plain click with no movement on either just selects — it doesn't count as a move.
- ✅ **(new, v0.10)** If the section being dragged is part of a multi-selection, **the whole selection moves together** — every selected section keeps its own members and translates by the same delta as the one under the cursor. A plain click (no shift) on a section that's already part of the current multi-selection preserves that selection so the drag can act on the group; clicking a section that *isn't* part of it replaces the selection with just that one, same as single-select.
- Dragging a **member scene** moves only that scene — scenes are separate elements and are always hit-tested first, so they never trigger a section move even though they sit inside the section's interior.
- Dragging a section (or group) over loose scenes: any loose scene that ends up fully inside **any of the moved sections** on drop **becomes a member** of whichever one it fits in. During the drag, such scenes get a light highlight outline as capture feedback.

### Resize ✅ (updated, v0.10 — group resize)
- The entire **border** is a resize grab, not just discrete handles — dragging anywhere along an edge (the 8px hit band) resizes that edge; corners resize both axes at once. 8 corner/midpoint handles remain as the visible grab affordance once a section is selected, but the whole edge behind them responds too. Resizing changes the region only; **member scenes never move or scale**.
- ✅ **(new, v0.10)** Resizing one section that's part of a multi-selection scales **the whole selection proportionally**, relative to their combined bounding box at drag-start (the same anchor + scale factor is computed once from the handle's movement, then applied to each section's own rect) — the same mental model as a typical design tool's group-resize. With only one section targeted this is identical to the single-section behavior above. The group's shrink floors out the moment *any* selected section would drop below the minimum size (200 × 150) — the whole group stops there together, even if others in the group have more room to give.
- While dragging an edge inward, scenes that would fall out of full containment render with a subtle desaturated/outlined "leaving" treatment, evaluated **per section** against that section's own live preview rect. On commit, each escapes from its own (now-resized) section independently — same rule as single-section resize.
- Minimum size = creation minimum (200 × 150), enforced per section even during a group resize.

### Multi-select ✅ (new, v0.10)
- **Shift-click** a section (label, border, or open interior) to add/remove it from the current selection, same gesture as multi-selecting scenes.
- **Marquee** now collects **every** section it fully encloses (previously only the first one found) — same Figma "fully enclose" rule as single-select.
- A plain click (no shift) on a section that's already part of the current multi-selection **preserves the whole selection** (so a follow-up drag acts on the group — see Move/Resize above); a plain click on anything else replaces the selection with just that one, matching pre-multi-select behavior.
- Bulk actions — Duplicate, Copy, Delete, Clear section, Bring to Front, Send to Back — all apply to every currently-selected section from either the keyboard shortcut or the right-click menu (§8.1), and commit as **one undo step** for the whole batch, not one per section.

### Selection ✅ (updated, v0.4)
- Click **anywhere inside a section's bounds** (label, border, or open interior) → selects the section. Where that same click is also a drag start (label/interior = move, border = resize), selection and the drag begin together.
- Click a scene → selects the scene, never the section beneath it — scenes are hit-tested first regardless of what section(s) they sit inside or on top of.
- `Esc` deselects.

### Delete ✅ (updated, v0.10 — bulk)
- `Delete`/`Backspace`, or the right-click menu's **Delete**, on selected section(s) → **removes the section(s) and their member scenes together**, one undo step for the whole batch. If any targeted section has members, a confirmation dialog shows the combined scene count across all of them before committing.
- Deleting all scenes inside a section (by any means) leaves the empty section in place — it's only the explicit Delete action on the section itself that takes its members with it.

### Dissolve (UI label: "Clear section") ✅ (updated, v0.10)
- Right-click → **"Clear section"** (relabeled from "Dissolve section" — same behavior): removes the boundary only; member scenes are kept in place, now loose. This is the one boundary-only removal path (Delete always takes contents with it). Shortcut: `⌘⌥G` while section(s) selected and no scenes selected (same chord as wrap-selection — see §4b — disambiguated by what's currently selected).
- Supports multi-select: clears every selected section's boundary in one undo step, releasing all their members to loose.

### Duplicate ✅ (updated, v0.10 — bulk)
- `⌘D` / right-click menu duplicates the selected section(s) **with all member scenes**, each offset 24px down-right. Overlapping the original or another section is fine — no free-position search needed.
- With multiple sections selected, all of them are duplicated together as **one undo step**, and the new copies become the selection afterward.

### Copy / Paste ✅ (new, v0.10)
- `⌘C` copies the selected section(s) + their members to an in-memory clipboard (prototype-only — not the OS clipboard). `⌘V` pastes whatever's there as new section(s), each offset 32px down-right from where they were copied, and becomes the new selection. Paste is a no-op if nothing's been copied.
- Distinct from Duplicate: Copy/Paste is a two-step action (copy now, paste later — possibly after panning elsewhere, or multiple times), where Duplicate is an immediate one-step "clone in place."

### Bring to Front / Send to Back ✅ (new, v0.10)
- `⌘]` / `⌘[`, or the right-click menu, moves the selected section(s) to the front or back of the shared z-order (§7.1) — pure stacking, no geometry or membership change.
- With multiple sections selected, they're all moved together, preserving their relative order among themselves and the relative order of the untouched sections around them.

### Lock — out of scope for this prototype
Right-click → Lock (a locked section can't be moved/resized/deleted or auto-grow, and rejects new members, but still allows member edits/escape) remains a production-intent idea from the original design; it's explicitly excluded from this build (see CLAUDE.md's scope skip-list) and not implemented.

### Undo
- Every operation above is one undo step and restores **both geometry and resulting membership**: create, rename, move, resize (single or group), auto-grow (grouped with the drop that caused it as a single step), delete (with its member scenes), clear/dissolve, duplicate, copy+paste, bring to front/send to back. ✅ **(v0.10)** Bulk operations on a multi-selection are a single undo step for the whole batch, not one step per section.

---

## 9. Canvas system integration

### Pan ✅ (updated, v0.7)
- Plain wheel / two-finger trackpad scroll pans the canvas (deltaX/deltaY map directly to panX/panY) — no key or tool switch required.
- Ctrl/Cmd+wheel zooms instead, centered on the cursor; trackpad pinch-to-zoom is reported by the browser as a Ctrl+wheel event, so it's covered by the same path.
- Space+drag, middle-mouse-drag, and the Pan tool (`H`) still pan as before — unaffected by this change.

### Zoom
- Label text renders at fixed screen size across zoom levels (clamped: never larger than the section's on-screen width).
- At far zoom-out, labels become the primary navigation layer; section fill/border remain visible at all zoom levels.

### Section list / navigation — out of scope for this prototype
The existing layer panel is a **flat scene list** in this build — it does not group by section, and there's no zoom-to-fit-a-section affordance. The design intent below (a Sections group, click-to-zoom-to-fit) is still the product direction; it's just not built here (see CLAUDE.md's scope skip-list). Live membership is instead surfaced read-only in the debug panel's "Membership (live)" list, which is prototype scaffolding, not this feature.
- The existing layer/navigation panel gains a **Sections group**: each section listed by name with scene count. Click → zoom-to-fit that section (animated).
- On small screens (per responsive spec), this list is the primary way to jump between sections.

### Touch — out of scope for this prototype
Not implemented in this build (see CLAUDE.md's scope skip-list); the design intent below is unchanged.
- Label tap target minimum 44 × 44pt effective.
- Draw-to-create requires the section tool to be active (drag on canvas otherwise pans), consistent with existing tool-mode behavior.

---

## 10. Edge cases

| Case | Behavior |
|---|---|
| Scene dropped intersecting two sections | Membership candidate = larger intersection area (§6a); grow rules apply to that section only |
| Scene larger than the section it's dropped on | Auto-grow handles it (section grows to contain), subject to overlap blocking |
| Section dragged to newly enclose loose scenes | They become members on drop, with capture feedback during drag (§8 Move) |
| Very long section name | Truncate at ~24 chars with ellipsis; tooltip shows full name |
| Copy a member scene, paste elsewhere | Pasted copy's membership follows geometry at the paste position; original unchanged |
| All members deleted | Empty section persists |
| Undo after auto-grow | Drop + growth revert together as one step |
| Zoomed far out, section smaller than its label | Label clamps to section on-screen width; at extreme zoom-out label may replace the section entirely (render as chip) |
| Two sections overlapping or adjacent edge-to-edge | Both allowed; drops on the shared/overlapping area resolve by larger intersection area (§6a) |
| Section B grown/moved/resized to fully cover Section A's members | Section A's members stay Section A's; nothing about Section A changes (§5, §7) |
| Section deleted (boundary or with-contents) while it overlaps another | Only that section's own members are affected; the overlapping section and its members are untouched |
| ✅ *(v0.10)* A loose scene, or another section's member, sits inside a section that's in front of it | Renders behind that front section's fill and members, tinted rather than hidden — see §7.1 |
| ✅ *(v0.10)* Group resize where one selected section is much smaller than the others | The whole group's shrink floors out together the moment the smallest section would drop below 200×150 — others in the group don't keep shrinking past that point even if they have more room |
| ✅ *(v0.10)* Generated variations' default row-below position would land on an existing scene | Row drops instead to below every existing scene on the canvas, same left-alignment (§6c) |
| ✅ *(v0.10)* Duplicate/paste a section whose name already ends in "copy" | Gets another literal " copy" suffix appended (no de-duplication of repeated suffixes) |
| ✅ *(v0.10)* Right-click a section that's part of a multi-selection | Selection is preserved, not collapsed — the menu bulk-acts on all of them (§8.1) |
| ✅ *(v0.10)* Right-click a section that's *not* part of the current selection | Selection replaces to just that one first, then the menu acts on it alone |

---

## 11. Explicitly out of scope (v1)

- User-selectable section colors in **product** UI — ✅ *(v0.10 correction)* colors are no longer hardcoded (§3), but the only way to change them in this build is the prototype's debug panel, not a real per-section product affordance
- "Fit to content" / auto-shrink
- A dedicated nesting affordance (parent/child relationship, indentation) — overlap itself is allowed (§7), nesting-as-a-concept is not
- Multi-membership, tags, smart collections (starred/finals views)
- Lineage-derived auto-grouping or auto-layout
- Section-level status (approved / needs revision)
- Presenting/review mode from a section
- Lock (§8), section list/navigation panel, touch support (§9), full generation auto-grow (§6c) — all still the intended production design, just not built in this prototype (see CLAUDE.md)
- Real "Export as PNGs" (§8.1 stubs it with a toast), real Copy to the OS clipboard (§8's Copy/Paste uses an in-memory prototype clipboard only)

## 12. Open questions

1. ~~Exact blue token mapping to the Beachside design system (border/chip/fill stops).~~ ✅ **Superseded, v0.10:** the resting color is neutral and parameterized now, not a fixed blue mapping (§3) — blue is reserved for the selected/highlight feedback states only. Still open: what the *product* (non-debug-panel) surface for choosing that color should look like, since none exists yet (§11).
2. ~~Shortcut conflicts: `S`, `⌘⌥G`, dissolve shortcut — audit against current keymap.~~ ✅ **Resolved, v0.10:** current keymap has no conflicts — `S` (plain) selects the section tool, `⌘⌥G` dissolves-or-wraps depending on selection, `⌘D`/`⌘C`/`⌘V`/`⌘]`/`⌘[` cover duplicate/copy/paste/reorder. See §8 for the full table.
3. Should generation auto-grow (§6c) be capped (e.g., section can't grow beyond N× viewport) to avoid runaway growth on large batch generations? Still open — not relevant yet since full §6c placement isn't built (only the simplified always-grows + collision-dodge subset is).
4. ~~Does the section list live in the existing left panel or a new dropdown, given panel collapse rules in the responsive spec?~~ **Deferred, not currently open:** the section list/navigation feature itself is out of scope for this prototype (§9, §11); this question is only live again once that feature is actually scheduled.
5. ✅ *(new, v0.10)* Should Copy/Paste (§8) write through to the real OS clipboard so a section could be pasted into another document/tool, or is the in-memory prototype clipboard sufficient intent to carry into product?
6. ✅ *(new, v0.10)* Now that z-order is explicit and user-controlled (§7.1), should moving or resizing a section also implicitly bring it to front (as most direct-manipulation tools do), or should z-order stay a fully separate, deliberate action from geometry changes (current behavior)?
