/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inquiryId, clientId, assignedAgentUserId } = await req.json();

    const inquiry = await base44.entities.ProjectInquiry.filter({ id: inquiryId });
    if (!inquiry || inquiry.length === 0) {
      return Response.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    const inq = inquiry[0];

    // Create SecondaryBuyerProfile
    const buyerProfile = await base44.entities.SecondaryBuyerProfile.create({
      clientId,
      assignedAgentUserId,
      marketType: 'secondary',
      city: inq.preferredCity || '',
      district: inq.preferredDistrict || '',
      propertyType: inq.preferredPropertyType || 'apartment',
      rooms: inq.preferredRooms || 0,
      area: inq.preferredArea || 0,
      budgetMin: inq.budgetMin || 0,
      budgetMax: inq.budgetMax || 0,
      condition: 'fully_finished',
      financingStatus: 'self_funded',
      serviceType: 'search',
      commissionType: 'percentage',
      commissionPercent: 3,
      status: 'active',
      createdByUserId: user.id
    });

    // Mark inquiry as converted
    await base44.entities.ProjectInquiry.update(inquiryId, {
      status: 'converted',
      relatedEntityType: 'SecondaryBuyerProfile',
      relatedEntityId: buyerProfile.id
    });

    await base44.entities.AuditLog.create({
      action: 'SECONDARY_BUYER_CONVERTED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({ inquiryId, buyerProfileId: buyerProfile.id })
    });

    return Response.json({ buyerProfile }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});