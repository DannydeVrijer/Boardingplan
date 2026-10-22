import type { Project } from './types';
import { uid } from './util';

const KEY = 'boardingplan.projects.v1';
const CURRENT = 'boardingplan.current.v1';

export function newProject(name = 'Nieuw event'): Project {
  return {
    id: uid(),
    name,
    metersPerPosition: 4,
    partners: [],
    assignment: {},
    locked: [],
    valueOverrides: {},
    knsbPremium: true,
    updatedAt: Date.now(),
  };
}

export function loadProjects(): { projects: Project[]; currentId: string } {
  try {
    const raw = localStorage.getItem(KEY);
    const projects: Project[] = raw ? JSON.parse(raw) : [];
    if (projects.length) {
      const cur = localStorage.getItem(CURRENT);
      return { projects, currentId: projects.some((p) => p.id === cur) ? cur! : projects[0].id };
    }
  } catch {
    /* lege of geblokkeerde opslag */
  }
  const p = newProject();
  return { projects: [p], currentId: p.id };
}

/** Geeft false terug als opslaan niet lukt (bijv. te veel/te grote logo's). */
export function saveProjects(projects: Project[], currentId: string): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(projects));
    localStorage.setItem(CURRENT, currentId);
    return true;
  } catch {
    return false;
  }
}
