import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { ROLE_OPTIONS } from '@/lib/constants';

export default function UsersFilters({ filters, onFilterChange }) {
  const update = (key, value) => onFilterChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Ieškoti pagal vardą arba el. paštą..."
          value={filters.search}
          onChange={e => update('search', e.target.value)}
          className="pl-9 bg-card"
        />
      </div>
      <Select value={filters.role} onValueChange={v => update('role', v)}>
        <SelectTrigger className="w-full sm:w-[180px] bg-card">
          <SelectValue placeholder="Visi vaidmenys" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Visi vaidmenys</SelectItem>
          {ROLE_OPTIONS.map(r => (
            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.status} onValueChange={v => update('status', v)}>
        <SelectTrigger className="w-full sm:w-[160px] bg-card">
          <SelectValue placeholder="Visi statusai" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Visi statusai</SelectItem>
          <SelectItem value="active">Aktyvūs</SelectItem>
          <SelectItem value="disabled">Išjungti</SelectItem>
          <SelectItem value="pending">Laukia pakvietimo</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filters.project} onValueChange={v => update('project', v)}>
        <SelectTrigger className="w-full sm:w-[200px] bg-card">
          <SelectValue placeholder="Visi projektai" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Visi projektai</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}