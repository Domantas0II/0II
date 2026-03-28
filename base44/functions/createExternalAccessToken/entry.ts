import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { crypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts';

const generateSecureToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can create external tokens
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const {
      accessType,
      clientId,
      partnerId,
      projectId,
      reservationId,
      agreementId,
      expiresAt
    } = await req.json();

    if (!accessType || !expiresAt) {
      return Response.json({
        error: 'accessType and expiresAt required'
      }, { status: 400 });
    }

    // Validate accessType
    if (!['customer_portal', 'partner_portal'].includes(accessType)) {
      return Response.json({
        error: 'Invalid accessType'
      }, { status: 400 });
    }

    // Validate scope
    if (accessType === 'customer_portal' && !clientId) {
      return Response.json({
        error: 'clientId required for customer_portal'
      }, { status: 400 });
    }

    if (accessType === 'partner_portal' && !partnerId) {
      return Response.json({
        error: 'partnerId required for partner_portal'
      }, { status: 400 });
    }

    // Verify expiry is in future
    if (new Date(expiresAt) <= new Date()) {
      return Response.json({
        error: 'expiresAt must be in future'
      }, { status: 400 });
    }

    // Verify scope entities exist
    if (clientId) {
      const clients = await base44.entities.Client.filter({ id: clientId });
      if (!clients || clients.length === 0) {
        return Response.json({
          error: 'Client not found'
        }, { status: 404 });
      }
    }

    if (partnerId) {
      const partners = await base44.entities.Partner.filter({ id: partnerId });
      if (!partners || partners.length === 0) {
        return Response.json({
          error: 'Partner not found'
        }, { status: 404 });
      }
    }

    // Generate secure token
    const token = generateSecureToken();

    // Create token record
    const tokenRecord = await base44.entities.ExternalAccessToken.create({
      accessType,
      token,
      status: 'active',
      clientId: clientId || null,
      partnerId: partnerId || null,
      projectId: projectId || null,
      reservationId: reservationId || null,
      agreementId: agreementId || null,
      expiresAt,
      createdByUserId: user.id
    });

    // Log audit
    await base44.entities.AuditLog.create({
      action: 'EXTERNAL_TOKEN_CREATED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({
        tokenId: tokenRecord.id,
        accessType,
        clientId: clientId || null,
        partnerId: partnerId || null
      })
    });

    return Response.json({
      success: true,
      token: tokenRecord.token,
      expiresAt: tokenRecord.expiresAt
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});