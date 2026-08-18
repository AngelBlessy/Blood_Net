import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface RankedListRow {
  label: string;
  count: number;
}

interface RankedListCardProps {
  data: RankedListRow[];
  title: string;
  description: string;
  emptyMessage: string;
  labelHeader: string;
  countHeader: string;
}

// Shared "top N, ranked by count, with an inline bar" table — used for both
// most-active hospitals and top-cities-by-donor-count.
export function RankedListCard({ data, title, description, emptyMessage, labelHeader, countHeader }: RankedListCardProps) {
  const highest = data[0]?.count ?? 0;

  return (
    <Card className="gap-3 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="-mt-2 text-sm text-muted-foreground">{description}</p>

      {data.length === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labelHeader}</TableHead>
              <TableHead className="text-right">{countHeader}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="max-w-0 truncate font-medium">{row.label}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${highest > 0 ? (row.count / highest) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-muted-foreground">{row.count}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
