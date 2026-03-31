import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      inquiryId, 
      city, 
      district, 
      propertyType, 
      rooms,
      areaMin, 
      areaMax, 
      budgetMin, 
      budgetMax,
      floorPreference,
      conditionPreference,
      parkingNeed,
      deadline,
      financingStatus
    } = await req.json();

    if (!inquiryId || !city || !propertyType || !budgetMin || !budgetMax) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify inquiry exists
    const inquiry = await base44.entities.ProjectInquiry.get(inquiryId);
    if (!inquiry) {
      return Response.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    // Create SecondaryBuyerProfile
    const buyerProfile = await base44.entities.SecondaryBuyerProfile.create({
      marketType: 'secondary',
      clientId: inquiry.clientId,
      assignedAgentUserId: user.id,
      profileStatus: 'active',
      serviceType: 'search',
      city,
      district: district || null,
      propertyType,
      rooms: rooms || null,
      areaMin: areaMin || null,
      areaMax: areaMax || null,
      budgetMin,
      budgetMax,
      floorPreference: floorPreference || null,
      conditionPreference: conditionPreference || null,
      parkingNeed: parkingNeed || false,
      deadline: deadline || null,
      financingStatus: financingStatus || 'ready',
      commissionType: 'percentage',
      isActive: true,
      createdByUserId: user.id
    });

    // Update inquiry to mark as secondary
    await base44.entities.ProjectInquiry.update(inquiryId, {
      marketType: 'secondary',
      secondaryLeadType: 'buyer'
    });

    // Log audit
    await base44.entities.AuditLog.create({
      action: 'SECONDARY_BUYER_PROFILE_CREATED',
      performedByUserId: user.id,
      performedByName: user.full_name,
      details: JSON.stringify({ profileId: buyerProfile.id, inquiryId })
    });

    return Response.json({ 
      success: true, 
      buyerProfileId: buyerProfile.id,
      message: 'Buyer profile created successfully'
    });
  } catch (error) {
    console.error('convertToSecondaryBuyerProfile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});