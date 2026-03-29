import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin' && user?.role !== 'ADMINISTRATOR') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const checks = [];
  const now = new Date();

  // 1. Expired API keys
  try {
    const apiKeys = await base44.asServiceRole.entities.ApiKey.filter({ isActive: true });
    const expired = apiKeys.filter(k => k.expiresAt && new Date(k.expiresAt) < now);
    const expiringSoon = apiKeys.filter(k => k.expiresAt && new Date(k.expiresAt) > now && (new Date(k.expiresAt) - now) < 7 * 24 * 3600 * 1000);
    checks.push({
      name: 'expired_api_keys',
      status: expired.length > 0 ? 'critical' : expiringSoon.length > 0 ? 'warning' : 'ok',
      message: expired.length > 0 ? `${expired.length} active API key(s) are EXPIRED` : expiringSoon.length > 0 ? `${expiringSoon.length} key(s) expire within 7 days` : `${apiKeys.length} API key(s) valid`,
      items: [...expired.map(k => ({ label: k.label, issue: 'Expired', expiredAt: k.expiresAt })), ...expiringSoon.map(k => ({ label: k.label, issue: 'Expires soon', expiredAt: k.expiresAt }))],
    });
  } catch (e) {
    checks.push({ name: 'expired_api_keys', status: 'warning', message: `Check failed: ${e.message}`, items: [] });
  }

  // 2. Expired ExternalAccessTokens
  try {
    const tokens = await base44.asServiceRole.entities.ExternalAccessToken.filter({ isRevoked: false });
    const expired = tokens.filter(t => t.expiresAt && new Date(t.expiresAt) < now);
    checks.push({
      name: 'expired_external_tokens',
      status: expired.length > 0 ? 'warning' : 'ok',
      message: expired.length > 0 ? `${expired.length} non-revoked external token(s) are expired` : `${tokens.length} external token(s) valid`,
      items: expired.map(t => ({ label: t.tokenType || t.id, issue: 'Expired but not revoked' })),
    });
  } catch (e) {
    checks.push({ name: 'expired_external_tokens', status: 'warning', message: `Check failed: ${e.message}`, items: [] });
  }

  // 3. Webhook endpoints HMAC signing
  try {
    const endpoints = await base44.asServiceRole.entities.WebhookEndpoint.filter({ isActive: true });
    const unsigned = endpoints.filter(e => !e.secret || e.secret.trim() === '');
    checks.push({
      name: 'webhook_endpoints_security',
      status: unsigned.length > 0 ? 'critical' : 'ok',
      message: unsigned.length > 0 ? `${unsigned.length} active webhook endpoint(s) have NO HMAC secret` : endpoints.length === 0 ? 'No active webhook endpoints' : `All ${endpoints.length} endpoint(s) have HMAC signing`,
      items: unsigned.map(e => ({ label: e.url, issue: 'No HMAC secret configured' })),
    });
  } catch (e) {
    checks.push({ name: 'webhook_endpoints_security', status: 'warning', message: `Check failed: ${e.message}`, items: [] });
  }

  // 4. FileAsset visibility — public files with no justification
  try {
    const publicFiles = await base44.asServiceRole.entities.FileAsset.filter({ visibility: 'public', status: 'active' });
    checks.push({
      name: 'file_visibility',
      status: publicFiles.length > 20 ? 'warning' : 'ok',
      message: publicFiles.length > 20 ? `${publicFiles.length} files are public — review needed` : `${publicFiles.length} public file(s) — acceptable`,
      items: publicFiles.length > 20 ? [{ issue: `${publicFiles.length} public files may expose sensitive data` }] : [],
    });
  } catch (e) {
    checks.push({ name: 'file_visibility', status: 'warning', message: `Check failed: ${e.message}`, items: [] });
  }

  // 5. Revoked FileAccessGrants still active
  try {
    const grants = await base44.asServiceRole.entities.FileAccessGrant.list('-created_date', 200);
    const expiredGrants = grants.filter(g => g.expiresAt && new Date(g.expiresAt) < now && !g.revokedAt);
    checks.push({
      name: 'revoked_grants',
      status: expiredGrants.length > 0 ? 'warning' : 'ok',
      message: expiredGrants.length > 0 ? `${expiredGrants.length} expired grant(s) not explicitly revoked` : 'All grants properly managed',
      items: expiredGrants.slice(0, 5).map(g => ({ label: g.id, issue: 'Expired but not revoked' })),
    });
  } catch (e) {
    checks.push({ name: 'revoked_grants', status: 'warning', message: `Check failed: ${e.message}`, items: [] });
  }

  // 6. Integration auth config
  try {
    const integrations = await base44.asServiceRole.entities.Integration.filter({ status: 'active' });
    const missingAuth = integrations.filter(i => i.authType !== 'none' && !i.configJson);
    checks.push({
      name: 'integration_auth_config',
      status: missingAuth.length > 0 ? 'critical' : 'ok',
      message: missingAuth.length > 0 ? `${missingAuth.length} active integration(s) missing auth config` : `${integrations.length} integration(s) properly configured`,
      items: missingAuth.map(i => ({ label: i.name, issue: `authType=${i.authType} but no configJson` })),
    });
  } catch (e) {
    checks.push({ name: 'integration_auth_config', status: 'warning', message: `Check failed: ${e.message}`, items: [] });
  }

  const criticalCount = checks.filter(c => c.status === 'critical').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;

  return Response.json({
    success: true,
    auditedAt: now.toISOString(),
    overallStatus: criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'ok',
    criticalCount,
    warningCount,
    checks,
  });
});