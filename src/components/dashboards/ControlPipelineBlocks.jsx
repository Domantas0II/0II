import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Lead kontaktų etapai
const LEAD_STAGES = [
  { key: 'new_contact',    label: 'Naujas kontaktas',      color: 'bg-blue-500' },
  { key: 'no_answer_1',   label: 'Nekelia',                color: 'bg-slate-400' },
  { key: 'no_answer_2',   label: 'Nekelia x2',             color: 'bg-slate-500' },
  { key: 'no_answer_3',   label: 'Nekelia x3',             color: 'bg-orange-400' },
  { key: 'proposal_sent', label: 'Išsiųstas pasiūlymas',   color: 'bg-cyan-500' },
  { key: 'waiting_response', label: 'Laukiama atsakymo',   color: 'bg-yellow-500' },
  { key: 'follow_up',     label: 'Follow up',              color: 'bg-indigo-500' },
  { key: 'not_relevant',  label: 'Neaktualu',              color: 'bg-red-400' },
];

// Pipeline progreso etapai
const PROGRESS_STAGES = [
  { key: 'consultation_booked', label: 'Sutarta konsultacija', color: 'bg-amber-500' },
  { key: 'viewing_booked',      label: 'Sutarta apžiūra',      color: 'bg-purple-500' },
  { key: 'negotiation',         label: 'Derybos',              color: 'bg-orange-500' },
  { key: 'reservation',         label: 'Rezervacija',          color: 'bg-green-500' },
];

function StageRow({ label, count, color, max }) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
  return (
    <Link to="/pipeline" className="flex items-center gap-3 group hover:bg-muted/50 rounded-md px-2 py-1.5 -mx-2 transition-colors">
      <span className="text-sm text-muted-foreground w-44 truncate group-hover:text-foreground transition-colors">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        {count > 0 && (
          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        )}
      </div>
      <Badge variant={count > 0 ? 'secondary' : 'outline'} className="min-w-[2rem] justify-center text-xs">
        {count}
      </Badge>
    </Link>
  );
}

export default function ControlPipelineBlocks({ interests }) {
  const counts = {};
  (interests || []).forEach(i => {
    const stage = i.pipelineStage || 'new_contact';
    counts[stage] = (counts[stage] || 0) + 1;
  });

  const leadTotal = LEAD_STAGES.reduce((s, st) => s + (counts[st.key] || 0), 0);
  const progressTotal = PROGRESS_STAGES.reduce((s, st) => s + (counts[st.key] || 0), 0);
  const leadMax = Math.max(...LEAD_STAGES.map(st => counts[st.key] || 0), 1);
  const progressMax = Math.max(...PROGRESS_STAGES.map(st => counts[st.key] || 0), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Lead / Kontaktų kontrolė */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Lead / Kontaktų kontrolė</CardTitle>
            <Badge variant="outline" className="text-xs">{leadTotal} viso</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-0.5">
          {leadTotal === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nėra aktyvių lead'ų</p>
          ) : (
            LEAD_STAGES.map(st => (
              <StageRow key={st.key} label={st.label} count={counts[st.key] || 0} color={st.color} max={leadMax} />
            ))
          )}
        </CardContent>
      </Card>

      {/* Pipeline progresas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Pipeline progresas</CardTitle>
            <Badge variant="outline" className="text-xs">{progressTotal} viso</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-0.5">
          {progressTotal === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nėra progreso etapų</p>
          ) : (
            PROGRESS_STAGES.map(st => (
              <StageRow key={st.key} label={st.label} count={counts[st.key] || 0} color={st.color} max={progressMax} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}