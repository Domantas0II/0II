import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Simple in-memory rate limit: track last call timestamps per endpoint
// (resets on cold start — sufficient for basic protection)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

function checkRateLimit(endpointId) {
  const now = Date.now();
  const entry = rateLimitMap.get(endpointId) || { count: 0, windowStart: now };
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(endpointId, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  rateLimitMap.set(endpointId, entry);
  return entry.count <= RATE_LIMIT_MAX;
}

async function verifySignature(secret, body, sigHeader) {
  if (!secret || !sigHeader) return !secret; // no secret = no validation required
  const expected = sigHeader.replace('sha256=', '');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === expected;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Read body ONCE as text first, then parse — avoids stream-consumed bug
    const bodyText = await req.text().catch(() => '{}');
    let body;
    try { body = JSON.parse(bodyText); } catch { body = {}; }

    const epId = body.endpointId;
    const rawPayload = body.payload;

    if (!epId) return Response.json({ error: 'endpointId required' }, { status: 400 });

    // Load endpoint — catch "Object not found" type errors gracefully
    let endpoints;
    try {
      endpoints = await base44.asServiceRole.entities.WebhookEndpoint.filter({ id: epId });
    } catch {
      endpoints = [];
    }
    if (!endpoints?.length) {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'WEBHOOK_REJECTED',
        performedByUserId: 'system',
        performedByName: 'Webhook Handler',
        details: JSON.stringify({ reason: 'endpoint_not_found', endpointId: epId })
      });
      return Response.json({ error: 'Endpoint not found' }, { status: 404 });
    }
    const endpoint = endpoints[0];

    if (!endpoint.isActive) {
      return Response.json({ error: 'Endpoint inactive' }, { status: 403 });
    }

    // Rate limit
    if (!checkRateLimit(epId)) {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'WEBHOOK_REJECTED',
        performedByUserId: 'system',
        performedByName: 'Webhook Handler',
        details: JSON.stringify({ reason: 'rate_limited', endpointId: epId })
      });
      return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Signature validation
    const sigHeader = body.signature || '';
    const payloadString = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload || {});
    const valid = await verifySignature(endpoint.secret, payloadString, sigHeader);
    if (!valid) {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'WEBHOOK_REJECTED',
        performedByUserId: 'system',
        performedByName: 'Webhook Handler',
        details: JSON.stringify({ reason: 'invalid_signature', endpointId: epId })
      });
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse payload
    let parsedPayload;
    try {
      parsedPayload = typeof rawPayload === 'object' ? rawPayload : JSON.parse(rawPayload || '{}');
    } catch {
      parsedPayload = {};
    }

    const eventType = body.eventType || parsedPayload.eventType || 'INBOUND_WEBHOOK';
    const entityType = body.entityType || parsedPayload.entityType || 'external';
    const entityId = body.entityId || parsedPayload.entityId || epId;

    // Create IntegrationEvent
    const event = await base44.asServiceRole.entities.IntegrationEvent.create({
      eventType,
      entityType,
      entityId,
      payloadJson: JSON.stringify(parsedPayload),
      processed: false,
      source: 'inbound_webhook',
      createdAt: new Date().toISOString()
    });

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'WEBHOOK_RECEIVED',
      performedByUserId: 'system',
      performedByName: 'Webhook Handler',
      details: JSON.stringify({ endpointId: epId, eventType, eventId: event.id })
    });

    return Response.json({ success: true, eventId: event.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});