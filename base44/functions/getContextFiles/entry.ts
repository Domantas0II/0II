import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      projectId,
      unitId,
      reservationId,
      agreementId,
      paymentId,
      dealId,
      clientId,
      category,
      assetType,
      visibility,
      includeArchived
    } = await req.json();

    // Build filter
    const filter = {
      status: includeArchived ? { $in: ['active', 'draft', 'archived'] } : { $in: ['active', 'draft'] }
    };

    // At least one context required
    const contexts = { projectId, unitId, reservationId, agreementId, paymentId, dealId, clientId };
    const hasContext = Object.values(contexts).some(v => v);

    if (!hasContext) {
      return Response.json({ error: 'At least one context required' }, { status: 400 });
    }

    // Apply context filters
    if (projectId) filter.projectId = projectId;
    if (unitId) filter.unitId = unitId;
    if (reservationId) filter.reservationId = reservationId;
    if (agreementId) filter.agreementId = agreementId;
    if (paymentId) filter.paymentId = paymentId;
    if (dealId) filter.dealId = dealId;
    if (clientId) filter.clientId = clientId;

    // Apply optional filters
    if (category) filter.category = category;
    if (assetType) filter.assetType = assetType;
    if (visibility) filter.visibility = visibility;

    // Fetch files
    const files = await base44.entities.FileAsset.filter(
      filter,
      '-created_date',
      100
    );

    // Sort by displayOrder and isPrimary
    const sorted = (files || []).sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return b.isPrimary ? 1 : -1;
      return (a.displayOrder || 0) - (b.displayOrder || 0);
    });

    return Response.json({
      success: true,
      files: sorted,
      count: sorted.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});