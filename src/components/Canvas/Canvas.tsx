import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { CanvasOriginContext } from '../../canvas/CanvasOriginContext';
import { screenToWorld } from '../../lib/coords';
import { boundingBox } from '../../lib/geometry';
import { DEFAULT_ZOOM, ZOOM_MAX, ZOOM_MIN } from '../../lib/constants';
import { SceneView } from './SceneView';
import { SectionView } from './SectionView';
import { SectionLabelsLayer } from './SectionLabelsLayer';
import { SectionBordersLayer } from './SectionBordersLayer';
import { SceneOverlayLayer } from './SceneOverlayLayer';
import { DragOverlays } from './DragOverlays';
import { useActiveCaptureIds, useActiveLeavingIds, useVisuallyCoveredSceneIds } from '../../hooks/useDerivedState';
import { SectionContextMenu } from '../ContextMenu/SectionContextMenu';
import { Toast } from '../Toast/Toast';
import { Toolbar } from '../Toolbar/Toolbar';
import { DebugPanel } from '../DebugPanel/DebugPanel';
import { MultiSelectBar } from '../MultiSelectBar/MultiSelectBar';
import './Canvas.css';

const GRID_SIZE = 80; // 32 * 1.4 — 40% more space between dots

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewport = useCanvasStore((s) => s.viewport);
  const tool = useCanvasStore((s) => s.tool);
  const scenes = useCanvasStore((s) => s.scenes);
  const sceneOrder = useCanvasStore((s) => s.sceneOrder);
  const sections = useCanvasStore((s) => s.sections);
  const sectionOrder = useCanvasStore((s) => s.sectionOrder);
  const selection = useCanvasStore((s) => s.selection);
  const dragState = useCanvasStore((s) => s.dragState);
  const scenarioId = useCanvasStore((s) => s.scenarioId);

  const panBy = useCanvasStore((s) => s.panBy);
  const zoomAt = useCanvasStore((s) => s.zoomAt);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const startSectionDraw = useCanvasStore((s) => s.startSectionDraw);
  const updateSectionDraw = useCanvasStore((s) => s.updateSectionDraw);
  const endSectionDraw = useCanvasStore((s) => s.endSectionDraw);
  const startMarquee = useCanvasStore((s) => s.startMarquee);
  const updateMarquee = useCanvasStore((s) => s.updateMarquee);
  const endMarquee = useCanvasStore((s) => s.endMarquee);
  const closeContextMenu = useCanvasStore((s) => s.closeContextMenu);
  const openCanvasContextMenu = useCanvasStore((s) => s.openCanvasContextMenu);

  const leavingIds = useActiveLeavingIds();
  const captureIds = useActiveCaptureIds();

  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);

  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      return screenToWorld(viewport, { x: clientX, y: clientY }, { x: rect?.left ?? 0, y: rect?.top ?? 0 });
    },
    [viewport]
  );

  // spacebar temporary pan
  useEffect(() => {
    const isTypingTarget = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTypingTarget(e.target)) {
        setIsSpaceDown(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpaceDown(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // non-passive wheel: plain wheel/two-finger trackpad scroll pans (the
  // common case — reading around the canvas shouldn't require holding a key
  // or switching tools); Ctrl/Cmd+wheel zooms, centered on cursor, 10%-400%
  // — trackpad pinch-to-zoom gestures are reported by the browser as wheel
  // events with ctrlKey set, so this also covers pinch for free.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        // zoomAt expects container-relative coordinates (same convention as viewport.panX/panY)
        const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const state = useCanvasStore.getState();
        const factor = Math.exp(-e.deltaY * 0.0015);
        const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, state.viewport.zoom * factor));
        zoomAt(screenPoint, newZoom);
        return;
      }
      panBy(-e.deltaX, -e.deltaY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, panBy]);

  // Center content at a true 100% zoom on initial load and whenever the
  // scenario resets — matches how a real canvas app opens (native scale,
  // pan/zoom from there), rather than auto-fitting content to the viewport.
  // Content wider/taller than the viewport just extends off-screen; the
  // user pans or zooms out to see the rest.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const allRects = [...Object.values(scenes), ...Object.values(sections)];
    if (allRects.length === 0 || rect.width === 0 || rect.height === 0) return;
    const bbox = boundingBox(allRects);
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, DEFAULT_ZOOM));
    const panX = (rect.width - bbox.width * zoom) / 2 - bbox.x * zoom;
    const panY = (rect.height - bbox.height * zoom) / 2 - bbox.y * zoom;
    setViewport({ panX, panY, zoom });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refit on scenario change, not on every geometry-mutating interaction
  }, [scenarioId]);

  const onPointerDown = (e: React.PointerEvent) => {
    closeContextMenu();
    if (e.button === 1 || isSpaceDown || tool === 'pan') {
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      setIsPanning(true);
      return;
    }
    if (e.button !== 0) return;
    const world = toWorld(e.clientX, e.clientY);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (tool === 'section') {
      startSectionDraw(world);
      return;
    }
    startMarquee(world, e.shiftKey);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panBy(dx, dy);
      return;
    }
    if (dragState?.kind === 'section-draw') {
      updateSectionDraw(toWorld(e.clientX, e.clientY));
      return;
    }
    if (dragState?.kind === 'marquee') {
      updateMarquee(toWorld(e.clientX, e.clientY));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      return;
    }
    if (dragState?.kind === 'section-draw') {
      endSectionDraw();
      return;
    }
    if (dragState?.kind === 'marquee') {
      endMarquee();
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    // Scenes/sections/labels stop propagation on their own onContextMenu, so
    // this only ever fires for a right-click on genuinely empty canvas.
    e.preventDefault();
    openCanvasContextMenu(e.clientX, e.clientY, toWorld(e.clientX, e.clientY));
  };

  let cursor = 'default';
  if (isSpaceDown || isPanning || tool === 'pan') cursor = isPanning ? 'grabbing' : 'grab';
  else if (tool === 'section') cursor = 'crosshair';

  // Scenes visually covered by a section rendered in front of them (a loose
  // scene geometrically "trapped" inside a section it isn't a member of, or
  // a true member whose own section sits behind an overlapping one) render
  // right before that front section (and thus behind its fill AND its real
  // members) instead of in their normal stacking slot, with a translucent
  // tint (SceneView's `isTrapped`) so they read as dimmed rather than gone.
  // The overlapping portion becomes non-interactive (the front section's own
  // fill/bands sit on top there) — correct: you can't click through
  // something genuinely in front of you. Any non-overlapping portion of the
  // scene is unaffected and stays fully interactive.
  const { coveredIds: trappedSceneIds, hostSectionId: trappedHostSectionId } = useVisuallyCoveredSceneIds();
  const trappedBySection = new Map<string, string[]>();
  for (const [sceneId, hostId] of trappedHostSectionId) {
    trappedBySection.set(hostId, [...(trappedBySection.get(hostId) ?? []), sceneId]);
  }

  return (
    <CanvasOriginContext.Provider value={{ toWorld }}>
      <div className="canvas-area">
        <div
          ref={containerRef}
          className="canvas-root"
          style={{
            cursor,
            backgroundPosition: `${viewport.panX}px ${viewport.panY}px`,
            backgroundSize: `${GRID_SIZE * viewport.zoom}px ${GRID_SIZE * viewport.zoom}px`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onContextMenu={onContextMenu}
        >
          <div
            className="canvas-world"
            style={{
              transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
            }}
          >
            {/*
              Sections and their own members are interleaved, in
              sectionOrder (back to front): a section's fill renders right
              before its own members, so when two sections overlap, the
              front one's fill paints over any scene belonging to the back
              one that falls in the overlap — without touching membership,
              which is unaffected by this purely visual stacking. A
              section's own members always sit above its own fill, same as
              before. Scenes "covered" by a front section (see
              trappedBySection above) render right before that section's own
              fill — behind it and behind its real members — instead of in
              their normal slot. Everything else (loose scenes with nothing
              in front of them) renders last, on top of everything, matching
              the original always-on-top behavior.
            */}
            {sectionOrder.map((id) => {
              const section = sections[id];
              if (!section) return null;
              return (
                <Fragment key={id}>
                  {(trappedBySection.get(id) ?? []).map((sceneId) => {
                    const scene = scenes[sceneId];
                    if (!scene) return null;
                    return (
                      <SceneView
                        key={sceneId}
                        scene={scene}
                        isSelected={selection.sceneIds.includes(sceneId)}
                        isLeaving={leavingIds.has(sceneId)}
                        isCapturePreview={captureIds.has(sceneId)}
                        isTrapped
                      />
                    );
                  })}
                  <SectionView section={section} />
                  {sceneOrder.map((sceneId) => {
                    const scene = scenes[sceneId];
                    if (!scene || scene.sectionId !== id) return null;
                    // Covered by some OTHER (frontmost) section instead — already
                    // rendered above, in that section's fragment, tinted.
                    if (trappedSceneIds.has(sceneId)) return null;
                    return (
                      <SceneView
                        key={sceneId}
                        scene={scene}
                        isSelected={selection.sceneIds.includes(sceneId)}
                        isLeaving={leavingIds.has(sceneId)}
                        isCapturePreview={captureIds.has(sceneId)}
                      />
                    );
                  })}
                </Fragment>
              );
            })}
            {/* Rendered before loose scenes so the draw/marquee preview (e.g.
                a new section being drawn around existing loose scenes) sits
                behind them instead of covering them while dragging. */}
            <DragOverlays />
            {sceneOrder.map((id) => {
              const scene = scenes[id];
              if (!scene || scene.sectionId !== null) return null;
              if (trappedSceneIds.has(id)) return null; // rendered above, behind its host section
              return (
                <SceneView
                  key={id}
                  scene={scene}
                  isSelected={selection.sceneIds.includes(id)}
                  isLeaving={leavingIds.has(id)}
                  isCapturePreview={captureIds.has(id)}
                />
              );
            })}
          </div>
          <SceneOverlayLayer />
          <SectionBordersLayer />
          <SectionLabelsLayer />
        </div>
        <Toolbar />
        <DebugPanel />
        <MultiSelectBar />
      </div>
      <SectionContextMenu />
      <Toast />
    </CanvasOriginContext.Provider>
  );
}
