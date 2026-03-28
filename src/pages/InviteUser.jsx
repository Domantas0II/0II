import React, { useState } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, AlertTriangle, Eye, Mail, Shield, FolderOpen, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { ROLE_OPTIONS, PLACEHOLDER_PROJECTS, ROLE_LABELS, CAN_MANAGE_USERS } from '@/lib/constants';
import RoleBadge from '@/components/users/RoleBadge';

export default function InviteUser() {
  const { user: currentUser } = useOutletContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    email: '',
    role: '',
    allProjects: false,
    projectCodes: [],
  });
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => base44.entities.UserInvitation.list(),
  });

  const canManage = CAN_MANAGE_USERS.includes(currentUser?.role);
  if (!canManage) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Neturite teisių kviesti vartotojus</p>
      </div>
    );
  }

  const existingUser = users.find(u => u.email === form.email && u.accountStatus === 'active');
  const pendingInvite = invitations.find(inv => inv.email === form.email && inv.status === 'pending');
  const expiresAt = addDays(new Date(), 3);

  const toggleProject = (code) => {
    setForm(prev => ({
      ...prev,
      projectCodes: prev.projectCodes.includes(code)
        ? prev.projectCodes.filter(c => c !== code)
        : [...prev.projectCodes, code],
    }));
  };

  const isValid = form.email && form.role && !existingUser && !pendingInvite;

  const handleSend = async () => {
    if (!isValid) return;
    setSending(true);

    await base44.entities.UserInvitation.create({
      email: form.email,
      role: form.role,
      allProjects: form.allProjects,
      projectCodes: form.allProjects ? [] : form.projectCodes,
      invitedByUserId: currentUser?.id,
      invitedByName: currentUser?.full_name,
      status: 'pending',
      expiresAt: expiresAt.toISOString(),
    });

    await base44.entities.AuditLog.create({
      action: 'USER_INVITED',
      performedByUserId: currentUser?.id,
      performedByName: currentUser?.full_name,
      targetUserEmail: form.email,
      details: JSON.stringify({ role: form.role, allProjects: form.allProjects }),
    });

    // Send invite email
    await base44.integrations.Core.SendEmail({
      to: form.email,
      subject: 'Pakvietimas prisijungti prie NT sistemos',
      body: `
        <h2>Sveiki!</h2>
        <p>${currentUser?.full_name || 'Administratorius'} pakvietė jus prisijungti prie NT pardavimų sistemos.</p>
        <p><strong>Vaidmuo:</strong> ${ROLE_LABELS[form.role]}</p>
        <p><strong>Galioja iki:</strong> ${format(expiresAt, 'yyyy-MM-dd HH:mm')}</p>
        <p>Prisijunkite prie sistemos naudodami šį el. pašto adresą.</p>
      `,
    });

    queryClient.invalidateQueries({ queryKey: ['invitations'] });
    toast.success('Pakvietimas išsiųstas!');
    setSending(false);
    navigate('/');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Button variant="ghost" asChild className="gap-2 -ml-3">
        <Link to="/"><ArrowLeft className="h-4 w-4" /> Vartotojai</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pakviesti vartotoją</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Pakvietimas galios 3 dienas nuo išsiuntimo
        </p>
      </div>

      {!showPreview ? (
        <Card>
          <CardContent className="p-6 space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">El. pašto adresas</Label>
              <Input
                id="email"
                type="email"
                placeholder="vardas@imone.lt"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
              {existingUser && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Aktyvus vartotojas su šiuo el. paštu jau egzistuoja
                </p>
              )}
              {pendingInvite && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Aktyvus pakvietimas šiam el. paštui jau egzistuoja
                </p>
              )}
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label>Vaidmuo</Label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pasirinkite vaidmenį..." />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* All Projects Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div>
                <p className="text-sm font-medium">Visi projektai</p>
                <p className="text-xs text-muted-foreground">Prieiga prie visų esamų ir būsimų projektų</p>
              </div>
              <Switch
                checked={form.allProjects}
                onCheckedChange={v => setForm({ ...form, allProjects: v })}
              />
            </div>

            {form.allProjects && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-xs">
                  <strong>Dėmesio!</strong> Vartotojas turės prieigą prie VISŲ projektų, įskaitant būsimus.
                </p>
              </div>
            )}

            {/* Project Selection */}
            {!form.allProjects && (
              <div className="space-y-2">
                <Label>Projektai</Label>
                <div className="space-y-2">
                  {PLACEHOLDER_PROJECTS.map(p => (
                    <label key={p.code} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors">
                      <Checkbox
                        checked={form.projectCodes.includes(p.code)}
                        onCheckedChange={() => toggleProject(p.code)}
                      />
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.code}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button onClick={() => setShowPreview(true)} disabled={!isValid} className="w-full gap-2">
                <Eye className="h-4 w-4" /> Peržiūrėti prieš siunčiant
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Preview */
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" /> Pakvietimo peržiūra
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">El. paštas</p>
                  <p className="text-sm font-medium">{form.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Vaidmuo</p>
                  <div className="mt-0.5"><RoleBadge role={form.role} /></div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Projektai</p>
                  {form.allProjects ? (
                    <Badge className="mt-0.5 bg-amber-50 text-amber-700 border-amber-200 border">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Visi projektai
                    </Badge>
                  ) : form.projectCodes.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {form.projectCodes.map(code => {
                        const proj = PLACEHOLDER_PROJECTS.find(p => p.code === code);
                        return <Badge key={code} variant="secondary" className="text-[11px]">{proj?.name || code}</Badge>;
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nepasirinkti</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Galioja iki</p>
                  <p className="text-sm font-medium">{format(expiresAt, 'yyyy-MM-dd HH:mm')}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowPreview(false)} className="flex-1">
                Redaguoti
              </Button>
              <Button onClick={handleSend} disabled={sending} className="flex-1 gap-2">
                <Send className="h-4 w-4" />
                {sending ? 'Siunčiama...' : 'Siųsti pakvietimą'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}