import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

interface LabeledSlice {
  label: string;
  count: number;
  color: string;
}

interface LabeledPieChartProps {
  data: LabeledSlice[];
  title: string;
  description: string;
  emptyMessage: string;
}

// Like BloodGroupPieChart, but for small breakdowns (2-4 slices) that need a
// semantic color per slice (e.g. Critical=red) rather than the 8-color
// blood-group cycle.
export function LabeledPieChart({ data, title, description, emptyMessage }: LabeledPieChartProps) {
  const total = data.reduce((sum, slice) => sum + slice.count, 0);

  return (
    <Card className="gap-3 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="-mt-2 text-sm text-muted-foreground">{description}</p>

      {total === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="label" innerRadius="45%" outerRadius="80%" paddingAngle={2}>
                {data.map((slice) => (
                  <Cell key={slice.label} fill={slice.color} stroke="none" />
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
              />
              <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
