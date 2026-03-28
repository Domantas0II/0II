/**
 * Central project completeness calculation.
 * Naudoti VISUR po kiekvieno setup bloko išsaugojimo.
 */

/**
 * Pagrindinė skaičiavimo funkcija.
 * Returns { percent, blockers, criticalBlockers, readyForOperations }
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

  // Block 2: Inventory — reikia bent vieno tipo IR struktūros modelio
  const inventoryOk = !!(
    inventory?.unitTypesEnabled?.length > 0 &&
    inventory?.structureModel
  );
  if (!inventoryOk) blockers.push('inventory');

  // Block 3: Components — saved + bent vienas tipas įjungtas (ne tik tuščias masyvas)
  // Tuščias masyvas reiškia "nėra dedamųjų" — tai valid pasirinkimas tik jei sąmoningai išsaugota
  // Bet componentsEnabled turi egzistuoti kaip masyvas (net tuščias = OK jei objektas išsaugotas)
  const componentsSaved = components != null && Array.isArray(components.componentsEnabled);
  if (!componentsSaved) blockers.push('components');

  // Block 4: Technical — neblokiruojantis, bet skaitomas
  const technicalOk = !!(
    technical?.installationStatus &&
    technical?.energyClass
  );

  // Block 5: Financial — atitinka entity required laukus
  const financialOk = !!(
    financial?.developerCompanyName &&
    financial?.developerCompanyCode &&
    financial?.developerEmail &&
    financial?.developerPhone &&
    financial?.developerBankAccount
  );
  if (!financialOk) blockers.push('financial');

  // Block 6: Process — valid tik jei yra bent vienas process nustatymas (ne tik projectId)
  const processFields = process
    ? Object.keys(process).filter(k => k !== 'projectId' && k !== 'id' && k !== 'created_date' && k !== 'updated_date' && k !== 'created_by')
    : [];
  const processOk = processFields.length > 0;
  if (!processOk) blockers.push('process');

  const totalBlocks = 6;
  const filledBlocks = [baseOk, inventoryOk, componentsSaved, technicalOk, financialOk, processOk]
    .filter(Boolean).length;
  const percent = Math.round((filledBlocks / totalBlocks) * 100);

  // Kritiniai blokeriai — be jų negalima internal_ready
  // VISOS 5 sekcijos yra kritinės: base, inventory, components, financial, process
  const criticalBlockers = blockers.filter(b => ['base', 'inventory', 'components', 'financial', 'process'].includes(b));
  const readyForOperations = criticalBlockers.length === 0;

  return { percent, blockers, criticalBlockers, readyForOperations };
}

/**
 * Tikrina ar galima perkelti į internal_ready.
 * Reikalingi VISI blokai: project, inventory, components, technical, financial, process
 */
export function canSetInternalReady(project, inventory, components, technical, financial, process) {
  const { criticalBlockers } = calcCompleteness(project, inventory, components, technical, financial, process);
  return criticalBlockers.length === 0;
}

/**
 * Perskaičiuoja ir išsaugo completeness į DB.
 * Naudoti po kiekvieno setup bloko save.
 */
export async function saveCompleteness(base44, projectId, project, inventory, components, technical, financial, process) {
  const { percent, criticalBlockers, readyForOperations } = calcCompleteness(
    project, inventory, components, technical, financial, process
  );

  const existing = await base44.entities.ProjectCompleteness.filter({ projectId }).then(r => r?.[0]);
  const payload = {
    projectId,
    setupProgressPercent: percent,
    readyForOperations,
    criticalBlockersJson: JSON.stringify(criticalBlockers),
  };

  if (existing) {
    await base44.entities.ProjectCompleteness.update(existing.id, payload);
  } else {
    await base44.entities.ProjectCompleteness.create(payload);
  }

  return { percent, criticalBlockers, readyForOperations };
}