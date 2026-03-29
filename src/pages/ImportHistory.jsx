import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

const STATUS_COLORS = {
  uploaded: 'bg-gray-100 text-gray-800',
  parsed: 'bg-blue-100 text-blue-800',
  validated: 'bg-blue-100 text-blue-800',
  committed: 'bg-green-100 text-green-800',
  partially_committed: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800'
};

const TYPE_LABELS = {
  units: 'Objektų importas',
  components: 'Dedamųjų importas',
  bulk_price: 'Kainų atnaujinimas',
  bulk_status: 'Statusų keitimas',
  bulk_publish: 'Publish/Unpublish'
};

export default function ImportHistory() {
  const navigate = useNavigate();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['importSessions'],
    queryFn: () => base44.entities.ImportSession.list('-created_date', 100)
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Import Istorija</h1>
        <Button onClick={() => navigate('/import')} className="gap-2">
          <Plus className="h-4 w-4" /> Naujas import
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-10">Kraunasi...</div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nėra importų
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => {
            const errors = session.errorsJson ? JSON.parse(session.errorsJson) : [];
            const isPartiallyCommitted = session.status === 'partially_committed';
            
            return (
              <Card 
                key={session.id} 
                className={`hover:shadow-md transition cursor-pointer ${isPartiallyCommitted ? 'border-amber-200' : ''}`}
                onClick={() => navigate(`/import/preview?sessionId=${session.id}&type=${session.importType}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{TYPE_LABELS[session.importType] || session.importType}</p>
                        <Badge className={STATUS_COLORS[session.status]}>
                          {session.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{session.fileName}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {session.createdByName} · {new Date(session.created_date).toLocaleString('lt-LT')}
                      </p>
                      
                      {/* Show commit errors if any */}
                      {isPartiallyCommitted && errors.length > 0 && (
                        <div className="mt-2 text-xs">
                          <p className="font-medium text-amber-700 mb-1">Commit klaidos:</p>
                          <div className="space-y-0.5 pl-2 border-l border-amber-300">
                            {errors.slice(0, 3).map((err, idx) => (
                              <p key={idx} className="text-amber-600">
                                {err.rowNumber}: {err.error}
                              </p>
                            ))}
                            {errors.length > 3 && (
                              <p className="text-amber-600">ir dar {errors.length - 3} klaidų...</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{session.rowCount} eilučių</p>
                      <p className="text-xs text-green-600">{session.validRowCount} valid</p>
                      <p className="text-xs text-red-600">{session.invalidRowCount} invalid</p>
                      {session.committedRowCount && (
                        <p className="text-xs text-blue-600 mt-1">✓ {session.committedRowCount} committed</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}