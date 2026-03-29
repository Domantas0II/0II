import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function hashKey(rawKey) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(rawKey));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { rawKey, requiredScope } = await req.json();
    if (!rawKey) return Response.json({ error: 'rawKey required' }, { status: 400 });

    const hash = await hashKey(rawKey);

    // Find matching active key by hash
    const keys = await base44.asServiceRole.entities.ApiKey.filter({ keyHash: hash, isActive: true });
    if (!keys?.length) {
      return Response.json({ valid: false, reason: 'key_not_found' }, { status: 401 });
    }
    const apiKey = keys[0];

    // Expiry check
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      await base44.asServiceRole.entities.ApiKey.update(apiKey.id, { isActive: false });
      return Response.json({ valid: false, reason: 'key_expired' }, { status: 401 });
    }

    // Scope check
    if (requiredScope) {
      const scopeHierarchy = { internal: 3, partner: 2, public: 1 };
      const keyLevel = scopeHierarchy[apiKey.scope] || 0;
      const requiredLevel = scopeHierarchy[requiredScope] || 0;
      if (keyLevel < requiredLevel) {
        return Response.json({ valid: false, reason: 'insufficient_scope' }, { status: 403 });
      }
    }

    // Update lastUsedAt (non-blocking)
    base44.asServiceRole.entities.ApiKey.update(apiKey.id, {
      lastUsedAt: new Date().toISOString()
    }).catch(() => {});

    return Response.json({
      valid: true,
      keyId: apiKey.id,
      label: apiKey.label,
      scope: apiKey.scope
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});