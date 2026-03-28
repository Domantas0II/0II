import { base44 } from '@/api/base44Client';

export async function validateProjectInquiry(data) {
  // 1. Check projectId exists with targeted query
  if (!data.projectId) {
    throw new Error('Projektas privalomas');
  }

  try {
    const projects = await base44.entities.Project.filter({ id: data.projectId });
    if (!projects || projects.length === 0) {
      throw new Error('Projektas neegzistuoja');
    }
  } catch (err) {
    throw new Error('Projektas neegzistuoja');
  }

  // 2. Check phone OR email exists
  if (!data.phone && !data.email) {
    throw new Error('Telefonas arba el. paštas privalomas');
  }

  // 3. If unitId provided, validate it belongs to the project
  if (data.unitId) {
    try {
      const units = await base44.entities.SaleUnit.filter({ id: data.unitId });
      if (!units || units.length === 0) {
        throw new Error('Objektas neegzistuoja');
      }
      const unit = units[0];
      if (unit.projectId !== data.projectId) {
        throw new Error('Objektas nepriklauso šiam projektui');
      }
    } catch (err) {
      throw new Error(err.message || 'Objektas validacija nepavyko');
    }
  }
}

export async function findDuplicateClient(phone, email) {
  if (!phone && !email) return null;

  try {
    // Try phone first
    if (phone) {
      const byPhone = await base44.entities.Client.filter({ phone });
      if (byPhone && byPhone.length > 0) {
        return byPhone[0];
      }
    }

    // Try email
    if (email) {
      const byEmail = await base44.entities.Client.filter({ email });
      if (byEmail && byEmail.length > 0) {
        return byEmail[0];
      }
    }

    return null;
  } catch (err) {
    console.error('Duplicate client search failed:', err);
    return null;
  }
}