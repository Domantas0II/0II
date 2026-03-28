import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function FileUploadForm({ context, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'other',
    assetType: 'document',
    visibility: 'internal',
    isPrimary: false,
    file: null
  });

  const CATEGORIES = [
    'project_general', 'project_legal', 'project_marketing',
    'unit_gallery', 'unit_floorplan', 'unit_technical',
    'reservation_attachment', 'agreement_attachment', 'payment_proof', 'deal_attachment',
    'portal_attachment', 'other'
  ];

  const ASSET_TYPES = ['document', 'image', 'video', 'floorplan', 'contract', 'receipt', 'spreadsheet', 'other'];
  const VISIBILITY_OPTIONS = ['internal', 'customer_safe', 'partner_safe', 'public'];

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        file,
        title: prev.title || file.name.replace(/\.[^/.]+$/, '')
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.file) {
      toast.error('Privaloma pasirinkti failą');
      return;
    }

    setLoading(true);

    try {
      // Upload file via Base44 integration
      const uploadRes = await base44.integrations.Core.UploadFile({
        file: formData.file
      });

      if (!uploadRes.file_url) {
        throw new Error('File upload failed');
      }

      // Create FileAsset
      const response = await base44.functions.invoke('createFileAsset', {
        fileName: formData.file.name,
        originalFileName: formData.file.name,
        mimeType: formData.file.type || 'application/octet-stream',
        fileSizeBytes: formData.file.size,
        fileUrl: uploadRes.file_url,
        assetType: formData.assetType,
        visibility: formData.visibility,
        category: formData.category,
        title: formData.title,
        description: formData.description,
        isPrimary: formData.isPrimary,
        ...context
      });

      if (response.data?.success) {
        toast.success('Failas sėkmingai atsisiųstas');
        onSuccess?.(response.data.fileAsset);
      } else {
        throw new Error(response.data?.error || 'Upload failed');
      }
    } catch (error) {
      toast.error(`Klaida: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Atsisiųsti failą</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File input */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <label className="flex flex-col items-center gap-2 cursor-pointer">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">
                {formData.file ? formData.file.name : 'Pasirinkite failą'}
              </span>
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                disabled={loading}
              />
            </label>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-medium mb-1 block">Pavadinimas</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Failo pavadinimas"
              disabled={loading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium mb-1 block">Aprašymas (optional)</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Krūva aprašymas"
              className="h-20"
              disabled={loading}
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-medium mb-1 block">Kategorija</label>
            <Select value={formData.category} onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}>
              <SelectTrigger disabled={loading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Asset Type */}
          <div>
            <label className="text-xs font-medium mb-1 block">Failo tipas</label>
            <Select value={formData.assetType} onValueChange={(v) => setFormData(prev => ({ ...prev, assetType: v }))}>
              <SelectTrigger disabled={loading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Visibility */}
          <div>
            <label className="text-xs font-medium mb-1 block">Prieiga</label>
            <Select value={formData.visibility} onValueChange={(v) => setFormData(prev => ({ ...prev, visibility: v }))}>
              <SelectTrigger disabled={loading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map(vis => (
                  <SelectItem key={vis} value={vis}>{vis}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Primary checkbox */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isPrimary}
              onChange={(e) => setFormData(prev => ({ ...prev, isPrimary: e.target.checked }))}
              disabled={loading}
              className="w-4 h-4 rounded"
            />
            <span className="text-xs">Pagrindinė reprezentacinė media</span>
          </label>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              Atšaukti
            </Button>
            <Button disabled={!formData.file || loading} className="gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Atsisiųsti
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}