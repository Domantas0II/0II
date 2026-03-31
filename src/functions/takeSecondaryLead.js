/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inquiryId } = await req.json();

    await base44.entities.ProjectInquiry.update(inquiryId, {
      assignedAgentUserId: user.id
    });

    await base44.entities.AuditLog.create({
      action: 'SECONDARY_LEAD_TAKEN',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({ inquiryId })
    });

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});