import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Settings, Lock } from 'lucide-react';

export default function SystemSettings() {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Check auth
  const [currentUser, setCurrentUser] = useState(null);
  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  if (currentUser && currentUser.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Lock className="h-12 w-12 mx-auto mb-4 text-destructive opacity-50" />
          <h1 className="text-xl font-bold">Prieiga uždrausta</h1>
          <p className="text-sm text-muted-foreground mt-2">Tik administratoriai gali keisti sistemos nustatymus</p>
        </div>
      </div>
    );
  }

  // Fetch data
  const { data: settings = [] } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: () => base44.entities.SystemSetting.list('-updated_date')
  });

  const { data: flags = [] } = useQuery({
    queryKey: ['featureFlags'],
    queryFn: () => base44.entities.FeatureFlag.list('-updated_date')
  });

  const { data: limits = [] } = useQuery({
    queryKey: ['systemLimits'],
    queryFn: () => base44.entities.SystemLimit.list('-updated_date')
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['settingsAuditLogs'],
    queryFn: () => base44.entities.AuditLog.filter({
      action: { $in: ['SYSTEM_SETTING_UPDATED', 'SYSTEM_SETTING_CREATED', 'FEATURE_FLAG_UPDATED', 'FEATURE_FLAG_CREATED'] }
    }, '-created_date', 50)
  });

  // Mutations
  const updateSetting = useMutation({
    mutationFn: ({ id, key, valueJson, description }) =>
      base44.entities.SystemSetting.update(id, { valueJson, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
      base44.functions.invoke('invalidateSettingsCache', {});
      toast.success('Nustatymas atnaujintas');
      setEditingKey(null);
    }
  });

  const createSetting = useMutation({
    mutationFn: ({ key, valueJson, description, category }) =>
      base44.entities.SystemSetting.create({ key, valueJson, description, category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
      toast.success('Nustatymas sukurtas');
    }
  });

  const updateFlag = useMutation({
    mutationFn: ({ id, ...data }) => base44.entities.FeatureFlag.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['featureFlags'] });
      base44.functions.invoke('invalidateSettingsCache', {});
      toast.success('Feature flag atnaujintas');
    }
  });

  const updateLimit = useMutation({
    mutationFn: ({ id, value }) => base44.entities.SystemLimit.update(id, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systemLimits'] });
      base44.functions.invoke('invalidateSettingsCache', {});
      toast.success('Limitas atnaujintas');
    }
  });

  const handleSaveSetting = (setting) => {
    try {
      // Validate JSON
      JSON.parse(editValue);
      updateSetting.mutate({
        id: setting.id,
        key: setting.key,
        valueJson: editValue,
        description: setting.description
      });
    } catch (e) {
      toast.error('Negalioja JSON');
    }
  };

  // Group settings by category
  const settingsByCategory = {
    crm: settings.filter(s => s.category === 'crm'),
    sla: settings.filter(s => s.category === 'sla'),
    scoring: settings.filter(s => s.category === 'scoring'),
    import: settings.filter(s => s.category === 'import'),
    public_portal: settings.filter(s => s.category === 'public_portal'),
    file_management: settings.filter(s => s.category === 'file_management'),
    analytics: settings.filter(s => s.category === 'analytics')
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Sistemos nustatymai</h1>
      </div>

      <Tabs defaultValue="crm" className="space-y-4">
        <TabsList>
          <TabsTrigger value="crm">CRM</TabsTrigger>
          <TabsTrigger value="sla">SLA</TabsTrigger>
          <TabsTrigger value="scoring">Scoring</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="portal">Portal</TabsTrigger>
          <TabsTrigger value="files">Failai</TabsTrigger>
          <TabsTrigger value="flags">Feature Flags</TabsTrigger>
          <TabsTrigger value="limits">Limitai</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* Settings tabs */}
        {['crm', 'sla', 'scoring', 'import', 'public_portal', 'file_management', 'analytics'].map((cat) => (
          <TabsContent key={cat} value={cat === 'public_portal' ? 'portal' : cat === 'file_management' ? 'files' : cat} className="space-y-4">
            {settingsByCategory[cat]?.map(setting => (
              <Card key={setting.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-mono">{setting.key}</CardTitle>
                      <CardDescription>{setting.description}</CardDescription>
                    </div>
                    {setting.isPublic && <Badge variant="secondary">Public</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {editingKey === setting.id ? (
                    <>
                      <Textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="font-mono text-xs h-32"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveSetting(setting)}
                          disabled={updateSetting.isPending}
                        >
                          Išsaugoti
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingKey(null)}
                        >
                          Atšaukti
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <pre className="bg-secondary p-3 rounded text-xs overflow-auto max-h-24">
                        {JSON.stringify(JSON.parse(setting.valueJson), null, 2)}
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingKey(setting.id);
                          setEditValue(setting.valueJson);
                        }}
                      >
                        Redaguoti
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}

        {/* Feature Flags */}
        <TabsContent value="flags" className="space-y-4">
          {flags.map(flag => (
            <Card key={flag.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-mono">{flag.key}</CardTitle>
                    <CardDescription>{flag.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={flag.isEnabled}
                      onCheckedChange={(value) =>
                        updateFlag.mutate({ id: flag.id, isEnabled: value })
                      }
                    />
                    <Badge variant={flag.isEnabled ? 'default' : 'secondary'}>
                      {flag.isEnabled ? 'ON' : 'OFF'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Rollout: </span>
                  <Badge variant="outline">{flag.rolloutType}</Badge>
                </div>
                {flag.rolloutType === 'role_based' && flag.allowedRoles?.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Roles: </span>
                    {flag.allowedRoles.map(r => <Badge key={r} className="ml-1">{r}</Badge>)}
                  </div>
                )}
                {flag.rolloutType === 'percentage' && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Percentage:</span>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={flag.percentage || 0}
                      onChange={(e) =>
                        updateFlag.mutate({ id: flag.id, percentage: parseInt(e.target.value) })
                      }
                      className="w-20"
                    />
                    <span>%</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Limits */}
        <TabsContent value="limits" className="space-y-4">
          {limits.map(limit => (
            <Card key={limit.id}>
              <CardHeader>
                <CardTitle className="text-base font-mono">{limit.key}</CardTitle>
                <CardDescription>{limit.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <Input
                  type="number"
                  value={limit.value}
                  onChange={(e) =>
                    updateLimit.mutate({ id: limit.id, value: parseInt(e.target.value) })
                  }
                  className="w-24"
                />
                <Badge variant="outline">{limit.unit}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Audit Log */}
        <TabsContent value="audit" className="space-y-4">
          <div className="space-y-2">
            {auditLogs?.map(log => (
              <Card key={log.id} className="bg-secondary/30">
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className="mb-2">{log.action}</Badge>
                      <p className="text-sm text-muted-foreground">{log.performedByName}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.created_date).toLocaleString('lt-LT')}
                    </p>
                  </div>
                  {log.details && (
                    <pre className="bg-background p-2 rounded text-xs overflow-auto max-h-20 border">
                      {JSON.stringify(JSON.parse(log.details), null, 2)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}