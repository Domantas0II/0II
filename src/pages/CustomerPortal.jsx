import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function CustomerPortal() {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Token nėra pateiktas');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const response = await base44.functions.invoke('getCustomerPortalData', {
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

  const getStatusBadge = (status) => {
    const config = {
      active: { color: 'bg-green-100 text-green-800', label: 'Aktyvi' },
      released: { color: 'bg-gray-100 text-gray-800', label: 'Atleista' },
      converted: { color: 'bg-blue-100 text-blue-800', label: 'Konvertuota' },
      overdue: { color: 'bg-red-100 text-red-800', label: 'Pasibaigusi' }
    };
    return config[status] || config.active;
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Mano Portalis</h1>
          <p className="text-muted-foreground">Sveiki, {data.client?.fullName}</p>
        </div>

        {/* Client Info */}
        <Card>
          <CardHeader>
            <CardTitle>Kontaktinė Informacija</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">El. Paštas:</span>
              <p>{data.client?.email}</p>
            </div>
            {data.client?.phone && (
              <div>
                <span className="text-muted-foreground">Telefonas:</span>
                <p>{data.client?.phone}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reservations */}
        {data.reservations && data.reservations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Rezervacijos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.reservations.map(res => (
                <div key={res.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className={getStatusBadge(res.status).color}>
                      {getStatusBadge(res.status).label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(res.reservedAt).toLocaleDateString('lt-LT')}
                    </span>
                  </div>
                  {res.expiresAt && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Baigiasi:</span>
                      <p>{new Date(res.expiresAt).toLocaleDateString('lt-LT')}</p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Agreements */}
        {data.agreements && data.agreements.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sutartys</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.agreements.map(agr => (
                <div key={agr.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{agr.agreementType}</span>
                    <Badge variant={agr.status === 'signed' ? 'default' : 'secondary'}>
                      {agr.status === 'signed' ? 'Pasirašyta' : 'Juodraštis'}
                    </Badge>
                  </div>
                  {agr.signedAt && (
                    <p className="text-xs text-muted-foreground">
                      Pasirašyta: {new Date(agr.signedAt).toLocaleDateString('lt-LT')}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Payments */}
        {data.payments && data.payments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Mokėjimai</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.payments.map(pay => (
                  <div key={pay.id} className="flex justify-between items-center text-sm border-b pb-2">
                    <div>
                      <p className="font-medium">{pay.amount.toFixed(2)} €</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(pay.paidAt).toLocaleDateString('lt-LT')}
                      </p>
                    </div>
                    <Badge variant="outline">{pay.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Units */}
        {data.units && data.units.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Objektai</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.units.map(unit => (
                <div key={unit.id} className="border rounded-lg p-3 space-y-2">
                  <p className="font-medium">{unit.label}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>Plotas: {unit.areaM2} m²</div>
                    <div>Kambariai: {unit.roomsCount}</div>
                    <div>Kaina: {unit.price.toFixed(2)} €</div>
                    <div>Vonios: {unit.bathroomsCount}</div>
                  </div>
                  {unit.publicDescription && (
                    <p className="text-xs mt-2">{unit.publicDescription}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {(!data.reservations || data.reservations.length === 0) &&
          (!data.agreements || data.agreements.length === 0) &&
          (!data.payments || data.payments.length === 0) && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">Nėra aktyvių duomenų</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}