import { createContext, useContext } from 'react';
import type { Point } from '../types';

export interface CanvasOrigin {
  toWorld: (clientX: number, clientY: number) => Point;
}

export const CanvasOriginContext = createContext<CanvasOrigin | null>(null);

export function useCanvasOrigin(): CanvasOrigin {
  const ctx = useContext(CanvasOriginContext);
  if (!ctx) throw new Error('useCanvasOrigin must be used within <Canvas>');
  return ctx;
}
