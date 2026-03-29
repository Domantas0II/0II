import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FileUp } from 'lucide-react';
import FileCard from './FileCard';
import FileUploadForm from './FileUploadForm';

const CATEGORIES = [
  'project_general', 'project_legal', 'project_marketing',
  'unit_gallery', 'unit_floorplan', 'unit_technical',
  'reservation_attachment', 'agreement_attachment', 'payment_proof',
  'deal_attachment', 'portal_attachment', 'other'
];

const ASSET_TYPES = ['document', 'image', 'video', 'floorplan', 'contract', 'receipt', 'spreadsheet', 'other'];
const VISIBILITY_OPTIONS = ['internal', 'customer_safe', 'partner_safe', 'public'];

export default function FileLibrary({ context = {} }) {
  const [showUpload, setShowUpload] = useState(false);
  const [filters, setFilters] = useState({
    category: 'all',
    assetType: 'all',
    visibility: 'all',
    status: 'active'
  });
  const queryClient = useQueryClient();

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['fileAssets', context],
    queryFn: async () => {
      const response = await base44.functions.invoke('getContextFiles', {
        ...context,
        includeArchived: filters.status === 'all'
      });
      return response.data?.files || [];
    },
    enabled: Object.values(context).some(v => v)
  });

  const archiveMutation = useMutation({
    mutationFn: (fileId) => base44.functions.invoke('archiveFileAsset', { fileAssetId: fileId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fileAssets'] })
  });

  // Filter files
  const filtered = files.filter(f => {
    if (filters.category !== 'all' && f.category !== filters.category) return false;
    if (filters.assetType !== 'all' && f.assetType !== filters.assetType) return false;
    if (filters.visibility !== 'all' && f.visibility !== filters.visibility) return false;
    if (filters.status !== 'all' && f.status !== filters.status) return false;
    return true;
  });

  if (!Object.values(context).some(v => v)) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Kontekstas reikalingas (projectId, unitId, etc.)
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Failų biblioteka</h3>
          <p className="text-xs text-muted-foreground">{filtered.length} failai</p>
        </div>
        <Button onClick={() => setShowUpload(!showUpload)} size="sm" className="gap-2">
          <FileUp className="h-4 w-4" />
          Atsisiųsti
        </Button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <FileUploadForm
          context={context}
          onSuccess={() => setShowUpload(false)}
          onCancel={() => setShowUpload(false)}
        />
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select value={filters.category} onValueChange={(v) => setFilters(p => ({ ...p, category: v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Kategorija" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visos</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.assetType} onValueChange={(v) => setFilters(p => ({ ...p, assetType: v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Tipas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visi</SelectItem>
                {ASSET_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.visibility} onValueChange={(v) => setFilters(p => ({ ...p, visibility: v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Prieiga" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visos</SelectItem>
                {VISIBILITY_OPTIONS.map(vis => (
                  <SelectItem key={vis} value={vis}>{vis}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={(v) => setFilters(p => ({ ...p, status: v }))}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Statusas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktyvūs</SelectItem>
                <SelectItem value="all">Visi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Files grid */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Kraunasi...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nėra failų
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(file => (
            <FileCard
              key={file.id}
              file={file}
              onArchive={() => archiveMutation.mutate(file.id)}
              onReplace={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}