import React, { useState, useEffect } from 'react';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';

const COLUMN_HINTS = {
  units: ['label', 'type', 'areaM2', 'price', 'roomsCount', 'bathroomsCount', 'floor', 'buildingName'],
  components: ['type', 'label', 'includedInPrice', 'price', 'status'],
  bulk_price: ['label', 'newPrice'],
  bulk_status: ['label', 'newStatus'],
  bulk_publish: ['label', 'action']
};

export default function ImportMapping() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const sessionId = searchParams.get('sessionId');
  const importType = searchParams.get('type');

  const [session, setSession] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const sessions = await base44.entities.ImportSession.filter({ id: sessionId });
        if (sessions?.[0]) {
          const sess = sessions[0];
          setSession(sess);

          // Parse file from preview if available, otherwise re-read
          if (sess.previewJson) {
            const preview = JSON.parse(sess.previewJson);
            setFileData(preview.rows || []);
            setMapping(JSON.parse(sess.mappingJson || '{}'));
          }
        }
      } catch (error) {
        toast.error('Klaida kraunant sessiją');
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, [sessionId]);

  const columnOptions = fileData?.[0] ? Object.keys(fileData[0]) : [];
  const requiredFields = COLUMN_HINTS[importType] || [];

  const handleMappingChange = (field, column) => {
    setMapping(prev => ({ ...prev, [field]: column }));
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const response = await base44.functions.invoke('parseImportFile', {
        importType,
        projectId: session.projectId,
        rows: fileData,
        mapping
      });

      if (!response.data || !response.data.success) {
        toast.error('Validacijos klaida: ' + (response.data?.error || 'Unknown error'));
        return;
      }

      // Save validation results to session
      await base44.entities.ImportSession.update(sessionId, {
        status: 'validated',
        validRowCount: response.data.validRowCount,
        invalidRowCount: response.data.invalidRowCount,
        previewJson: JSON.stringify({
          validRows: response.data.validRows || [],
          invalidRows: response.data.invalidRows || []
        }),
        errorsJson: JSON.stringify(response.data.invalidRows || []),
        mappingJson: JSON.stringify(mapping)
      });

      navigate(`/import/preview?sessionId=${sessionId}&type=${importType}`);
    } catch (error) {
      toast.error('Validacijos klaida: ' + error.message);
    } finally {
      setValidating(false);
    }
  };

  if (loading) return <div className="text-center py-10">Kraunasi...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => navigate('/import')}>← Hub</Button>
        <h1 className="text-2xl font-bold">Column Mapping</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suderininkite failo stulpelius su sistemoje laukais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {requiredFields.map(field => (
            <div key={field}>
              <label className="text-sm font-medium">{field}</label>
              <Select value={mapping[field] || ''} onValueChange={val => handleMappingChange(field, val)}>
                <SelectTrigger>
                  <SelectValue placeholder={`Pasirinkite stulpelį dėl ${field}`} />
                </SelectTrigger>
                <SelectContent>
                  {columnOptions.map(col => (
                    <SelectItem key={col} value={col}>{col}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          <Button
            onClick={handleValidate}
            disabled={validating || requiredFields.some(f => !mapping[f])}
            className="w-full gap-2"
          >
            {validating ? 'Validuojam...' : (
              <>
                <ArrowRight className="h-4 w-4" /> Validuoti ir pereiti prie preview
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Data Sample */}
      {fileData && fileData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Failo duomenų pavyzdys</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {columnOptions.slice(0, 5).map(col => (
                      <th key={col} className="p-2 text-left font-medium">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fileData.slice(0, 3).map((row, idx) => (
                    <tr key={idx} className="border-b">
                      {columnOptions.slice(0, 5).map(col => (
                        <td key={col} className="p-2 text-xs">{String(row[col] || '').substring(0, 20)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}