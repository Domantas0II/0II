import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PublishUnitControl({ unit, project, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canPublish = unit.internalStatus === 'available' && project?.isPublic;

  const handlePublish = async () => {
    setLoading(true);
    setError('');
    try {
      await base44.functions.invoke('publishUnit', { unitId: unit.id });
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setLoading(false);
  };

  const handleUnpublish = async () => {
    setLoading(true);
    setError('');
    try {
      await base44.functions.invoke('unpublishUnit', { unitId: unit.id });
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setLoading(false);
  };

  const statusLabel = {
    available: 'Laisva',
    reserved: 'Rezervuota',
    sold: 'Parduota',
    withheld: 'Sulaikyta',
    developer_reserved: 'Dėl Projekto'
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Viešo Objekto Valdymas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <p className="text-sm font-medium">Objekto statusas</p>
            <p className="text-xs text-muted-foreground mt-1">
              {statusLabel[unit.internalStatus] || unit.internalStatus}
            </p>
          </div>
          <span className="text-sm font-medium">
            {unit.isPublic ? '✓ Viešas' : '○ Privatus'}
          </span>
        </div>

        {/* Public Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <label className="text-sm font-medium cursor-pointer">
            Publikuoti objektą
          </label>
          <Switch
            checked={unit.isPublic}
            disabled={!canPublish && !unit.isPublic}
            onCheckedChange={(checked) => {
              if (checked) {
                handlePublish();
              } else {
                handleUnpublish();
              }
            }}
          />
        </div>

        {/* Publish/Unpublish Buttons */}
        <div className="flex gap-2">
          {!unit.isPublic ? (
            <Button
              onClick={handlePublish}
              disabled={!canPublish || loading}
              className="flex-1"
            >
              {loading ? 'Publikuojama...' : 'Publikuoti'}
            </Button>
          ) : (
            <Button
              onClick={handleUnpublish}
              variant="destructive"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Atšaukiama...' : 'Atšaukti publikavimą'}
            </Button>
          )}
        </div>

        {/* Validation Info */}
        {!canPublish && !unit.isPublic && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-800">
                {unit.internalStatus !== 'available' && (
                  <p>• Objekto statusas turi būti "Laisva"</p>
                )}
                {!project?.isPublic && (
                  <p>• Projektas turi būti publikuotas</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {unit.isPublic && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-green-800">Objektas matomas viešoje portaloje</p>
          </div>
        )}

        {/* Auto-Hide Info */}
        {unit.isPublic && unit.internalStatus !== 'available' && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
            ℹ Objektas automatiškai paslėps, kai statusas pasikeis iš "Laisva"
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}