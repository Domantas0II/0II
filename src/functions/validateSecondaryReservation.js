/// <reference lib="deno" />
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { marketType, secondaryObjectId, secondaryBuyerProfileId, clientId, projectId, bundleId } = await req.json();

    // Primary market validation
    if (marketType === 'primary') {
      if (!projectId || !bundleId) {
        return Response.json({ 
          valid: false, 
          error: 'Primary reservation requires projectId and bundleId' 
        });
      }
      return Response.json({ valid: true });
    }

    // Secondary market validation
    if (marketType === 'secondary') {
      if (!secondaryObjectId) {
        return Response.json({ 
          valid: false, 
          error: 'Secondary reservation requires secondaryObjectId' 
        });
      }
      if (!secondaryBuyerProfileId && !clientId) {
        return Response.json({ 
          valid: false, 
          error: 'Secondary reservation requires either secondaryBuyerProfileId or clientId' 
        });
      }

      // Verify SecondaryObject exists
      try {
        await base44.entities.SecondaryObject.get(secondaryObjectId);
      } catch {
        return Response.json({ 
          valid: false, 
          error: 'SecondaryObject not found' 
        });
      }

      return Response.json({ valid: true });
    }

    return Response.json({ 
      valid: false, 
      error: 'Invalid marketType' 
    });
  } catch (error) {
    console.error('validateSecondaryReservation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});