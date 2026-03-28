import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Plus } from 'lucide-react';
import { normalizeRole, canManageProjects } from '@/lib/constants';
import { useQuery } from '@tanstack/react-query';

const IMPORT_TYPES = [
  { id: 'units', label: 'Importuoti Objektus', icon: '📦' },
  { id: 'components', label: 'Importuoti Dedamąsias', icon: '🔧' },
  { id: 'bulk_price', label: 'Masinis Kainų Atnaujinimas', icon: '💰' },
  { id: 'bulk_status', label: 'Masinis Statusų Keitimas', icon: '🔄' },
  { id: 'bulk_publish', label: 'Masinis Publish/Unpublish', icon: '🌐' }
];

export default function ImportHub() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  const role = normalizeRole(user?.role);
  const canAccess = role === 'ADMINISTRATOR' || role === 'SALES_MANAGER';

  // Fetch projects: ADMIN gets all, MANAGER gets only assigned
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', user?.id, role],
    queryFn: async () => {
      if (role === 'ADMINISTRATOR') {
        // Admin: fetch all projects
        return await base44.entities.Project.list('-created_date', 100);
      } else {
        // Manager: fetch only assigned projects via UserProjectAssignment
        const assignments = await base44.entities.UserProjectAssignment.filter({
          userId: user.id,
          removedAt: null
        });
        if (!assignments || assignments.length === 0) return [];
        const projectIds = assignments.map(a => a.projectId);
        const allProjects = await base44.entities.Project.filter({});
        return allProjects.filter(p => projectIds.includes(p.id));
      }
    },
    enabled: !!user?.id && canAccess
  });

  if (!canAccess) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Šiam veiksmui reikalingas ADMINISTRATOR arba SALES_MANAGER statusas</p>
      </div>
    );
  }

  const handleNext = () => {
    if (selectedType && selectedProject) {
      navigate(`/import/upload?type=${selectedType}&projectId=${selectedProject}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import & Bulk Operations</h1>
        <p className="text-sm text-muted-foreground mt-1">Saugūs masinių duomenų veiksmai su preview ir validacija</p>
      </div>

      {/* Step 1: Select Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Pasirinkite import tipą</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {IMPORT_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`p-4 border rounded-lg text-left transition ${
                  selectedType === type.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <p className="text-2xl mb-2">{type.icon}</p>
                <p className="font-medium text-sm">{type.label}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Select Project */}
      {selectedType && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Pasirinkite projektą</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {projects.map(proj => (
                <button
                  key={proj.id}
                  onClick={() => setSelectedProject(proj.id)}
                  className={`w-full p-3 border rounded-lg text-left transition ${
                    selectedProject === proj.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="font-medium text-sm">{proj.projectName}</p>
                  <p className="text-xs text-muted-foreground">{proj.projectCode}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Action */}
      {selectedType && selectedProject && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Pradėti import</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={handleNext} className="gap-2 w-full">
              <Upload className="h-4 w-4" /> Tęsti prie failo įkėlimo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Import Istorija
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="gap-2" onClick={() => navigate('/import/history')}>
            <Plus className="h-4 w-4" /> Peržiūrėti importų istoriją
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}