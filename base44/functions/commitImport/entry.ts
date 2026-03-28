import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { normalizeRole } = await import('./lib/constants.js');
    const role = normalizeRole(user.role);
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

    let committedCount = 0;
    const errors = [];

    try {
      if (importType === 'units') {
        committedCount = await commitUnits(validRows, base44);
      } else if (importType === 'components') {
        committedCount = await commitComponents(validRows, base44);
      } else if (importType === 'bulk_price') {
        committedCount = await commitBulkPrice(validRows, base44);
      } else if (importType === 'bulk_status') {
        committedCount = await commitBulkStatus(validRows, base44);
      } else if (importType === 'bulk_publish') {
        committedCount = await commitBulkPublish(validRows, base44);
      }

      const finalStatus = committedCount === validRows.length ? 'committed' : 'partially_committed';
      
      await base44.entities.ImportSession.update(importSessionId, {
        status: finalStatus,
        committedRowCount: committedCount,
        committedAt: new Date().toISOString()
      });

      return Response.json({
        success: true,
        committedCount,
        totalRows: validRows.length,
        status: finalStatus
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
  for (const row of validRows) {
    try {
      await base44.entities.SaleUnit.create(row);
      count++;
    } catch (err) {
      console.error(`Failed to create unit ${row.label}:`, err.message);
    }
  }
  return count;
}

async function commitComponents(validRows, base44) {
  let count = 0;
  for (const row of validRows) {
    try {
      await base44.entities.UnitComponent.create(row);
      count++;
    } catch (err) {
      console.error(`Failed to create component ${row.label}:`, err.message);
    }
  }
  return count;
}

async function commitBulkPrice(validRows, base44) {
  let count = 0;
  for (const row of validRows) {
    try {
      await base44.entities.SaleUnit.update(row.unitId, {
        price: row.newPrice,
        pricePerM2: row.newPricePerM2
      });
      count++;
    } catch (err) {
      console.error(`Failed to update price for ${row.label}:`, err.message);
    }
  }
  return count;
}

async function commitBulkStatus(validRows, base44) {
  let count = 0;
  for (const row of validRows) {
    try {
      await base44.entities.SaleUnit.update(row.unitId, {
        internalStatus: row.newStatus
      });
      count++;
    } catch (err) {
      console.error(`Failed to update status for ${row.label}:`, err.message);
    }
  }
  return count;
}

async function commitBulkPublish(validRows, base44) {
  let count = 0;
  for (const row of validRows) {
    try {
      const isPublic = row.action === 'publish';
      await base44.entities.SaleUnit.update(row.unitId, {
        isPublic
      });
      count++;
    } catch (err) {
      console.error(`Failed to update publish status for ${row.label}:`, err.message);
    }
  }
  return count;
}