/**
 * Calculates project completeness based on filled blocks.
 * Returns { percent, blockers, readyForOperations }
 */
export function calcCompleteness(project, inventory, components, technical, financial, process) {
  const blockers = [];

  // Block 1: Base
  const baseOk = !!(
    project?.projectName &&
    project?.projectCode &&
    project?.projectType &&
    project?.projectStage &&
    project?.city &&
    project?.district &&
    project?.address
  );
  if (!baseOk) blockers.push('base');

  // Block 2: Inventory
  const inventoryOk = !!(
    inventory?.unitTypesEnabled?.length > 0 &&
    inventory?.structureModel
  );
  if (!inventoryOk) blockers.push('inventory');

  // Block 3: Components — saved = has componentsEnabled array (even if empty)
  const componentsSaved = components && Array.isArray(components.componentsEnabled);
  if (!componentsSaved) blockers.push('components');

  // Block 4: Technical
  const technicalOk = !!(
    technical?.installationStatus &&
    technical?.energyClass
  );

  // Block 5: Financial
  const financialOk = !!(
    financial?.developerCompanyName &&
    financial?.developerCompanyCode &&
    financial?.developerEmail
  );
  if (!financialOk) blockers.push('financial');

  // Block 6: Process — saved = has at least one field set
  const processOk = !!(process && Object.keys(process).length > 0);

  const totalBlocks = 6;
  const filledBlocks = [baseOk, inventoryOk, componentsSaved, technicalOk, financialOk, processOk]
    .filter(Boolean).length;
  const percent = Math.round((filledBlocks / totalBlocks) * 100);

  const criticalBlockers = blockers.filter(b => ['base', 'inventory', 'components', 'financial'].includes(b));
  const readyForOperations = criticalBlockers.length === 0;

  return { percent, blockers, criticalBlockers, readyForOperations };
}

export function canSetInternalReady(project, inventory, components, financial) {
  const { criticalBlockers } = calcCompleteness(project, inventory, components, null, financial, null);
  return criticalBlockers.length === 0;
}