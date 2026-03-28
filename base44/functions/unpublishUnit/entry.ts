import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { unitId } = await req.json();

    if (!unitId) {
      return Response.json({ error: 'unitId required' }, { status: 400 });
    }

    // Update unit
    await base44.entities.SaleUnit.update(unitId, {
      isPublic: false
    });

    return Response.json({
      success: true,
      message: 'Unit unpublished successfully'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});