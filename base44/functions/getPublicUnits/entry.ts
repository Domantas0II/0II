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

    // Public endpoint - no auth required
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');

    if (!projectId) {
      return Response.json({ error: 'projectId required' }, { status: 400 });
    }

    // Fetch project (verify it's public AND published)
    const projects = await base44.entities.Project.filter({ id: projectId });
    if (!projects || projects.length === 0) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projects[0];
    if (!project.isPublic || project.publicStatus !== 'published') {
      return Response.json({ error: 'Project not found or not public' }, { status: 404 });
    }

    // GOVERNANCE: Read limit from SystemLimit
    const limit = await getSystemLimit('portal.publicUnitsLimit', 100, base44);

    // Fetch public units
    const units = await base44.entities.SaleUnit.filter(
      {
        projectId: projectId,
        isPublic: true,
        internalStatus: 'available'
      },
      'label',
      limit
    );

    // Filter out internal fields
    const publicUnits = units.map(u => ({
      id: u.id,
      projectId: u.projectId,
      label: u.label,
      type: u.type,
      areaM2: u.areaM2,
      price: u.publicPrice || u.price,
      pricePerM2: u.pricePerM2,
      roomsCount: u.roomsCount,
      bathroomsCount: u.bathroomsCount,
      floor: u.floor,
      buildingName: u.buildingName,
      sectionName: u.sectionName,
      phaseName: u.phaseName,
      installationStatus: u.installationStatus,
      energyClass: u.energyClass,
      constructionYear: u.constructionYear,
      hasBalcony: u.hasBalcony,
      hasTerrace: u.hasTerrace,
      hasGarage: u.hasGarage,
      windowDirections: u.windowDirections || [],
      publicComment: u.publicComment,
      publicDescription: u.publicDescription,
      publicImages: u.publicImages || [],
      cardVisualAssetId: u.cardVisualAssetId,
      created_date: u.created_date
    }));

    return Response.json({ units: publicUnits });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});