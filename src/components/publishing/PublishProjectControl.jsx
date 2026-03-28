import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PublishProjectControl({ project, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canPublish = project.projectLifecycleState === 'published' &&
    project.isActive &&
    project.publicStatus === 'ready';

  const handlePublish = async () => {
    setLoading(true);
    setError('');
    try {
      await base44.functions.invoke('publishProject', { projectId: project.id });
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
      await base44.functions.invoke('unpublishProject', { projectId: project.id });
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setLoading(false);
  };

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    ready: 'bg-blue-100 text-blue-800',
    published: 'bg-green-100 text-green-800'
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Viešo Projekto Valdymas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <p className="text-sm font-medium">Viešo projekto statusas</p>
            <p className="text-xs text-muted-foreground mt-1">
              {project.isPublic ? 'Matomas viešai' : 'Paslėptas'}
            </p>
          </div>
          <Badge className={statusColors[project.publicStatus] || 'bg-gray-100'}>
            {project.publicStatus}
          </Badge>
        </div>

        {/* Public Status */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <label className="text-sm font-medium cursor-pointer">
            Publikuoti projektą
          </label>
          <Switch
            checked={project.isPublic}
            disabled={!canPublish && !project.isPublic}
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
          {!project.isPublic ? (
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
        {!canPublish && !project.isPublic && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-800">
                {project.projectLifecycleState !== 'published' && (
                  <p>• Projekto būsena turi būti "published"</p>
                )}
                {!project.isActive && (
                  <p>• Projektas turi būti aktyvus</p>
                )}
                {project.publicStatus !== 'ready' && (
                  <p>• Projektas turi būti "ready" būsenoje</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {project.isPublic && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-green-800">Projektas matomas viešoje portaloje</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {error}
          </div>
        )}

        {/* Info */}
        <p className="text-xs text-muted-foreground border-t pt-3">
          Publikuojant projektą bus matomi tik viešai pažymėti objektai, kurių statusas "available".
          Vidinė informacija niekada nebus rodoma.
        </p>
      </CardContent>
    </Card>
  );
}