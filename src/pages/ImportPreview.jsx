import React, { useState, useEffect } from 'react';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportPreview() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [committing, setCommitting] = useState(false);

  const sessionId = searchParams.get('sessionId');
  const importType = searchParams.get('type');

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const loadSession = async () => {
      try {
        const sessions = await base44.entities.ImportSession.filter({ id: sessionId });
        if (sessions?.[0]) {
          setSession(sessions[0]);
        }
      } catch (error) {
        toast.error('Klaida kraunant sessiją');
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, [sessionId]);

  const handleCommit = async () => {
    setCommitting(true);
    try {
      const preview = JSON.parse(session.previewJson || '{}');
      const response = await base44.functions.invoke('commitImport', {
        importSessionId: sessionId,
        validRows: preview.validRows || [],
        importType
      });

      if (response.data?.success) {
        if (response.data.status === 'committed') {
          toast.success(`Sėkmingai importuota ${response.data.committedCount} eilutės`);
        } else if (response.data.status === 'partially_committed') {
          toast.warning(
            `Dalinai importuota: ${response.data.committedCount}/${response.data.totalRows} eilučių. ` +
            'Žiūrėkite klaidų sąrašą.'
          );
        }
        navigate('/import/history');
      } else {
        toast.error('Commitimo klaida: ' + (response.data?.error || 'Unknown'));
      }
    } catch (error) {
      toast.error('Klaida commitinant: ' + error.message);
    } finally {
      setCommitting(false);
    }
  };

  if (loading) return <div className="text-center py-10">Kraunasi...</div>;
  if (!session) return <div className="text-center py-10">Sesija nerasta</div>;

  const preview = JSON.parse(session.previewJson || '{}');
  const errors = JSON.parse(session.errorsJson || '[]');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => navigate('/import')}>← Hub</Button>
        <h1 className="text-2xl font-bold">Preview & Commit</h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Valid rows</p>
            <p className="text-2xl font-bold text-green-600">{session.validRowCount || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Invalid rows</p>
            <p className="text-2xl font-bold text-destructive">{session.invalidRowCount || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="text-lg font-bold capitalize">{session.status}</p>
          </CardContent>
        </Card>
      </div>

      {/* Valid Data */}
      {preview.validRows?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Valid Data ({preview.validRows.length} eilutės)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {Object.keys(preview.validRows[0] || {}).slice(0, 5).map(key => (
                      <th key={key} className="text-left p-2 font-medium">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.validRows.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="border-b">
                      {Object.entries(row).slice(0, 5).map(([key, val]) => (
                        <td key={key} className="p-2 text-xs">{String(val).substring(0, 30)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.validRows.length > 10 && (
              <p className="text-xs text-muted-foreground mt-2">
                ir dar {preview.validRows.length - 10} eilučių...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Klaidos ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {errors.slice(0, 20).map((err, idx) => (
                <div key={idx} className="p-2 bg-destructive/5 rounded text-sm">
                  <p className="font-medium">Row {err.rowNumber}:</p>
                  {err.errors?.map((e, i) => (
                    <p key={i} className="text-xs text-destructive ml-2">• {e}</p>
                  ))}
                </div>
              ))}
            </div>
            {errors.length > 20 && (
              <p className="text-xs text-muted-foreground mt-2">
                ir dar {errors.length - 20} klaidų...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Commit */}
      {preview.validRows?.length > 0 && (
        <Button
          onClick={handleCommit}
          disabled={committing}
          className="w-full gap-2"
          size="lg"
        >
          {committing ? 'Commitinam...' : (
            <>
              <ArrowRight className="h-4 w-4" /> Commit {preview.validRows.length} eilučių
            </>
          )}
        </Button>
      )}
    </div>
  );
}