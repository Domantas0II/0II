import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function PartnerPortal() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    message: '',
    projectId: ''
  });

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Token nėra pateiktas');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const response = await base44.functions.invoke('getPartnerPortalData', {
          token
        });

        if (response.data?.success) {
          setData(response.data);
        } else {
          setError(response.data?.error || 'Klaida kraunant duomenis');
        }
      } catch (err) {
        setError('Negaliu prieiti prie portalo: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleSubmitLead = async (e) => {
    e.preventDefault();

    if (!formData.fullName || !formData.email || !formData.projectId) {
      toast.error('Užpildykite reikiamus laukus');
      return;
    }

    setSubmitting(true);
    try {
      const response = await base44.functions.invoke('submitPartnerLead', {
        token,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        message: formData.message,
        projectId: formData.projectId
      });

      if (response.data?.success) {
        toast.success('Vedinio pasiūlymas pateiktas!');
        setFormData({
          fullName: '',
          email: '',
          phone: '',
          message: '',
          projectId: ''
        });
        // Refresh data
        const refreshResponse = await base44.functions.invoke('getPartnerPortalData', {
          token
        });
        if (refreshResponse.data?.success) {
          setData(refreshResponse.data);
        }
      } else {
        toast.error(response.data?.error || 'Klaida pateikiant vedinio pasiūlymą');
      }
    } catch (err) {
      toast.error('Klaida: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getLeadStatusBadge = (status) => {
    const config = {
      new: { variant: 'secondary', label: 'Naujas' },
      submitted: { variant: 'default', label: 'Pateiktas' },
      claimed: { variant: 'default', label: 'Tvirtintas' },
      converted: { variant: 'outline', label: 'Konvertuotas' },
      rejected: { variant: 'destructive', label: 'Atmestas' },
      duplicate: { variant: 'secondary', label: 'Dublikatas' }
    };
    return config[status] || config.new;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Klaida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">Duomenys nerastas</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">{data.partner?.companyName}</h1>
          <p className="text-muted-foreground mt-1">Partnerio Portalis</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setTab('overview')}
            className={`px-4 py-2 text-sm font-medium ${
              tab === 'overview'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground'
            }`}
          >
            Apžvalga
          </button>
          <button
            onClick={() => setTab('projects')}
            className={`px-4 py-2 text-sm font-medium ${
              tab === 'projects'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground'
            }`}
          >
            Projektai
          </button>
          <button
            onClick={() => setTab('leads')}
            className={`px-4 py-2 text-sm font-medium ${
              tab === 'leads'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground'
            }`}
          >
            Vedinio pasiūlymai
          </button>
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Partnerio Informacija</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Kontaktas:</span>
                  <p>{data.partner?.contactName || 'Nenurodyta'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">El. Paštas:</span>
                  <p>{data.partner?.email}</p>
                </div>
                {data.partner?.phone && (
                  <div>
                    <span className="text-muted-foreground">Telefonas:</span>
                    <p>{data.partner?.phone}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Santrauka</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-2xl font-bold">
                      {data.projects?.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Priskirtų projektų</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {data.leads?.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Vedinio pasiūlymai</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {data.leads?.filter(l => l.status === 'converted').length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Konvertuoti</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Projects Tab */}
        {tab === 'projects' && (
          <div className="space-y-4">
            {data.projects?.map(project => (
              <Card key={project.id}>
                <CardHeader>
                  <div className="space-y-2">
                    <CardTitle>{project.projectName}</CardTitle>
                    <p className="text-sm text-muted-foreground">{project.projectCode}</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Vieta:</span>
                    <p>{project.city}, {project.district}</p>
                  </div>
                  {data.inventorySummary?.[project.id] && (
                    <div>
                      <span className="text-muted-foreground">Prieinami objektai:</span>
                      <p>
                        {data.inventorySummary[project.id].available} / {data.inventorySummary[project.id].total}
                      </p>
                    </div>
                  )}
                  {project.publicDescription && (
                    <p className="italic text-muted-foreground">{project.publicDescription}</p>
                  )}
                </CardContent>
              </Card>
            ))}

            {(!data.projects || data.projects.length === 0) && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nėra priskirtų projektų
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Leads Tab */}
        {tab === 'leads' && (
          <div className="space-y-6">
            {/* Submit Lead Form */}
            <Card>
              <CardHeader>
                <CardTitle>Pateikti Naują Vedinio Pasiūlymą</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitLead} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Projektas *</label>
                    <select
                      value={formData.projectId}
                      onChange={(e) =>
                        setFormData({ ...formData, projectId: e.target.value })
                      }
                      className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background text-sm"
                      required
                    >
                      <option value="">-- Pasirinkite projektą --</option>
                      {data.projects?.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.projectName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Vardas *</label>
                    <Input
                      placeholder="Vardo pavardė"
                      value={formData.fullName}
                      onChange={(e) =>
                        setFormData({ ...formData, fullName: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">El. Paštas *</label>
                    <Input
                      type="email"
                      placeholder="el@pastas.lt"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Telefonas</label>
                    <Input
                      placeholder="+370..."
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Žinutė</label>
                    <Textarea
                      placeholder="Vedinio žinutė..."
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      className="h-20"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full"
                  >
                    {submitting ? 'Pateikimas...' : 'Pateikti Pasiūlymą'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Leads List */}
            <div className="space-y-3">
              <h3 className="font-semibold">Mano Vedinio Pasiūlymai</h3>
              {data.leads?.map(lead => (
                <Card key={lead.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{lead.fullName}</p>
                          <p className="text-sm text-muted-foreground">{lead.email}</p>
                        </div>
                        <Badge variant={getLeadStatusBadge(lead.status).variant}>
                          {getLeadStatusBadge(lead.status).label}
                        </Badge>
                      </div>
                      {lead.phone && (
                        <p className="text-sm text-muted-foreground">{lead.phone}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Pateikta: {new Date(lead.submittedAt).toLocaleDateString('lt-LT')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {(!data.leads || data.leads.length === 0) && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nėra vedinio pasiūlymų
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}