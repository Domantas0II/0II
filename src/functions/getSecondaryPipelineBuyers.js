/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all buyer profiles with their status
    const profiles = await base44.asServiceRole.entities.SecondaryBuyerProfile.list('-created_date', 500);

    // Fetch client names for each profile
    const withClientNames = await Promise.all(
      profiles.map(async (profile) => {
        const client = await base44.asServiceRole.entities.Client.filter({ id: profile.clientId });
        return {
          ...profile,
          clientName: client?.[0]?.fullName || 'Unknown',
          stage: profile.status === 'active' ? 'new_buyer' : profile.status === 'paused' ? 'searching' : 'completed',
          phone: client?.[0]?.phone || ''
        };
      })
    );

    return Response.json({ data: withClientNames }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});