import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const now = () => new Date().toISOString();

async function openIncidentExists(base44, incidentType) {
  const existing = await base44.asServiceRole.entities.SystemIncident.filter({ incidentType, status: 'open' });
  return existing?.length > 0;
}

async function createIncident(base44, incidentType, severity, description, relatedEntityType, relatedEntityId) {
  return base44.asServiceRole.entities.SystemIncident.create({
    incidentType,
    severity,
    status: 'open',
    relatedEntityType: relatedEntityType || 'System',
    relatedEntityId: relatedEntityId || 'system',
    description,
    createdAt: now()
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const created = [];
    const checkedAt = now();
    const cutoff1h = new Date(Date.now() - 3600000).toISOString();

    // 1. CRITICAL health checks → open incident
    const recentChecks = await base44.asServiceRole.entities.SystemHealthCheck.list('-checkedAt', 50);
    const latestByName = {};
    for (const c of (recentChecks || [])) {
      if (!latestByName[c.checkName]) latestByName[c.checkName] = c;
    }
    for (const check of Object.values(latestByName)) {
      if (check.status === 'critical') {
        const type = `CRITICAL_HEALTH_${check.checkName.toUpperCase()}`;
        if (!await openIncidentExists(base44, type)) {
          const inc = await createIncident(base44, type, 'critical',
            `Health check '${check.checkName}' is CRITICAL: ${check.message}`,
            'SystemHealthCheck', check.id);
          created.push(inc.id);
        }
      }
    }

    // 2. WEBHOOK FAILURE SPIKE (> 5 failed in last 1h)
    const failedDeliveries = await base44.asServiceRole.entities.WebhookDelivery.filter({ status: 'failed' });
    const recentFailed = (failedDeliveries || []).filter(d => (d.lastAttemptAt || d.created_date) > cutoff1h);
    if (recentFailed.length >= 5 && !await openIncidentExists(base44, 'WEBHOOK_FAILURE_SPIKE')) {
      const inc = await createIncident(base44, 'WEBHOOK_FAILURE_SPIKE', 'high',
        `${recentFailed.length} webhook delivery failures in the last hour`, 'WebhookDelivery', 'bulk');
      created.push(inc.id);
    }

    // 3. SLA BREACH SPIKE (> 10 overdue tasks)
    const overdueTasks = await base44.asServiceRole.entities.Task.filter({ status: 'overdue' });
    if ((overdueTasks || []).length >= 10 && !await openIncidentExists(base44, 'SLA_BREACH_SPIKE')) {
      const inc = await createIncident(base44, 'SLA_BREACH_SPIKE', 'high',
        `${overdueTasks.length} tasks are currently overdue (SLA breach spike)`, 'Task', 'bulk');
      created.push(inc.id);
    }

    // 4. IMPORT FAILURES ACCUMULATING (> 3 failed)
    const failedImports = await base44.asServiceRole.entities.ImportSession.filter({ status: 'failed' });
    if ((failedImports || []).length >= 3 && !await openIncidentExists(base44, 'IMPORT_FAILURES')) {
      const inc = await createIncident(base44, 'IMPORT_FAILURES', 'medium',
        `${failedImports.length} import sessions have failed`, 'ImportSession', 'bulk');
      created.push(inc.id);
    }

    // 5. DATA INTEGRITY CRITICAL ISSUES
    const criticalIntegrity = await base44.asServiceRole.entities.DataIntegrityIssue.filter({ severity: 'critical', resolved: false });
    if ((criticalIntegrity || []).length >= 1 && !await openIncidentExists(base44, 'DATA_INTEGRITY_CRITICAL')) {
      const inc = await createIncident(base44, 'DATA_INTEGRITY_CRITICAL', 'critical',
        `${criticalIntegrity.length} critical data integrity issue(s) detected`, 'DataIntegrityIssue', criticalIntegrity[0]?.id);
      created.push(inc.id);
    }

    // 6. PAYOUT INCONSISTENCY
    const payoutIssues = await base44.asServiceRole.entities.DataIntegrityIssue.filter({ issueType: 'PAYOUT_COMMISSION_MISMATCH', resolved: false });
    if ((payoutIssues || []).length >= 1 && !await openIncidentExists(base44, 'PAYOUT_INCONSISTENCY')) {
      const inc = await createIncident(base44, 'PAYOUT_INCONSISTENCY', 'high',
        `${payoutIssues.length} payout/commission mismatch(es) detected`, 'Commission', payoutIssues[0]?.entityId);
      created.push(inc.id);
    }

    if (created.length > 0) {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'INCIDENTS_DETECTED',
        performedByUserId: 'system',
        performedByName: 'Incident Detector',
        details: JSON.stringify({ newIncidents: created.length, incidentIds: created, checkedAt })
      });
    }

    return Response.json({ success: true, checkedAt, incidentsCreated: created.length, incidentIds: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});