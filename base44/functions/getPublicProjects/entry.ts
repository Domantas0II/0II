import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function getSystemLimit(key, defaultValue, base44) {
  try {
    const limits = await base44.asServiceRole.entities.SystemLimit.filter({ key });
    if (limits && limits.length > 0) return limits[0].value;
  } catch (e) {}
  return defaultValue;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // GOVERNANCE: Read limit from SystemLimit
    const limit = await getSystemLimit('portal.publicProjectsLimit', 50, base44);

    // Public endpoint - no auth required
    // Return only published, public projects (safe data only)
    const projects = await base44.entities.Project.filter(
      {
        isPublic: true,
        publicStatus: 'published'
      },
      '-created_date',
      limit
    );

    // Filter out internal fields
    const publicProjects = projects.map(p => ({
      id: p.id,
      projectName: p.projectName,
      projectCode: p.projectCode,
      projectType: p.projectType,
      city: p.city,
      district: p.district,
      address: p.address,
      developerName: p.developerName,
      publicTitle: p.publicTitle,
      publicDescription: p.publicDescription,
      publicImages: p.publicImages || [],
      created_date: p.created_date
    }));

    return Response.json({ projects: publicProjects });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});