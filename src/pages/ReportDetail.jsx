import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Play, Download, FileText, Loader2 } from 'lucide-react';

const TYPE_LABELS = { sales: 'Pardavimai', finance: 'Finansai', pipeline: 'Pipeline', agent_performance: 'Agentų veikla', custom: 'Kitas' };
const TYPE_COLORS = { sales: 'bg-blue-100 text-blue-800', finance: 'bg-green-100 text-green-800', pipeline: 'bg-purple-100 text-purple-800', agent_performance: 'bg-orange-100 text-orange-800' };

function KPICard({ label, value, sub }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function fmtEur(n) { return `€${Number(n || 0).toLocaleString('lt-LT', { minimumFractionDigits: 2 })}`; }
function fmtPct(n) { return `${Number(n || 0).toFixed(1)}%`; }

function SalesSummary({ summary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KPICard label="Sandorių" value={summary.dealsCount} />
      <KPICard label="Bendra vertė" value={fmtEur(summary.totalSalesValue)} />
      <KPICard label="Vidutinis sandoris" value={fmtEur(summary.avgDealValue)} />
      <KPICard label="Konversija" value={fmtPct(summary.conversionRate)} sub={`iš ${summary.totalInquiries} užklausų`} />
    </div>
  );
}

function FinanceSummary({ summary }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <KPICard label="Bendri komisiniai" value={fmtEur(summary.totalCommissions)} />
      <KPICard label="Įmonės komisiniai" value={fmtEur(summary.companyCommissionTotal)} />
      <KPICard label="Vadybininkų išmokos" value={fmtEur(summary.managerPayoutsTotal)} />
      <KPICard label="Išmokėta" value={fmtEur(summary.paidTotal)} sub={`${summary.paidCount} komisiniai`} />
      <KPICard label="Galima išmokėti" value={fmtEur(summary.payableTotal)} sub={`${summary.payableCount} komisiniai`} />
      <KPICard label="Laukia" value={summary.pendingCount} sub="komisiniai" />
    </div>
  );
}

function PipelineSummary({ summary }) {
  const funnel = [
    { label: 'Užklausos', count: summary.inquiriesCount },
    { label: 'Interesai', count: summary.interestsCount },
    { label: 'Rezervacijos', count: summary.reservationsCount },
    { label: 'Sandoriai', count: summary.dealsCount }
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        {funnel.map(f => <KPICard key={f.label} label={f.label} value={f.count} />)}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <KPICard label="Užkl.→Inter." value={fmtPct(summary.inquiriesToInterests)} />
        <KPICard label="Inter.→Rezerv." value={fmtPct(summary.interestsToReservations)} />
        <KPICard label="Rezerv.→Sandor." value={fmtPct(summary.reservationsToDeals)} />
      </div>
    </div>
  );
}

function AgentSummary({ summary }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <KPICard label="Agentų" value={summary.agentsCount} />
      <KPICard label="Viso sandorių" value={summary.totalDeals} />
      <KPICard label="Bendra pajamos" value={fmtEur(summary.totalRevenue)} />
    </div>
  );
}

function DataTable({ rows }) {
  if (!rows?.length) return <p className="text-sm text-muted-foreground">Nėra duomenų</p>;
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b bg-muted/40">
            {cols.map(c => <th key={c} className="px-3 py-2 text-left font-medium text-muted-foreground">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((row, i) => (
            <tr key={i} className="border-b hover:bg-muted/20">
              {cols.map(c => <td key={c} className="px-3 py-1.5">{String(row[c] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 100 && (
        <p className="text-xs text-muted-foreground mt-2 px-3">Rodoma 100 iš {rows.length} eilučių. Eksportuokite pilnam sąrašui.</p>
      )}
    </div>
  );
}

export default function ReportDetail() {
  const { id } = useParams();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [result, setResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [exportLoading, setExportLoading] = useState(null);

  const { data: defs = [] } = useQuery({
    queryKey: ['reportDef', id],
    queryFn: () => base44.entities.ReportDefinition.filter({ id })
  });
  const def = defs[0];

  const { data: executions = [] } = useQuery({
    queryKey: ['executions-for-report', id],
    queryFn: () => base44.entities.ReportExecution.filter({ reportDefinitionId: id }, '-executedAt', 10)
  });

  const handleRun = async () => {
    setIsRunning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('generateReport', {
        reportDefinitionId: id,
        filters: { dateFrom: dateFrom || null, dateTo: dateTo || null }
      });
      if (res.data?.success) {
        setResult(res.data.result);
        toast.success(`Ataskaita sugeneruota: ${res.data.result.rows?.length || 0} eilutės`);
      } else {
        toast.error(res.data?.error || 'Klaida generuojant');
      }
    } catch (e) {
      toast.error(e?.message || 'Klaida');
    } finally {
      setIsRunning(false);
    }
  };

  const handleExport = async (format) => {
    setExportLoading(format);
    try {
      const res = await base44.functions.invoke('exportReport', {
        reportDefinitionId: id,
        format,
        filters: { dateFrom: dateFrom || null, dateTo: dateTo || null }
      });
      if (res.data?.success) {
        window.open(res.data.fileUrl, '_blank');
        toast.success(`${format.toUpperCase()} eksportuotas`);
      } else {
        toast.error(res.data?.error || 'Eksporto klaida');
      }
    } catch (e) {
      toast.error(e?.message || 'Klaida');
    } finally {
      setExportLoading(null);
    }
  };

  if (!def) return <div className="p-8 text-center text-muted-foreground">Kraunama...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/reports"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold">{def.name}</h1>
        <Badge className={TYPE_COLORS[def.type]}>{TYPE_LABELS[def.type]}</Badge>
      </div>

      {/* Filters + Run */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nuo</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Iki</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
            </div>
            <Button onClick={handleRun} disabled={isRunning} className="gap-2">
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {isRunning ? 'Generuojama...' : 'Paleisti'}
            </Button>
            {result && (
              <div className="flex gap-2 ml-auto">
                {['csv', 'xlsx', 'pdf'].map(fmt => (
                  <Button
                    key={fmt}
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => handleExport(fmt)}
                    disabled={exportLoading === fmt}
                  >
                    {exportLoading === fmt ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    {fmt.toUpperCase()}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <>
          {result.type === 'sales' && <SalesSummary summary={result.summary} />}
          {result.type === 'finance' && <FinanceSummary summary={result.summary} />}
          {result.type === 'pipeline' && <PipelineSummary summary={result.summary} />}
          {result.type === 'agent_performance' && <AgentSummary summary={result.summary} />}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Duomenys ({result.rows?.length || 0} eilutės)
              </CardTitle>
            </CardHeader>
            <CardContent><DataTable rows={result.rows} /></CardContent>
          </Card>
        </>
      )}

      {/* Execution history */}
      {executions.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Vykdymo istorija</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {executions.map(e => (
              <div key={e.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                <span className="text-muted-foreground">{new Date(e.executedAt).toLocaleString('lt-LT')}</span>
                <Badge variant={e.status === 'completed' ? 'default' : 'destructive'} className="text-xs">{e.status}</Badge>
                <span className="text-muted-foreground">{e.rowCount || 0} eil.</span>
                <Badge variant="outline" className="text-xs">{e.format || 'json'}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}