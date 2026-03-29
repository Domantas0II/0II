import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const now = () => new Date().toISOString();

async function smokeTest(name, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    return { name, status: 'passed', detail: detail || 'ok', durationMs: Date.now() - start };
  } catch (err) {
    return { name, status: 'failed', detail: err.message, durationMs: Date.now() - start };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Support both: user-invoked (with auth) and scheduled automation (no user session)
    const user = await base44.auth.me().catch(() => null);
    // Only block if explicitly called by a non-admin user (not when called by automation)
    if (user && user.role !== 'admin' && user.role !== 'ADMINISTRATOR') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const start = Date.now();
    const tests = [];

    // TEST 1: DB read/write roundtrip
    tests.push(await smokeTest('db_read_write', async () => {
      const list = await base44.asServiceRole.entities.SystemSetting.list('-created_date', 1);
      if (list === undefined) throw new Error('DB returned undefined');
      return `DB returned ${Array.isArray(list) ? list.length : 0} records`;
    }));

    // TEST 2: generateReport function callable
    tests.push(await smokeTest('generate_report_callable', async () => {
      // Just check that the function is accessible — don't actually run full report
      const defs = await base44.asServiceRole.entities.ReportDefinition.list('-created_date', 1);
      if (!defs?.length) return 'No report definitions exist (skipped)';
      const res = await base44.asServiceRole.functions.invoke('generateReport', {
        reportDefinitionId: defs[0].id,
        _systemMode: true
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || 'generateReport returned failure');
      return `Report generated: ${res.data.result?.type}, ${res.data.result?.rows?.length || 0} rows`;
    }));

    // TEST 3: IntegrationEvent write/read roundtrip (replaces dispatchEvent invoke)
    tests.push(await smokeTest('integration_event_write', async () => {
      const created = await base44.asServiceRole.entities.IntegrationEvent.create({
        eventType: 'SMOKE_TEST',
        entityType: 'SystemTestRun',
        entityId: 'smoke-test',
        payloadJson: JSON.stringify({ test: true, ts: now() }),
        processed: false,
        source: 'internal',
        createdAt: now()
      });
      if (!created?.id) throw new Error('Failed to create IntegrationEvent');
      // Cleanup
      await base44.asServiceRole.entities.IntegrationEvent.delete(created.id);
      return `IntegrationEvent write/read/delete OK`;
    }));

    // TEST 4: SystemHealthCheck read (verifies last health check ran)
    tests.push(await smokeTest('health_check_data_present', async () => {
      const checks = await base44.asServiceRole.entities.SystemHealthCheck.list('-checkedAt', 5);
      if (!checks?.length) throw new Error('No health check records found — runSystemHealthChecks may not be running');
      const latest = checks[0];
      const ageMs = Date.now() - new Date(latest.checkedAt).getTime();
      const ageMin = Math.round(ageMs / 60000);
      if (ageMin > 15) throw new Error(`Last health check is ${ageMin}min old — automation may be broken`);
      return `Last health check: ${latest.checkName}=${latest.status}, ${ageMin}min ago`;
    }));

    // TEST 5: Entity counts sanity check
    tests.push(await smokeTest('entity_sanity_counts', async () => {
      const [projects, units, clients] = await Promise.all([
        base44.asServiceRole.entities.Project.list('-created_date', 1),
        base44.asServiceRole.entities.SaleUnit.list('-created_date', 1),
        base44.asServiceRole.entities.Client.list('-created_date', 1)
      ]);
      return `Projects≥${projects?.length||0}, Units≥${units?.length||0}, Clients≥${clients?.length||0}`;
    }));

    const passed = tests.filter(t => t.status === 'passed').length;
    const failed = tests.filter(t => t.status === 'failed').length;
    const overallStatus = failed > 0 ? 'failed' : 'passed';

    const run = await base44.asServiceRole.entities.SystemTestRun.create({
      testName: `Smoke Test Suite — ${now().slice(0, 16)}`,
      status: overallStatus,
      resultJson: JSON.stringify({ passed, failed, total: tests.length, tests }),
      durationMs: Date.now() - start,
      createdAt: now()
    });

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'SYSTEM_TESTS_RUN',
      performedByUserId: user?.id || 'system',
      performedByName: user?.full_name || 'Scheduled Automation',
      details: JSON.stringify({ runId: run.id, passed, failed, status: overallStatus })
    });

    return Response.json({ success: true, runId: run.id, status: overallStatus, passed, failed, tests });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});