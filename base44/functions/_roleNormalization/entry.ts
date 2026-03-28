/**
 * SHARED ROLE NORMALIZATION HELPER
 * 
 * Use this in task-related functions to ensure consistent role interpretation.
 * Maps legacy/simple roles to system standard roles.
 * 
 * Copy this pattern into each function since Deno doesn't support direct imports
 * from sibling function files.
 * 
 * Usage in functions:
 * const normalizeRole = (r) => {
 *   const map = { 'admin': 'ADMINISTRATOR', 'user': 'SALES_AGENT' };
 *   return map[r] || r;
 * };
 * const role = normalizeRole(user.role);
 */

export const normalizeRole = (r) => {
  const map = {
    'admin': 'ADMINISTRATOR',
    'user': 'SALES_AGENT'
  };
  return map[r] || r;
};