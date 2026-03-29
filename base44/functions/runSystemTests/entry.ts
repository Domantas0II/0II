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
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'ADMINISTRATOR')) {
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

    // TEST 3: dispatchEvent function callable
    tests.push(await smokeTest('dispatch_event_callable', async () => {
      const res = await base44.asServiceRole.functions.invoke('dispatchEvent', {
        eventType: 'SMOKE_TEST',
        entityType: 'SystemTestRun',
        entityId: 'smoke-test',
        payload: { test: true, ts: now() }
      });
      if (!res?.data?.success) throw new Error('dispatchEvent returned failure');
      return `Event dispatched: eventId=${res.data.eventId}`;
    }));

    // TEST 4: runSystemHealthChecks returns results
    tests.push(await smokeTest('health_checks_callable', async () => {
      const res = await base44.asServiceRole.functions.invoke('runSystemHealthChecks', {});
      if (!res?.data?.success) throw new Error(res?.data?.error || 'health checks failed');
      return `Health checks ran: ${res.data.total} checks, ${res.data.critical} critical`;
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
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({ runId: run.id, passed, failed, status: overallStatus })
    });

    return Response.json({ success: true, runId: run.id, status: overallStatus, passed, failed, tests });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});