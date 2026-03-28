import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (r) => {
  const map = { 'admin': 'ADMINISTRATOR', 'user': 'SALES_AGENT' };
  return map[r] || r;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = normalizeRole(user.role);

    // Only admin/manager can convert partner leads
    if (role !== 'ADMINISTRATOR' && role !== 'SALES_MANAGER') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { partnerLeadId, action } = await req.json();

    if (!partnerLeadId || !action) {
      return Response.json({
        error: 'partnerLeadId and action required'
      }, { status: 400 });
    }

    if (!['convert', 'reject', 'duplicate'].includes(action)) {
      return Response.json({
        error: 'Invalid action (convert, reject, duplicate)'
      }, { status: 400 });
    }

    // Fetch lead
    const leads = await base44.entities.PartnerLead.filter({
      id: partnerLeadId
    });

    if (!leads || leads.length === 0) {
      return Response.json({ error: 'Lead not found' }, { status: 404 });
    }

    const lead = leads[0];

    // Check if already converted
    if (lead.status === 'converted') {
      return Response.json({
        error: 'Lead already converted'
      }, { status: 400 });
    }

    if (action === 'convert') {
      // Create or update client from partner lead
      let clientId = null;

      // Check if client with this email already exists
      const existing = await base44.entities.Client.filter({
        email: lead.email
      });

      if (existing && existing.length > 0) {
        clientId = existing[0].id;
      } else {
        // Create new client
        const newClient = await base44.entities.Client.create({
          fullName: lead.fullName,
          email: lead.email,
          phone: lead.phone || null,
          createdByUserId: user.id
        });
        clientId = newClient.id;
      }

      // Create project inquiry
      const inquiry = await base44.entities.ProjectInquiry.create({
        projectId: lead.projectId,
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone || null,
        message: lead.message || `Partner lead from ${lead.partnerId}`,
        status: 'contacted',
        convertedClientId: clientId
      });

      // Update partner lead status
      await base44.entities.PartnerLead.update(partnerLeadId, {
        status: 'converted',
        convertedAt: new Date().toISOString(),
        createdClientId: clientId,
        createdInquiryId: inquiry.id
      });

      // Log audit
      await base44.entities.AuditLog.create({
        action: 'PARTNER_LEAD_CONVERTED',
        performedByUserId: user.id,
        performedByName: user.full_name,
        details: JSON.stringify({
          partnerLeadId,
          createdClientId: clientId,
          createdInquiryId: inquiry.id
        })
      });

      return Response.json({
        success: true,
        action: 'converted',
        clientId,
        inquiryId: inquiry.id
      });
    } else {
      // Reject or mark as duplicate
      const newStatus = action === 'duplicate' ? 'duplicate' : 'rejected';

      await base44.entities.PartnerLead.update(partnerLeadId, {
        status: newStatus
      });

      // Log audit
      await base44.entities.AuditLog.create({
        action: `PARTNER_LEAD_${newStatus.toUpperCase()}`,
        performedByUserId: user.id,
        performedByName: user.full_name,
        details: JSON.stringify({
          partnerLeadId,
          reason: action
        })
      });

      return Response.json({
        success: true,
        action: newStatus
      });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});