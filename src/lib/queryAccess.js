/**
 * Central query access control.
 * Naudoti VISUR kur fetchinamas Project, Unit, Component duomenys.
 * Garantuoja, kad user mato tik jam prieinamus duomenis.
 */

import { normalizeRole, isAdministrator } from '@/lib/constants';

/**
 * Grąžina projektų ID masyvą, kuriems user turi prieigą.
 * - ADMINISTRATOR → null (reiškia: ALL)
 * - Kiti → tik priskirti per UserProjectAssignment
 */
export async function getAccessibleProjectIds(user, base44) {
  const role = normalizeRole(user?.role);
  
  // Administratorius mato visus projektus
  if (isAdministrator(role)) {
    return null; // null = ALL projects
  }

  // Gauti user's assignment'us (tik realūs assignment'ai, be allProjects)
  try {
    const assignments = await base44.entities.UserProjectAssignment.filter({
      userId: user?.id,
      removedAt: null, // tik aktyvūs
    });

    // Grąžinti tik priskirtas projektų IDs
    return assignments.map(a => a.projectId).filter(Boolean);
  } catch (err) {
    console.error('Failed to load accessible projects:', err);
    return []; // block access on error
  }
}

/**
 * Filtruoja sąrašą pagal accessible projects.
 * - Jei user turi visų projektų prieigą → grąžina viską
 * - Kitaip → tik projektus iš accessibleIds
 */
export function filterByAccessibleProjects(items, accessibleProjectIds) {
  if (accessibleProjectIds === null) return items; // ALL
  return items.filter(item => accessibleProjectIds.includes(item.projectId));
}

/**
 * Tikrina ar user gali prieiti konkretų projektą.
 */
export async function canAccessProject(user, projectId, base44) {
  const role = normalizeRole(user?.role);
  
  if (isAdministrator(role)) return true;

  try {
    const assignments = await base44.entities.UserProjectAssignment.filter({
      userId: user?.id,
      projectId,
      removedAt: null,
    });

    if (assignments.some(a => a.allProjects)) return true;
    return assignments.length > 0;
  } catch {
    return false;
  }
}