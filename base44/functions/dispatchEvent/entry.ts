import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 1000;

async function deliverToEndpoint(base44, endpoint, eventType, payload) {
  const deliveryRecord = await base44.asServiceRole.entities.WebhookDelivery.create({
    endpointId: endpoint.id,
    eventType,
    payloadJson: JSON.stringify(payload),
    status: 'pending',
    attemptCount: 0,
    createdAt: new Date().toISOString()
  });

  const policy = endpoint.retryPolicyJson ? JSON.parse(endpoint.retryPolicyJson) : {};
  const maxAttempts = Math.min(policy.maxAttempts || MAX_RETRIES, MAX_RETRIES);

  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      const delay = BACKOFF_BASE_MS * Math.pow(2, attempt - 2);
      await new Promise(r => setTimeout(r, Math.min(delay, 16000)));
    }

    try {
      // Build HMAC signature if secret is set
      const body = JSON.stringify(payload);
      const headers = { 'Content-Type': 'application/json' };

      if (endpoint.secret) {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw', enc.encode(endpoint.secret),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
        const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
        headers['X-Signature-SHA256'] = `sha256=${hex}`;
      }

      const res = await fetch(endpoint.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
      const responseBody = (await res.text()).slice(0, 500);

      await base44.asServiceRole.entities.WebhookDelivery.update(deliveryRecord.id, {
        status: res.ok ? 'success' : 'failed',
        attemptCount: attempt,
        lastAttemptAt: new Date().toISOString(),
        responseStatus: res.status,
        responseBody
      });

      if (res.ok) return { success: true, attempt };
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err.message;
      await base44.asServiceRole.entities.WebhookDelivery.update(deliveryRecord.id, {
        attemptCount: attempt,
        lastAttemptAt: new Date().toISOString(),
        responseBody: err.message.slice(0, 500)
      });
    }
  }

  // All attempts exhausted
  await base44.asServiceRole.entities.WebhookDelivery.update(deliveryRecord.id, {
    status: 'failed',
    lastAttemptAt: new Date().toISOString()
  });

  return { success: false, error: lastError };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: allow internal system calls (asServiceRole) OR authenticated users
    // External callers without a session are rejected to prevent event injection
    const body = await req.json();
    const { eventType, entityType, entityId, payload } = body;

    // Only allow authenticated users or service-role internal calls
    // (service-role calls come with a system token automatically via createClientFromRequest)
    const isAuthenticated = await base44.auth.isAuthenticated().catch(() => false);
    if (!isAuthenticated) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!eventType || !entityType || !entityId) {
      return Response.json({ error: 'eventType, entityType, entityId required' }, { status: 400 });
    }

    // Store integration event
    const event = await base44.asServiceRole.entities.IntegrationEvent.create({
      eventType,
      entityType,
      entityId,
      payloadJson: JSON.stringify(payload || {}),
      processed: false,
      source: 'internal',
      createdAt: new Date().toISOString()
    });

    // Find active endpoints subscribed to this event type
    const endpoints = await base44.asServiceRole.entities.WebhookEndpoint.filter({ isActive: true });
    const matching = (endpoints || []).filter(ep => {
      if (!ep.eventTypes || ep.eventTypes.length === 0) return false;
      return ep.eventTypes.includes(eventType) || ep.eventTypes.includes('*');
    });

    const results = [];
    for (const ep of matching) {
      const result = await deliverToEndpoint(base44, ep, eventType, {
        eventType,
        entityType,
        entityId,
        payload: payload || {},
        sentAt: new Date().toISOString()
      });
      results.push({ endpointId: ep.id, ...result });
    }

    // Mark event as processed
    await base44.asServiceRole.entities.IntegrationEvent.update(event.id, { processed: true });

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'EVENT_DISPATCHED',
      performedByUserId: 'system',
      performedByName: 'Integration Bus',
      details: JSON.stringify({ eventType, entityType, entityId, endpointsMatched: matching.length, results })
    });

    return Response.json({ success: true, eventId: event.id, dispatched: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});