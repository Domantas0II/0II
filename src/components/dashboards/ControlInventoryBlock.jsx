import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = {
  available: '#10b981',
  reserved: '#f59e0b',
  sold: '#6366f1',
  withheld: '#94a3b8',
};

export default function ControlInventoryBlock({ unitStats }) {
  if (!unitStats) return null;

  const { available = 0, reserved = 0, sold = 0, withheld = 0 } = unitStats;
  const total = available + reserved + sold + withheld;

  const chartData = [
    { name: 'Laisvi', value: available, color: COLORS.available },
    { name: 'Rezervuoti', value: reserved, color: COLORS.reserved },
    { name: 'Parduoti', value: sold, color: COLORS.sold },
    ...(withheld > 0 ? [{ name: 'Užlaikyti', value: withheld, color: COLORS.withheld }] : []),
  ].filter(d => d.value > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Objektų paskirstymas</CardTitle>
          <Link to="/units" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Visi objektai →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Pie */}
          {chartData.length > 0 ? (
            <div className="w-full sm:w-40 h-36 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%" innerRadius={30} outerRadius={60} dataKey="value" paddingAngle={2}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          {/* Summary */}
          <div className="flex-1 grid grid-cols-2 gap-2 w-full">
            <Link to="/units?status=available" className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 transition-colors">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
              <div>
                <p className="text-xs text-green-700">Laisvi</p>
                <p className="text-lg font-bold text-green-800">{available}</p>
              </div>
            </Link>
            <Link to="/units?status=reserved" className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
              <div>
                <p className="text-xs text-amber-700">Rezervuoti</p>
                <p className="text-lg font-bold text-amber-800">{reserved}</p>
              </div>
            </Link>
            <Link to="/units?status=sold" className="flex items-center gap-2 p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0" />
              <div>
                <p className="text-xs text-indigo-700">Parduoti</p>
                <p className="text-lg font-bold text-indigo-800">{sold}</p>
              </div>
            </Link>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Iš viso</p>
                <p className="text-lg font-bold">{total}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}