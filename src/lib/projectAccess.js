/**
 * Central project access helpers.
 * Naudoti VISUR kur reikia filtruoti pagal projektų prieigą.
 */

import { isAdministrator, normalizeRole } from '@/lib/constants';

/**
 * Grąžina true jei vartotojas turi prieigą prie visko (ADMINISTRATOR arba allProjects).
 */
export function hasUnlimitedAccess(user, assignments = []) {
  if (isAdministrator(user?.role)) return true;
  // SALES_MANAGER su allProjects priskyrimu taip pat turi visišką prieigą
  return assignments.some(a => !a.removedAt && a.userId === user?.id && a.allProjects);
}

/**
 * Grąžina prieigą turinčių projektų ID masyvą.
 * - ADMINISTRATOR: grąžina null (reiškia: visi)
 * - Kiti: grąžina projektų ID masyvą pagal assignments
 */
export function getAccessibleProjectIds(user, assignments = []) {
  if (isAdministrator(normalizeRole(user?.role))) return null; // null = neribota
  const userAssignments = assignments.filter(a => !a.removedAt && a.userId === user?.id);
  if (userAssignments.some(a => a.allProjects)) return null; // null = neribota
  return userAssignments.map(a => a.projectId).filter(Boolean);
}

/**
 * Tikrina ar vartotojas turi prieigą prie konkretaus projekto.
 */
export function canAccessProject(user, projectId, assignments = []) {
  if (isAdministrator(normalizeRole(user?.role))) return true;
  const userAssignments = assignments.filter(a => !a.removedAt && a.userId === user?.id);
  if (userAssignments.some(a => a.allProjects)) return true;
  return userAssignments.some(a => a.projectId === projectId);
}

/**
 * Filtruoja projektų sąrašą pagal vartotojo prieigą.
 */
export function filterProjectsByAccess(projects, user, assignments = []) {
  const accessibleIds = getAccessibleProjectIds(user, assignments);
  if (accessibleIds === null) return projects; // neribota prieiga
  return projects.filter(p => accessibleIds.includes(p.id));
}

/**
 * Filtruoja projektinius įrašus (units, components...) pagal prieigą.
 */
export function filterByProjectAccess(items, user, assignments = []) {
  const accessibleIds = getAccessibleProjectIds(user, assignments);
  if (accessibleIds === null) return items;
  return items.filter(item => accessibleIds.includes(item.projectId));
}