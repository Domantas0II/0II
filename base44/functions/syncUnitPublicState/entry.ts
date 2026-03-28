import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Only handle update events
    if (event.type !== 'update') {
      return Response.json({ success: true });
    }

    // Only sync if internalStatus changed
    if (!data.changed_fields || !data.changed_fields.includes('internalStatus')) {
      return Response.json({ success: true });
    }

    const unit = data.data;
    const oldStatus = data.old_data?.internalStatus;

    // If status changed from 'available' to anything else,
    // unpublish the unit to keep data model clean
    if (oldStatus === 'available' && unit.internalStatus !== 'available' && unit.isPublic) {
      await base44.asServiceRole.entities.SaleUnit.update(unit.id, {
        isPublic: false
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});