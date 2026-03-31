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

    // Create SecondaryObject
    const secondaryObject = await base44.entities.SecondaryObject.create({
      title: inq.propertyAddress || 'Unnamed Property',
      address: inq.propertyAddress || '',
      city: inq.city || '',
      district: inq.district || '',
      propertyType: inq.propertyType || 'apartment',
      rooms: inq.rooms || 0,
      area: inq.area || 0,
      floor: inq.floor || 0,
      price: inq.estimatedPrice || 0,
      status: 'available',
      assignedAgentUserId,
      sellerClientId: clientId,
      marketType: 'secondary',
      serviceType: 'sale',
      commissionType: 'percentage',
      commissionPercent: 5,
      vatMode: 'without_vat',
      isActive: true,
      sourceType: 'inquiry',
      createdByUserId: user.id
    });

    // Mark inquiry as converted
    await base44.entities.ProjectInquiry.update(inquiryId, {
      status: 'converted',
      relatedEntityType: 'SecondaryObject',
      relatedEntityId: secondaryObject.id
    });

    await base44.entities.AuditLog.create({
      action: 'SECONDARY_SELLER_CONVERTED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({ inquiryId, secondaryObjectId: secondaryObject.id })
    });

    return Response.json({ secondaryObject }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});