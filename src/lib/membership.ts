import type { SceneModel } from '../types';

/**
 * Membership is a stored field on each scene (see SceneModel.sectionId), not
 * derived from geometry — sections can overlap, so containment alone can't
 * unambiguously say which section a scene belongs to. This just projects
 * that field into a lookup map for consumers (debug panel, layer panel).
 */
export function computeMembership(scenes: Record<string, SceneModel>): Map<string, string> {
  const membership = new Map<string, string>();
  for (const scene of Object.values(scenes)) {
    if (scene.sectionId) membership.set(scene.id, scene.sectionId);
  }
  return membership;
}

export function membersOfSection(sectionId: string, scenes: Record<string, SceneModel>): SceneModel[] {
  return Object.values(scenes).filter((s) => s.sectionId === sectionId);
}
