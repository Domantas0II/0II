import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { token, fullName, email, phone, message, projectId } = await req.json();

    if (!token) {
      return Response.json({ error: 'Token required' }, { status: 400 });
    }

    if (!fullName || !email || !projectId) {
      return Response.json({
        error: 'fullName, email, projectId required'
      }, { status: 400 });
    }

    // Validate token - consistent with other external access functions
    const tokens = await base44.asServiceRole.entities.ExternalAccessToken.filter({
      token
    });

    if (!tokens || tokens.length === 0) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    const tokenRecord = tokens[0];

    // Check status
    if (tokenRecord.status !== 'active') {
      return Response.json({
        error: `Token is ${tokenRecord.status}`
      }, { status: 401 });
    }

    // Check expiry
    if (new Date(tokenRecord.expiresAt) < new Date()) {
      // Mark as expired
      await base44.asServiceRole.entities.ExternalAccessToken.update(tokenRecord.id, {
        status: 'expired'
      });
      return Response.json({ error: 'Token expired' }, { status: 401 });
    }

    // Only partner portal tokens allowed
    if (tokenRecord.accessType !== 'partner_portal') {
      return Response.json({ error: 'Invalid access type' }, { status: 403 });
    }

    if (!tokenRecord.partnerId) {
      return Response.json({ error: 'Token missing partner scope' }, { status: 401 });
    }

    // Verify partner exists and project is in their assignment
    const partners = await base44.asServiceRole.entities.Partner.filter({
      id: tokenRecord.partnerId
    });

    if (!partners || partners.length === 0) {
      return Response.json({ error: 'Partner not found' }, { status: 404 });
    }

    const partner = partners[0];

    // Check if projectId is in partner's assigned list
    if (!partner.assignedProjectIds || !partner.assignedProjectIds.includes(projectId)) {
      return Response.json({
        error: 'Project not assigned to partner'
      }, { status: 403 });
    }

    // Verify project exists
    const projects = await base44.asServiceRole.entities.Project.filter({
      id: projectId
    });

    if (!projects || projects.length === 0) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Update lastUsedAt
    await base44.asServiceRole.entities.ExternalAccessToken.update(tokenRecord.id, {
      lastUsedAt: new Date().toISOString()
    });

    // Create partner lead
    const lead = await base44.asServiceRole.entities.PartnerLead.create({
      partnerId: tokenRecord.partnerId,
      projectId,
      fullName,
      email,
      phone: phone || null,
      message: message || null,
      status: 'submitted',
      submittedAt: new Date().toISOString()
    });

    // Log audit
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'PARTNER_LEAD_SUBMITTED',
      targetUserId: null,
      details: JSON.stringify({
        partnerId: tokenRecord.partnerId,
        leadId: lead.id,
        projectId,
        email,
        fullName
      })
    });

    return Response.json({
      success: true,
      leadId: lead.id,
      status: 'submitted',
      message: 'Lead submitted successfully'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});