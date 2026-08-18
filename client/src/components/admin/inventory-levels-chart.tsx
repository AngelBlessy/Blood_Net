import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { BloodGroup, InventoryLevelPoint } from '@/types/domain';

const LOW_STOCK_COLOR = 'var(--destructive)';
const NORMAL_COLOR = 'var(--chart-4)';

export function InventoryLevelsChart({
  data,
  lowStockGroups,
}: {
  data: InventoryLevelPoint[];
  lowStockGroups: BloodGroup[];
}) {
  const { t } = useTranslation();
  const total = data.reduce((sum, point) => sum + point.units, 0);
  const lowSet = new Set(lowStockGroups);

  return (
    <Card className="h-full gap-3 p-6">
      <h2 className="text-lg font-semibold">{t('insightsInventoryTitle')}</h2>
      <p className="-mt-2 text-sm text-muted-foreground">{t('insightsInventoryDesc')}</p>

      {total === 0 ? (
        <EmptyState>{t('insightsInventoryEmpty')}</EmptyState>
      ) : (
        <>
          <div className="min-h-72 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="group" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  allowDecimals={false}
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip
                  cursor={{ fill: 'var(--muted)' }}
                  contentStyle={{
                    background: 'var(--popover)',
                    color: 'var(--popover-foreground)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                  }}
                  formatter={(value) => [value, t('insightsInventoryUnitsLabel')]}
                />
                <Bar dataKey="units" radius={[4, 4, 0, 0]}>
                  {data.map((point) => (
                    <Cell key={point.group} fill={lowSet.has(point.group) ? LOW_STOCK_COLOR : NORMAL_COLOR} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: NORMAL_COLOR }} />
              {t('insightsInventoryLegendStocked')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: LOW_STOCK_COLOR }} />
              {t('insightsInventoryLegendLow')}
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
