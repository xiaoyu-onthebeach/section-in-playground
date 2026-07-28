import { useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useMembership } from '../../hooks/useDerivedState';
import { WRAP_PADDING_SLIDER_MAX, WRAP_PADDING_SLIDER_MIN, ZOOM_MAX, ZOOM_MIN } from '../../lib/constants';
import { ScenariosDropdown } from '../ScenariosDropdown/ScenariosDropdown';
import './DebugPanel.css';

export function DebugPanel() {
  const [open, setOpen] = useState(false);
  const sectionOrder = useCanvasStore((s) => s.sectionOrder);
  const sections = useCanvasStore((s) => s.sections);
  const scenes = useCanvasStore((s) => s.scenes);
  const sceneOrder = useCanvasStore((s) => s.sceneOrder);
  const debug = useCanvasStore((s) => s.debug);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const setDebugShowBounds = useCanvasStore((s) => s.setDebugShowBounds);
  const setGrowPadding = useCanvasStore((s) => s.setGrowPadding);
  const setGrowDuration = useCanvasStore((s) => s.setGrowDuration);
  const setWrapPadding = useCanvasStore((s) => s.setWrapPadding);
  const setZoom = useCanvasStore((s) => s.setZoom);
  const setAutoPickColor = useCanvasStore((s) => s.setAutoPickColor);
  const setSectionBorderColor = useCanvasStore((s) => s.setSectionBorderColor);
  const setSectionIconColor = useCanvasStore((s) => s.setSectionIconColor);
  const membership = useMembership();
  const hasSelectionBar = useCanvasStore((s) => s.selection.sceneIds.length >= 2);

  const membersBySection = new Map<string, string[]>();
  for (const id of sceneOrder) {
    const sectionId = membership.get(id);
    if (!sectionId) continue;
    const list = membersBySection.get(sectionId) ?? [];
    list.push(scenes[id]?.name ?? id);
    membersBySection.set(sectionId, list);
  }
  const looseCount = sceneOrder.length - membership.size;

  if (!open) {
    return (
      <button
        className={`debug-panel__reopen${hasSelectionBar ? ' debug-panel__reopen--shifted' : ''}`}
        onClick={() => setOpen(true)}
      >
        Debug
      </button>
    );
  }

  return (
    <div className={`debug-panel${hasSelectionBar ? ' debug-panel--shifted' : ''}`}>
      <div className="debug-panel__header">
        <span>Debug</span>
        <button className="debug-panel__close" onClick={() => setOpen(false)}>
          ×
        </button>
      </div>

      <div className="debug-panel__section">
        <div className="debug-panel__label">Scenario</div>
        <ScenariosDropdown />
      </div>

      <div className="debug-panel__section">
        <div className="debug-panel__label">Membership (live)</div>
        <div className="debug-panel__membership">
          {sectionOrder.length === 0 && <div className="debug-panel__muted">No sections</div>}
          {sectionOrder.map((id) => {
            const section = sections[id];
            if (!section) return null;
            const members = membersBySection.get(id) ?? [];
            return (
              <div key={id} className="debug-panel__membership-row">
                <span className="debug-panel__section-name">{section.name}:</span>{' '}
                <span className="debug-panel__members">[{members.join(', ')}]</span>
              </div>
            );
          })}
          {looseCount > 0 && (
            <div className="debug-panel__membership-row">
              <span className="debug-panel__section-name">Loose:</span> <span className="debug-panel__members">{looseCount} scene{looseCount === 1 ? '' : 's'}</span>
            </div>
          )}
        </div>
      </div>

      <label className="debug-panel__toggle">
        <input type="checkbox" checked={debug.showBounds} onChange={(e) => setDebugShowBounds(e.target.checked)} />
        Visualize scene bounds
      </label>

      <div className="debug-panel__slider">
        <div className="debug-panel__slider-label">
          <span>Grow padding</span>
          <span>{debug.growPadding}px</span>
        </div>
        <input
          type="range"
          min={0}
          max={64}
          value={debug.growPadding}
          onChange={(e) => setGrowPadding(Number(e.target.value))}
        />
      </div>

      <div className="debug-panel__slider">
        <div className="debug-panel__slider-label">
          <span>Grow duration</span>
          <span>{debug.growDuration}ms</span>
        </div>
        <input
          type="range"
          min={0}
          max={400}
          value={debug.growDuration}
          onChange={(e) => setGrowDuration(Number(e.target.value))}
        />
      </div>

      <div className="debug-panel__slider">
        <div className="debug-panel__slider-label">
          <span>Wrap padding</span>
          <span>{debug.wrapPadding}px</span>
        </div>
        <input
          type="range"
          min={WRAP_PADDING_SLIDER_MIN}
          max={WRAP_PADDING_SLIDER_MAX}
          value={debug.wrapPadding}
          onChange={(e) => setWrapPadding(Number(e.target.value))}
        />
      </div>

      <div className="debug-panel__slider">
        <div className="debug-panel__slider-label">
          <span>Zoom</span>
          <span>{Math.round(zoom * 100)}%</span>
        </div>
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
      </div>

      <div className="debug-panel__section">
        <div className="debug-panel__label">Section colors</div>
        <label className="debug-panel__toggle">
          <input
            type="checkbox"
            checked={debug.autoPickColor}
            onChange={(e) => setAutoPickColor(e.target.checked)}
          />
          Auto-pick dominant color from image
        </label>
        <div className="debug-panel__muted" style={{ marginBottom: 8 }}>
          {debug.autoPickColor ? 'Background: sampled from image' : 'Background: fixed design default'}
        </div>
        <div className="debug-panel__color-row">
          <label htmlFor="debug-color-border">Border</label>
          <input
            id="debug-color-border"
            type="color"
            value={debug.sectionBorderColor}
            onChange={(e) => setSectionBorderColor(e.target.value)}
          />
        </div>
        <div className="debug-panel__color-row">
          <label htmlFor="debug-color-icon">Icon</label>
          <input
            id="debug-color-icon"
            type="color"
            value={debug.sectionIconColor}
            onChange={(e) => setSectionIconColor(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
