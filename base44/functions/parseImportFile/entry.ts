import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Role normalization and system limits helper
const normalizeRole = (role) => {
  const map = { 'admin': 'ADMINISTRATOR', 'user': 'SALES_AGENT' };
  return map[role] || role;
};

async function getSystemLimit(key, defaultValue = null, base44) {
  try {
    const limits = await base44.asServiceRole.entities.SystemLimit.filter({ key });
    if (limits && limits.length > 0) {
      return limits[0].value;
    }
  } catch (error) {
    console.warn(`Failed to fetch limit ${key}:`, error.message);
  }
  return defaultValue;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role normalization
    const role = normalizeRole(user.role);
    
    if (role !== 'ADMINISTRATOR' && role !== 'SALES_MANAGER') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { importType, projectId, rows, mapping } = await req.json();

    if (!importType || !projectId || !Array.isArray(rows) || !mapping) {
      return Response.json({ 
        error: 'Missing: importType, projectId, rows, mapping' 
      }, { status: 400 });
    }

    // GOVERNANCE FIX: Check import.maxRowsPerImport from SystemLimit
    const maxRows = await getSystemLimit('import.maxRows', 1000, base44);
    if (rows.length > maxRows) {
      return Response.json({
        error: `Import exceeds max rows limit (${maxRows}). Submitted: ${rows.length}`
      }, { status: 400 });
    }

    // Verify project exists and user has access
    const projects = await base44.entities.Project.filter({ id: projectId });
    if (!projects || projects.length === 0) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check user access to project (managers can only access assigned projects)
    if (role === 'SALES_MANAGER') {
      const userProjects = await base44.entities.UserProjectAssignment.filter({
        userId: user.id,
        projectId: projectId,
        removedAt: null
      });
      if (!userProjects || userProjects.length === 0) {
        return Response.json({ error: 'No access to this project' }, { status: 403 });
      }
    }

    // Parse rows based on import type
    const parseResult = await parseByType(importType, rows, mapping, projects[0], base44);

    return Response.json(parseResult);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function parseByType(importType, rows, mapping, project, base44) {
  const validRows = [];
  const invalidRows = [];

  if (importType === 'units') {
    return await parseUnits(rows, mapping, project, base44, validRows, invalidRows);
  }
  if (importType === 'components') {
    return await parseComponents(rows, mapping, project, base44, validRows, invalidRows);
  }
  if (importType === 'bulk_price') {
    return await parseBulkPrice(rows, mapping, project, base44, validRows, invalidRows);
  }
  if (importType === 'bulk_status') {
    return await parseBulkStatus(rows, mapping, project, base44, validRows, invalidRows);
  }
  if (importType === 'bulk_publish') {
    return await parseBulkPublish(rows, mapping, project, base44, validRows, invalidRows);
  }

  return { error: 'Unknown importType' };
}

async function parseUnits(rows, mapping, project, base44, validRows, invalidRows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors = [];

    // Extract fields based on mapping
    const label = row[mapping.label];
    const type = row[mapping.type];
    const areaM2 = parseFloat(row[mapping.areaM2]);
    const price = parseFloat(row[mapping.price]);
    const roomsCount = parseFloat(row[mapping.roomsCount]);
    const bathroomsCount = parseFloat(row[mapping.bathroomsCount]);
    const floor = row[mapping.floor] ? parseFloat(row[mapping.floor]) : null;
    const floorsCount = row[mapping.floorsCount] ? parseFloat(row[mapping.floorsCount]) : null;

    // Validate
    if (!label) errors.push('label reikalinga');
    if (!type || !['apartment', 'house', 'townhouse'].includes(type)) {
      errors.push('type turi būti apartment, house arba townhouse');
    }
    if (!areaM2 || areaM2 <= 0) errors.push('areaM2 turi būti > 0');
    if (typeof price !== 'number' || price < 0) errors.push('price turi būti >= 0');
    if (!roomsCount || roomsCount < 0) errors.push('roomsCount reikalingas');
    if (!bathroomsCount || bathroomsCount < 0) errors.push('bathroomsCount reikalingas');
    if (type === 'apartment' && !floor) errors.push('apartment turi floor');
    if ((type === 'house' || type === 'townhouse') && !floorsCount) {
      errors.push(type + ' turi floorsCount');
    }

    if (errors.length > 0) {
      invalidRows.push({
        rowNumber: i + 2,
        data: row,
        errors
      });
      continue;
    }

    validRows.push({
      label,
      type,
      areaM2,
      price,
      pricePerM2: Math.round(price / areaM2),
      roomsCount,
      bathroomsCount,
      floor,
      floorsCount,
      buildingName: row[mapping.buildingName] || null,
      sectionName: row[mapping.sectionName] || null,
      phaseName: row[mapping.phaseName] || null,
      installationStatus: row[mapping.installationStatus] || 'not_finished',
      energyClass: row[mapping.energyClass] || 'other',
      constructionYear: row[mapping.constructionYear] ? parseFloat(row[mapping.constructionYear]) : null,
      hasBalcony: row[mapping.hasBalcony] === 'true' || row[mapping.hasBalcony] === '1',
      hasTerrace: row[mapping.hasTerrace] === 'true' || row[mapping.hasTerrace] === '1',
      hasGarage: row[mapping.hasGarage] === 'true' || row[mapping.hasGarage] === '1',
      publicComment: row[mapping.publicComment] || null,
      isPublic: false,
      projectId: project.id
    });
  }

  return {
    success: true,
    validRowCount: validRows.length,
    invalidRowCount: invalidRows.length,
    validRows,
    invalidRows
  };
}

async function parseComponents(rows, mapping, project, base44, validRows, invalidRows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors = [];

    const type = row[mapping.type];
    const label = row[mapping.label];
    const includedInPrice = row[mapping.includedInPrice] === 'true' || row[mapping.includedInPrice] === '1';

    if (!type || !['land', 'parking', 'storage'].includes(type)) {
      errors.push('type turi būti land, parking arba storage');
    }
    if (!label) errors.push('label reikalinga');

    if (errors.length > 0) {
      invalidRows.push({ rowNumber: i + 2, data: row, errors });
      continue;
    }

    validRows.push({
      projectId: project.id,
      type,
      label,
      status: 'available',
      includedInPrice,
      price: row[mapping.price] ? parseFloat(row[mapping.price]) : null,
      landType: row[mapping.landType] || null,
      parkingPlacement: row[mapping.parkingPlacement] || null,
      parkingUseType: row[mapping.parkingUseType] || null,
      storageAreaM2: row[mapping.storageAreaM2] ? parseFloat(row[mapping.storageAreaM2]) : null
    });
  }

  return {
    success: true,
    validRowCount: validRows.length,
    invalidRowCount: invalidRows.length,
    validRows,
    invalidRows
  };
}

async function parseBulkPrice(rows, mapping, project, base44, validRows, invalidRows) {
  const units = await base44.entities.SaleUnit.filter({ projectId: project.id });
  const unitsByLabel = Object.fromEntries(units.map(u => [u.label, u]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors = [];

    const label = row[mapping.label];
    const newPrice = parseFloat(row[mapping.newPrice]);

    if (!label) errors.push('label reikalinga');
    if (typeof newPrice !== 'number' || newPrice < 0) errors.push('newPrice turi būti >= 0');

    const unit = unitsByLabel[label];
    if (!unit) errors.push('Unit su šiuo label nerastas');
    if (unit && unit.internalStatus === 'sold') errors.push('Negali keisti sold unit kainos');

    if (errors.length > 0) {
      invalidRows.push({ rowNumber: i + 2, data: row, errors });
      continue;
    }

    validRows.push({
      unitId: unit.id,
      label,
      oldPrice: unit.price,
      newPrice,
      newPricePerM2: Math.round(newPrice / unit.areaM2)
    });
  }

  return {
    success: true,
    validRowCount: validRows.length,
    invalidRowCount: invalidRows.length,
    validRows,
    invalidRows
  };
}

async function parseBulkStatus(rows, mapping, project, base44, validRows, invalidRows) {
  const units = await base44.entities.SaleUnit.filter({ projectId: project.id });
  const unitsByLabel = Object.fromEntries(units.map(u => [u.label, u]));

  const allowedTransitions = {
    'available->withheld': true,
    'withheld->available': true,
    'available->developer_reserved': true,
    'developer_reserved->available': true
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors = [];

    const label = row[mapping.label];
    const newStatus = row[mapping.newStatus];

    if (!label) errors.push('label reikalinga');
    if (!newStatus) errors.push('newStatus reikalingas');

    const unit = unitsByLabel[label];
    if (!unit) errors.push('Unit su šiuo label nerastas');

    const transition = `${unit?.internalStatus}->${newStatus}`;
    if (unit && !allowedTransitions[transition]) {
      errors.push(`Statusų perėjimas neleidžiamas: ${transition}`);
    }

    if (errors.length > 0) {
      invalidRows.push({ rowNumber: i + 2, data: row, errors });
      continue;
    }

    validRows.push({
      unitId: unit.id,
      label,
      oldStatus: unit.internalStatus,
      newStatus
    });
  }

  return {
    success: true,
    validRowCount: validRows.length,
    invalidRowCount: invalidRows.length,
    validRows,
    invalidRows
  };
}

async function parseBulkPublish(rows, mapping, project, base44, validRows, invalidRows) {
  const units = await base44.entities.SaleUnit.filter({ projectId: project.id });
  const unitsByLabel = Object.fromEntries(units.map(u => [u.label, u]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const errors = [];

    const label = row[mapping.label];
    const action = row[mapping.action]; // 'publish' arba 'unpublish'

    if (!label) errors.push('label reikalinga');
    if (!action || !['publish', 'unpublish'].includes(action)) {
      errors.push('action turi būti publish arba unpublish');
    }

    const unit = unitsByLabel[label];
    if (!unit) errors.push('Unit su šiuo label nerastas');

    if (action === 'publish') {
      if (unit && unit.internalStatus !== 'available') {
        errors.push('Tik available units gali būti publikuojami');
      }
      if (unit && !project.isPublic) {
        errors.push('Projektas turi būti public prieš publikuojant units');
      }
    }

    if (errors.length > 0) {
      invalidRows.push({ rowNumber: i + 2, data: row, errors });
      continue;
    }

    validRows.push({
      unitId: unit.id,
      label,
      action,
      currentStatus: unit.internalStatus,
      currentIsPublic: unit.isPublic
    });
  }

  return {
    success: true,
    validRowCount: validRows.length,
    invalidRowCount: invalidRows.length,
    validRows,
    invalidRows
  };
}