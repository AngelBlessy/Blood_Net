import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { BloodGroupDemandPoint } from '@/types/domain';

// Same order as BLOOD_GROUPS server-side, so a given blood group gets the
// same color in every chart that uses this palette (demand, donor supply) —
// lets a reader visually match "O+ demand" to "O+ supply" across cards.
export const BLOOD_GROUP_CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
];

interface BloodGroupPieChartProps {
  data: BloodGroupDemandPoint[];
  title: string;
  description: string;
  emptyMessage: string;
}

// Shared donut-chart rendering for any "count per blood group" dataset —
// used for both request demand and registered donor supply.
export function BloodGroupPieChart({ data, title, description, emptyMessage }: BloodGroupPieChartProps) {
  const total = data.reduce((sum, point) => sum + point.count, 0);

  return (
    <Card className="h-full gap-3 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="-mt-2 text-sm text-muted-foreground">{description}</p>

      {total === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <div className="min-h-72 w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="group"
                innerRadius="45%"
                outerRadius="80%"
                paddingAngle={2}
              >
                {data.map((point, index) => (
                  <Cell
                    key={point.group}
                    fill={BLOOD_GROUP_CHART_COLORS[index % BLOOD_GROUP_CHART_COLORS.length]}
                    stroke="none"
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--popover)',
                  color: 'var(--popover-foreground)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                }}
                formatter={(value, _name, item) => [value, (item.payload as BloodGroupDemandPoint).group]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
