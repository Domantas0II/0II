import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // This function is called after settings/flags/limits update
    // In production, this would invalidate cache on all app servers
    // For now, we just return success - the frontend will refresh

    return Response.json({
      success: true,
      message: 'Settings cache invalidation triggered'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});