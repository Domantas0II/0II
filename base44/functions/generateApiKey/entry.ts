import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

async function hashKey(rawKey) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(rawKey));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateRawKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return 'ntcrm_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = normalizeRole(user.role);
    if (role !== 'ADMINISTRATOR') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const { label, scope, expiresAt } = await req.json();
    if (!label || !scope) return Response.json({ error: 'label and scope required' }, { status: 400 });
    if (!['internal', 'partner', 'public'].includes(scope)) {
      return Response.json({ error: 'scope must be internal, partner, or public' }, { status: 400 });
    }

    const rawKey = generateRawKey();
    const keyHash = await hashKey(rawKey);

    const apiKey = await base44.asServiceRole.entities.ApiKey.create({
      keyHash,
      label,
      scope,
      isActive: true,
      expiresAt: expiresAt || null,
      createdByUserId: user.id,
      createdAt: new Date().toISOString()
    });

    await base44.asServiceRole.entities.AuditLog.create({
      action: 'API_KEY_GENERATED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({ keyId: apiKey.id, label, scope })
    });

    // Return the raw key ONCE — never stored, never retrievable again
    return Response.json({
      success: true,
      keyId: apiKey.id,
      rawKey, // shown once only
      label,
      scope
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});