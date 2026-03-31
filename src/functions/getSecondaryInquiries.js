/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all secondary inquiries
    const inquiries = await base44.entities.ProjectInquiry.filter({
      marketType: 'secondary'
    });

    // Sort: unassigned first, then by created date
    inquiries.sort((a, b) => {
      if (!a.assignedAgentUserId && b.assignedAgentUserId) return -1;
      if (a.assignedAgentUserId && !b.assignedAgentUserId) return 1;
      return new Date(b.created_date) - new Date(a.created_date);
    });

    return Response.json({ inquiries }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});