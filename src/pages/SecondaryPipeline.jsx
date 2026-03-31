import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import SecondaryPipelineBoard from '@/components/secondary/SecondaryPipelineBoard';
import SecondaryPipelineList from '@/components/secondary/SecondaryPipelineList';

export default function SecondaryPipeline() {
  const [pipelineType, setPipelineType] = useState('objects');
  const [viewMode, setViewMode] = useState('board');
  const isMobile = useIsMobile();

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 50)
  });

  const { data: objects = [], isLoading: objectsLoading } = useQuery({
    queryKey: ['secondary-pipeline-objects', pipelineType],
    queryFn: () => base44.functions.invoke('getSecondaryPipelineObjects', {}).then(r => r.data),
    enabled: pipelineType === 'objects'
  });

  const { data: buyers = [], isLoading: buyersLoading } = useQuery({
    queryKey: ['secondary-pipeline-buyers', pipelineType],
    queryFn: () => base44.functions.invoke('getSecondaryPipelineBuyers', {}).then(r => r.data),
    enabled: pipelineType === 'buyers'
  });

  const isLoading = objectsLoading || buyersLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold">Secondary Pipeline</h1>
        <div className="flex gap-2 items-center">
          <Select value={pipelineType} onValueChange={setPipelineType}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="objects">Objektai (Pardavimas)</SelectItem>
              <SelectItem value="buyers">Pirkėjai (Paieška)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!isMobile && (
        <Tabs value={viewMode} onValueChange={setViewMode}>
          <TabsList>
            <TabsTrigger value="board">Lenta (Drag & Drop)</TabsTrigger>
            <TabsTrigger value="list">Sąrašas</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-40 bg-secondary animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {viewMode === 'board' || isMobile ? (
            <SecondaryPipelineBoard
              pipelineType={pipelineType}
              data={pipelineType === 'objects' ? objects : buyers}
              currentUser={currentUser}
            />
          ) : (
            <SecondaryPipelineList
              pipelineType={pipelineType}
              data={pipelineType === 'objects' ? objects : buyers}
            />
          )}
        </>
      )}
    </div>
  );
}