import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Palette, Upload, Save, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { canManageBranding } from '@/lib/constants';

export default function BrandingSettings() {
  const { user: currentUser, branding: existingBranding } = useOutletContext() || {};
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    companyName: '',
    appName: '',
    logoUrl: '',
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existingBranding) {
      setForm({
        companyName: existingBranding.companyName || '',
        appName: existingBranding.appName || '',
        logoUrl: existingBranding.logoUrl || '',
      });
    }
  }, [existingBranding]);

  const canManage = canManageBranding(currentUser?.role);

  if (!canManage) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Tik administratoriai gali keisti branding nustatymus</p>
      </div>
    );
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(prev => ({ ...prev, logoUrl: file_url }));
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.companyName || !form.appName) {
      toast.error('Užpildykite visus privalomus laukus');
      return;
    }
    setSaving(true);

    const data = {
      ...form,
      updatedByUserId: currentUser?.id,
      updatedByName: currentUser?.full_name,
    };

    if (existingBranding?.id) {
      await base44.entities.GlobalBranding.update(existingBranding.id, data);
    } else {
      await base44.entities.GlobalBranding.create(data);
    }

    await base44.entities.AuditLog.create({
      action: 'BRANDING_UPDATED',
      performedByUserId: currentUser?.id,
      performedByName: currentUser?.full_name,
      details: JSON.stringify(data),
    });

    queryClient.invalidateQueries({ queryKey: ['globalBranding'] });
    toast.success('Branding nustatymai išsaugoti');
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Branding nustatymai</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Valdykite sistemos išvaizdą ir identitetą
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Logo */}
          <div className="space-y-3">
            <Label>Logotipas</Label>
            <div className="flex items-center gap-4">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" className="h-16 w-16 rounded-xl object-cover border" />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center border border-dashed">
                  <Palette className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div>
                <Button variant="outline" size="sm" className="gap-2 relative" disabled={uploading}>
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? 'Įkeliama...' : 'Įkelti logotipą'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </Button>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG. Rekomenduojama 200x200px</p>
              </div>
            </div>
          </div>

          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName">Įmonės pavadinimas *</Label>
            <Input
              id="companyName"
              value={form.companyName}
              onChange={e => setForm({ ...form, companyName: e.target.value })}
              placeholder="UAB Pavyzdys"
            />
          </div>

          {/* App Name */}
          <div className="space-y-2">
            <Label htmlFor="appName">Aplikacijos pavadinimas *</Label>
            <Input
              id="appName"
              value={form.appName}
              onChange={e => setForm({ ...form, appName: e.target.value })}
              placeholder="NT Sistema"
            />
          </div>

          {/* Preview */}
          {(form.companyName || form.appName || form.logoUrl) && (
            <div className="p-4 rounded-xl bg-primary text-primary-foreground">
              <p className="text-[11px] uppercase tracking-wider opacity-70 mb-2">Peržiūra</p>
              <div className="flex items-center gap-3">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <Palette className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm">{form.appName || 'Aplikacija'}</p>
                  <p className="text-xs opacity-70">{form.companyName || 'Įmonė'}</p>
                </div>
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Saugoma...' : 'Išsaugoti'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}