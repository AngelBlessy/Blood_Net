import type { LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { Card } from '@/components/ui/card';

interface InsightTileProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  /** A CSS color value, e.g. 'var(--chart-1)' — each tile gets its own hue so
   *  the KPI row reads as part of the same colorful system as the charts
   *  below, instead of eight identical pink chips. */
  color: string;
}

// A denser, icon-led relative of StatCard — built for the insights page's
// 8-tile grid, where StatCard's larger padding would push the page too tall
// before the reader even reaches the charts.
export function InsightTile({ label, value, icon: Icon, color }: InsightTileProps) {
  const style = {
    '--tile-color': color,
  } as CSSProperties;

  return (
    <Card
      style={{ ...style, borderTopColor: 'var(--tile-color)' }}
      className="flex-row items-center gap-3 border-t-[3px] p-4"
    >
      <div
        style={{ backgroundColor: 'color-mix(in oklch, var(--tile-color) 18%, transparent)', color }}
        className="flex size-10 shrink-0 items-center justify-center rounded-lg"
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold tabular-nums sm:text-xl">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}
