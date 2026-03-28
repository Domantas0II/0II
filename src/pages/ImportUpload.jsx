import React, { useState } from 'react';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse'; // CSV parsing library

export default function ImportUpload() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const importType = searchParams.get('type');
  const projectId = searchParams.get('projectId');

  if (!importType || !projectId) {
    navigate('/import');
    return null;
  }

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.endsWith('.csv') && !selected.name.endsWith('.xlsx')) {
        toast.error('Leisti tik CSV arba XLSX failai');
        return;
      }
      setFile(selected);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Pasirinkite failą');
      return;
    }

    setLoading(true);
    try {
      // Parse CSV
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true });
      const rows = parsed.data.filter(r => Object.values(r).some(v => v));

      if (rows.length === 0) {
        toast.error('Failas neturi duomenų');
        return;
      }

      // Create ImportSession
      const session = await base44.entities.ImportSession.create({
        importType,
        projectId,
        fileName: file.name,
        status: 'uploaded',
        rowCount: rows.length,
        createdByUserId: user.id,
        createdByName: user.full_name
      });

      // Navigate to mapping
      navigate(`/import/mapping?sessionId=${session.id}&type=${importType}`);
    } catch (error) {
      toast.error('Klaida įkeliant failą: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/import')}>← Grįžti</Button>

      <Card>
        <CardHeader>
          <CardTitle>Įkelti failą</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
              id="fileInput"
            />
            <label htmlFor="fileInput" className="cursor-pointer block">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="font-medium text-sm">
                {file ? file.name : 'Spustelkite arba vilkite CSV/XLSX failą čia'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Leisti tik CSV ir XLSX formatai
              </p>
            </label>
          </div>

          <Button 
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-full gap-2"
          >
            {loading ? 'Kraunasi...' : (
              <>
                <ArrowRight className="h-4 w-4" /> Tęsti prie mapping
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}