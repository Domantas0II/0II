import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inquiryId, title, address, city, district, propertyType, rooms, area, price, floor, sellerClientId } = await req.json();

    if (!inquiryId || !title || !address || !city || !propertyType || !rooms || !area || !price || !sellerClientId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify inquiry exists
    const inquiry = await base44.entities.ProjectInquiry.get(inquiryId);
    if (!inquiry) {
      return Response.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    // Create SecondaryObject
    const secondaryObject = await base44.entities.SecondaryObject.create({
      marketType: 'secondary',
      title,
      address,
      city,
      district,
      propertyType,
      rooms,
      area,
      floor: floor || null,
      price,
      objectStatus: 'available',
      assignedAgentUserId: user.id,
      sellerClientId,
      sourceType: 'manual',
      isActive: true,
      isExclusive: false,
      serviceType: 'sale',
      commissionType: 'percentage',
      createdByUserId: user.id
    });

    // Update inquiry to mark as secondary
    await base44.entities.ProjectInquiry.update(inquiryId, {
      marketType: 'secondary',
      secondaryLeadType: 'seller'
    });

    // Log audit
    await base44.entities.AuditLog.create({
      action: 'SECONDARY_OBJECT_CREATED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({ objectId: secondaryObject.id, inquiryId })
    });

    return Response.json({ 
      success: true, 
      secondaryObjectId: secondaryObject.id,
      message: 'Secondary object created successfully'
    });
  } catch (error) {
    console.error('convertToSecondaryObject error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});