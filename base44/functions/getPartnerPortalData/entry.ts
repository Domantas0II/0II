import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { token } = await req.json();

    if (!token) {
      return Response.json({ error: 'Token required' }, { status: 400 });
    }

    // Validate token - consistent with validateExternalAccessToken
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

    // Fetch partner
    const partners = await base44.asServiceRole.entities.Partner.filter({
      id: tokenRecord.partnerId
    });

    if (!partners || partners.length === 0) {
      return Response.json({ error: 'Partner not found' }, { status: 404 });
    }

    const partner = partners[0];

    // Safe partner projection
    const safePartner = {
      id: partner.id,
      companyName: partner.companyName,
      contactName: partner.contactName,
      email: partner.email,
      phone: partner.phone,
      status: partner.status,
      assignedProjectIds: partner.assignedProjectIds || []
    };

    // Fetch partner's assigned projects
    const projects = await base44.asServiceRole.entities.Project.filter({
      id: { $in: safePartner.assignedProjectIds }
    });

    const safeProjects = (projects || []).map(p => ({
      id: p.id,
      projectName: p.projectName,
      projectCode: p.projectCode,
      projectType: p.projectType,
      city: p.city,
      district: p.district,
      publicTitle: p.publicTitle,
      publicDescription: p.publicDescription,
      publicImages: p.publicImages
    }));

    // Fetch partner leads
    const leads = await base44.asServiceRole.entities.PartnerLead.filter({
      partnerId: tokenRecord.partnerId
    });

    const safeLeads = (leads || []).map(l => ({
      id: l.id,
      projectId: l.projectId,
      fullName: l.fullName,
      email: l.email,
      phone: l.phone,
      status: l.status,
      submittedAt: l.submittedAt,
      convertedAt: l.convertedAt
    }));

    // Fetch unit inventory summary for assigned projects
    const unitsByProject = {};
    for (const projectId of safePartner.assignedProjectIds) {
      const units = await base44.asServiceRole.entities.SaleUnit.filter({
        projectId,
        internalStatus: 'available'
      });

      unitsByProject[projectId] = {
        available: units?.length || 0,
        total: await base44.asServiceRole.entities.SaleUnit.filter({
          projectId
        }).then(all => all?.length || 0)
      };
    }

    // Update lastUsedAt
    await base44.asServiceRole.entities.ExternalAccessToken.update(tokenRecord.id, {
      lastUsedAt: new Date().toISOString()
    });

    // Log portal access
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'PARTNER_PORTAL_ACCESSED',
      targetUserId: null,
      details: JSON.stringify({
        tokenId: tokenRecord.id,
        partnerId: tokenRecord.partnerId
      })
    });

    return Response.json({
      success: true,
      partner: safePartner,
      projects: safeProjects,
      leads: safeLeads,
      inventorySummary: unitsByProject,
      message: 'Safe partner portal data - internal CRM fields excluded'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});