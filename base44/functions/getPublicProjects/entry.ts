import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Public endpoint - no auth required
    // Return only published, public projects (safe data only)
    const projects = await base44.entities.Project.filter(
      {
        isPublic: true,
        publicStatus: 'published'
      },
      '-created_date',
      50
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