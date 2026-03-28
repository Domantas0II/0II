import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role normalization and validation
    const roleMap = { 'admin': 'ADMINISTRATOR', 'user': 'SALES_AGENT' };
    const role = roleMap[user.role] || user.role;
    
    if (role !== 'ADMINISTRATOR' && role !== 'SALES_MANAGER') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { importSessionId, validRows, importType } = await req.json();

    if (!importSessionId || !Array.isArray(validRows)) {
      return Response.json({ 
        error: 'Missing: importSessionId, validRows' 
      }, { status: 400 });
    }

    // Get session
    const sessions = await base44.entities.ImportSession.filter({ id: importSessionId });
    if (!sessions || sessions.length === 0) {
      return Response.json({ error: 'ImportSession not found' }, { status: 404 });
    }

    const session = sessions[0];
    if (session.status === 'committed' || session.status === 'partially_committed') {
      return Response.json({ error: 'Session already committed' }, { status: 400 });
    }

    // RE-CHECK: User must have access to the project
    if (role === 'SALES_MANAGER') {
      const assignments = await base44.entities.UserProjectAssignment.filter({
        userId: user.id,
        projectId: session.projectId,
        removedAt: null
      });
      if (!assignments || assignments.length === 0) {
        return Response.json({ 
          error: 'Access denied to this project for commit' 
        }, { status: 403 });
      }
    }

    let committedCount = 0;
    let commitErrors = [];

    try {
      if (importType === 'units') {
        const result = await commitUnits(validRows, base44);
        committedCount = result.count;
        commitErrors = result.errors;
      } else if (importType === 'components') {
        const result = await commitComponents(validRows, base44);
        committedCount = result.count;
        commitErrors = result.errors;
      } else if (importType === 'bulk_price') {
        const result = await commitBulkPrice(validRows, base44);
        committedCount = result.count;
        commitErrors = result.errors;
      } else if (importType === 'bulk_status') {
        const result = await commitBulkStatus(validRows, base44);
        committedCount = result.count;
        commitErrors = result.errors;
      } else if (importType === 'bulk_publish') {
        const result = await commitBulkPublish(validRows, base44);
        committedCount = result.count;
        commitErrors = result.errors;
      }

      const finalStatus = committedCount === validRows.length ? 'committed' : 'partially_committed';
      
      // Prepare final error list combining invalid rows + commit errors
      const allErrors = commitErrors.length > 0 ? JSON.stringify(commitErrors) : null;

      await base44.entities.ImportSession.update(importSessionId, {
        status: finalStatus,
        committedRowCount: committedCount,
        committedAt: new Date().toISOString(),
        ...(allErrors && { errorsJson: allErrors })
      });

      // Audit log
      if (committedCount > 0) {
        const auditAction = finalStatus === 'committed' ? 'IMPORT_COMMITTED' : 'IMPORT_PARTIALLY_COMMITTED';
        try {
          await base44.entities.AuditLog.create({
            action: auditAction,
            performedByUserId: user.id,
            performedByName: user.full_name,
            details: JSON.stringify({
              importType,
              projectId: session.projectId,
              committedCount,
              totalRows: validRows.length
            })
          });
        } catch (auditErr) {
          console.error('Failed to log audit:', auditErr.message);
        }
      }

      return Response.json({
        success: true,
        committedCount,
        totalRows: validRows.length,
        status: finalStatus,
        commitErrors: commitErrors.length > 0 ? commitErrors : undefined
      });
    } catch (error) {
      await base44.entities.ImportSession.update(importSessionId, {
        status: 'failed',
        errorsJson: JSON.stringify([{ general: error.message }])
      });
      throw error;
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function commitUnits(validRows, base44) {
  let count = 0;
  const errors = [];
  for (const row of validRows) {
    try {
      await base44.entities.SaleUnit.create(row);
      count++;
    } catch (err) {
      errors.push({
        rowNumber: row.label,
        error: `Database error: ${err.message}`
      });
    }
  }
  return { count, errors };
}

async function commitComponents(validRows, base44) {
  let count = 0;
  const errors = [];
  for (const row of validRows) {
    try {
      await base44.entities.UnitComponent.create(row);
      count++;
    } catch (err) {
      errors.push({
        rowNumber: row.label,
        error: `Database error: ${err.message}`
      });
    }
  }
  return { count, errors };
}

async function commitBulkPrice(validRows, base44) {
  let count = 0;
  const errors = [];

  for (const row of validRows) {
    try {
      // FINAL RE-CHECK: fetch fresh unit state
      const units = await base44.entities.SaleUnit.filter({ id: row.unitId });
      if (!units || units.length === 0) {
        errors.push({
          rowNumber: row.label,
          error: 'Unit not found at commit time'
        });
        continue;
      }

      const unit = units[0];

      // FINAL VALIDATION: cannot modify sold units
      if (unit.internalStatus === 'sold') {
        errors.push({
          rowNumber: row.label,
          error: 'Cannot modify price of sold unit'
        });
        continue;
      }

      // Safe to update
      await base44.entities.SaleUnit.update(row.unitId, {
        price: row.newPrice,
        pricePerM2: row.newPricePerM2
      });
      count++;
    } catch (err) {
      errors.push({
        rowNumber: row.label,
        error: `Database error: ${err.message}`
      });
    }
  }

  return { count, errors };
}

async function commitBulkStatus(validRows, base44) {
  let count = 0;
  const errors = [];

  const allowedTransitions = {
    'available->withheld': true,
    'withheld->available': true,
    'available->developer_reserved': true,
    'developer_reserved->available': true
  };

  for (const row of validRows) {
    try {
      // FINAL RE-CHECK: fetch fresh unit state
      const units = await base44.entities.SaleUnit.filter({ id: row.unitId });
      if (!units || units.length === 0) {
        errors.push({
          rowNumber: row.label,
          error: 'Unit not found at commit time'
        });
        continue;
      }

      const unit = units[0];

      // FINAL VALIDATION: re-check transition is still allowed
      const transition = `${unit.internalStatus}->${row.newStatus}`;
      if (!allowedTransitions[transition]) {
        errors.push({
          rowNumber: row.label,
          error: `Status transition not allowed at commit time: ${transition}`
        });
        continue;
      }

      // Safe to update
      await base44.entities.SaleUnit.update(row.unitId, {
        internalStatus: row.newStatus
      });
      count++;
    } catch (err) {
      errors.push({
        rowNumber: row.label,
        error: `Database error: ${err.message}`
      });
    }
  }

  return { count, errors };
}

async function commitBulkPublish(validRows, base44) {
  let count = 0;
  const errors = [];

  for (const row of validRows) {
    try {
      // FINAL RE-CHECK: fetch fresh unit state
      const units = await base44.entities.SaleUnit.filter({ id: row.unitId });
      if (!units || units.length === 0) {
        errors.push({
          rowNumber: row.label,
          error: 'Unit not found at commit time'
        });
        continue;
      }

      const unit = units[0];

      if (row.action === 'publish') {
        // Fetch fresh project state
        const projects = await base44.entities.Project.filter({ id: unit.projectId });
        if (!projects || projects.length === 0) {
          errors.push({
            rowNumber: row.label,
            error: 'Project not found at commit time'
          });
          continue;
        }

        const project = projects[0];

        // FINAL VALIDATION: publish requires all conditions
        if (unit.internalStatus !== 'available') {
          errors.push({
            rowNumber: row.label,
            error: `Unit status must be available, current: ${unit.internalStatus}`
          });
          continue;
        }

        if (!project.isPublic) {
          errors.push({
            rowNumber: row.label,
            error: 'Project is not public'
          });
          continue;
        }

        if (project.publicStatus !== 'published') {
          errors.push({
            rowNumber: row.label,
            error: `Project publicStatus must be published, current: ${project.publicStatus}`
          });
          continue;
        }

        // Safe to publish
        await base44.entities.SaleUnit.update(row.unitId, {
          isPublic: true
        });
        count++;
      } else if (row.action === 'unpublish') {
        // Unpublish is always safe
        await base44.entities.SaleUnit.update(row.unitId, {
          isPublic: false
        });
        count++;
      }
    } catch (err) {
      errors.push({
        rowNumber: row.label,
        error: `Database error: ${err.message}`
      });
    }
  }

  return { count, errors };
}