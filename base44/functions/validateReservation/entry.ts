import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, unitId, componentIds = [] } = body;

    // Fetch unit
    const unit = await base44.entities.SaleUnit.filter({ id: unitId }).then(r => r?.[0]);
    if (!unit) {
      return Response.json({ error: 'Objektas nerastas' }, { status: 400 });
    }

    // Check unit belongs to project
    if (unit.projectId !== projectId) {
      return Response.json({ error: 'Objektas nepriklauso projektui' }, { status: 400 });
    }

    // Check unit status
    if (['reserved', 'sold', 'developer_reserved', 'withheld'].includes(unit.internalStatus)) {
      return Response.json({ error: `Objektas jau ${unit.internalStatus}` }, { status: 400 });
    }

    // Check components
    const components = componentIds.length > 0 
      ? await base44.entities.UnitComponent.filter({ id: { $in: componentIds } })
      : [];

    // Validate all components exist and belong to project
    if (components.length !== componentIds.length) {
      return Response.json({ error: 'Viena iš dedamųjų nerasta' }, { status: 400 });
    }

    for (const comp of components) {
      if (comp.projectId !== projectId) {
        return Response.json({ error: 'Dedamoji nepriklauso projektui' }, { status: 400 });
      }
      if (!['available'].includes(comp.status)) {
        return Response.json({ error: `Dedamoji ${comp.label} jau ${comp.status}` }, { status: 400 });
      }
    }

    // Check for active/overdue reservations on unit/components
    const activeReservations = await base44.entities.Reservation.filter({
      projectId,
      status: { $in: ['active', 'overdue'] }
    });

    for (const res of activeReservations) {
      const bundle = await base44.entities.ReservationBundle.filter({ id: res.bundleId }).then(r => r?.[0]);
      if (bundle?.unitId === unitId) {
        return Response.json({ error: 'Objektas jau rezervuotas' }, { status: 400 });
      }
      if (bundle?.componentIds?.some(cid => componentIds.includes(cid))) {
        return Response.json({ error: 'Viena iš dedamųjų jau rezervuota' }, { status: 400 });
      }
    }

    return Response.json({ valid: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});