import { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { SCENARIOS } from '../../lib/seed';
import { ChevronDownIcon } from '../Toolbar/icons';
import './ScenariosDropdown.css';

export function ScenariosDropdown() {
  const scenarioId = useCanvasStore((s) => s.scenarioId);
  const resetToScenario = useCanvasStore((s) => s.resetToScenario);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="scenarios-dropdown" ref={rootRef}>
      <button className="scenarios-dropdown__trigger" onClick={() => setOpen((o) => !o)}>
        <span>{current.name}</span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div className="scenarios-dropdown__menu">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              className={`scenarios-dropdown__item ${s.id === scenarioId ? 'scenarios-dropdown__item--active' : ''}`}
              onClick={() => {
                resetToScenario(s.id);
                setOpen(false);
              }}
            >
              <span className="scenarios-dropdown__item-name">{s.name}</span>
              <span className="scenarios-dropdown__item-desc">{s.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
