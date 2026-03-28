import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { UNIT_STATUS_LABELS, UNIT_TYPE_LABELS } from '@/lib/unitConstants';

export default function UnitFilters({ filters, onChange, projects = [] }) {
  const set = (key, val) => onChange({ ...filters, [key]: val });

  return (
    <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Ieškoti pagal žymę..."
          value={filters.search || ''}
          onChange={e => set('search', e.target.value)}
          className="pl-9 bg-card"
        />
      </div>

      <Select value={filters.project || 'all'} onValueChange={v => set('project', v)}>
        <SelectTrigger className="w-full sm:w-[200px] bg-card">
          <SelectValue placeholder="Visi projektai" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Visi projektai</SelectItem>
          {projects.map(p => (
            <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.type || 'all'} onValueChange={v => set('type', v)}>
        <SelectTrigger className="w-full sm:w-[140px] bg-card">
          <SelectValue placeholder="Tipas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Visi tipai</SelectItem>
          {Object.entries(UNIT_TYPE_LABELS).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.status || 'all'} onValueChange={v => set('status', v)}>
         <SelectTrigger className="w-full sm:w-[150px] bg-card">
           <SelectValue placeholder="Statusas" />
         </SelectTrigger>
         <SelectContent>
           <SelectItem value="all">Visi statusai</SelectItem>
           {Object.entries(UNIT_STATUS_LABELS).map(([k, v]) => (
             <SelectItem key={k} value={k}>{v}</SelectItem>
           ))}
         </SelectContent>
       </Select>

       <Select value={filters.public || 'all'} onValueChange={v => set('public', v)}>
         <SelectTrigger className="w-full sm:w-[150px] bg-card">
           <SelectValue placeholder="Viešumas" />
         </SelectTrigger>
         <SelectContent>
           <SelectItem value="all">Visi</SelectItem>
           <SelectItem value="true">Tik viešas</SelectItem>
           <SelectItem value="false">Tik privatus</SelectItem>
         </SelectContent>
       </Select>
      </div>
      );
      }