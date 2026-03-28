/**
 * Validates component assignment before persisting.
 * - Prevents assigning sold/withheld components
 * - Prevents double assignment
 * - Ensures project isolation
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { componentId, unitId } = await req.json();

    if (!componentId || !unitId) {
      return Response.json(
        { error: 'Missing componentId or unitId' },
        { status: 400 }
      );
    }

    // Fetch component and unit
    const component = await base44.entities.UnitComponent.filter({ id: componentId }).then(r => r?.[0]);
    const unit = await base44.entities.SaleUnit.filter({ id: unitId }).then(r => r?.[0]);

    if (!component || !unit) {
      return Response.json({ error: 'Component or unit not found' }, { status: 404 });
    }

    // Check 1: sold/withheld status
    if (component.status === 'sold' || component.status === 'withheld') {
      return Response.json(
        { error: `Cannot assign ${component.status} component`, valid: false },
        { status: 400 }
      );
    }

    // Check 2: already assigned
    if (component.unitId && component.unitId !== unitId) {
      return Response.json(
        { error: 'Component already assigned to another unit', valid: false },
        { status: 400 }
      );
    }

    // Check 3: project isolation
    if (component.projectId !== unit.projectId) {
      return Response.json(
        { error: 'Component and unit must belong to same project', valid: false },
        { status: 400 }
      );
    }

    return Response.json({ valid: true });
  } catch (error) {
    console.error('Validation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});