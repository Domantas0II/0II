import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Archive, History } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const VISIBILITY_COLORS = {
  internal: 'bg-red-100 text-red-800',
  customer_safe: 'bg-blue-100 text-blue-800',
  partner_safe: 'bg-purple-100 text-purple-800',
  public: 'bg-green-100 text-green-800'
};

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  archived: 'bg-yellow-100 text-yellow-800',
  replaced: 'bg-orange-100 text-orange-800'
};

export default function FileCard({ file, onArchive, onReplace, onDelete }) {
  const handleCopyUrl = () => {
    navigator.clipboard.writeText(file.fileUrl);
    toast.success('URL nukopijuota');
  };

  const isPrimary = file.isPrimary ? '⭐ ' : '';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">
              {isPrimary}{file.title || file.fileName}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {file.originalFileName}
            </p>
          </div>
          <div className="flex gap-1">
            <Badge className={VISIBILITY_COLORS[file.visibility]}>
              {file.visibility}
            </Badge>
            <Badge className={STATUS_COLORS[file.status]}>
              {file.status}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">Kategorija:</span> {file.category}
          </div>
          <div>
            <span className="font-medium">Tipas:</span> {file.assetType}
          </div>
          <div>
            <span className="font-medium">Versija:</span> {file.versionNumber || 1}
          </div>
          <div>
            <span className="font-medium">Dydis:</span>{' '}
            {file.fileSizeBytes ? `${(file.fileSizeBytes / 1024).toFixed(1)} KB` : 'N/A'}
          </div>
        </div>

        {/* Description */}
        {file.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {file.description}
          </p>
        )}

        {/* Upload info */}
        <div className="text-xs text-muted-foreground">
          <p>Atsisiųstas: {file.uploadedByName}</p>
          <p>{format(new Date(file.created_date), 'yyyy-MM-dd HH:mm')}</p>
        </div>

        {/* Actions */}
        {file.status !== 'replaced' && (
          <div className="flex gap-1 flex-wrap pt-2 border-t">
            <Button size="sm" variant="ghost" onClick={handleCopyUrl} className="gap-1 h-8 text-xs">
              <Copy className="h-3 w-3" />
              Kopija
            </Button>
            {file.status === 'active' && (
              <>
                <Button size="sm" variant="ghost" onClick={onReplace} className="gap-1 h-8 text-xs">
                  <History className="h-3 w-3" />
                  Pakeisti
                </Button>
                <Button size="sm" variant="ghost" onClick={onArchive} className="gap-1 h-8 text-xs">
                  <Archive className="h-3 w-3" />
                  Archyvuoti
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}