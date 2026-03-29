import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const role = normalizeRole(user.role);
    if (!['ADMINISTRATOR', 'SALES_MANAGER'].includes(role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { incidentId, comment } = await req.json();
    if (!incidentId) return Response.json({ error: 'incidentId required' }, { status: 400 });

    const incidents = await base44.asServiceRole.entities.SystemIncident.filter({ id: incidentId });
    if (!incidents?.length) return Response.json({ error: 'Incident not found' }, { status: 404 });
    const incident = incidents[0];
    if (incident.status === 'resolved') {
      return Response.json({ error: 'Incident already resolved' }, { status: 409 });
    }

    const updated = await base44.asServiceRole.entities.SystemIncident.update(incidentId, {
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
      resolvedByUserId: user.id,
      comment: comment || incident.comment
    });

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'INCIDENT_RESOLVED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({ incidentId, incidentType: incident.incidentType, comment })
    });

    return Response.json({ success: true, incident: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});