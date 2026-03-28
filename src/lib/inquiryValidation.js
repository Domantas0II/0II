import { base44 } from '@/api/base44Client';

export async function validateProjectInquiry(data) {
  // 1. Check projectId exists
  if (!data.projectId) {
    throw new Error('Projektas privalomas');
  }

  const projects = await base44.entities.Project.list();
  if (!projects.find(p => p.id === data.projectId)) {
    throw new Error('Projektas neegzistuoja');
  }

  // 2. Check phone OR email exists
  if (!data.phone && !data.email) {
    throw new Error('Telefonas arba el. paštas privalomas');
  }

  // 3. If unitId provided, validate it belongs to the project
  if (data.unitId) {
    const units = await base44.entities.SaleUnit.list();
    const unit = units.find(u => u.id === data.unitId);
    if (!unit) {
      throw new Error('Objektas neegzistuoja');
    }
    if (unit.projectId !== data.projectId) {
      throw new Error('Objektas nepriklauso šiam projektui');
    }
  }
}

export async function findDuplicateClient(phone, email) {
  if (!phone && !email) return null;

  const clients = await base44.entities.Client.list();
  return clients.find(c => (phone && c.phone === phone) || (email && c.email === email)) || null;
}