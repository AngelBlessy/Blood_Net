import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiGet } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { NetworkTrends, TrendGranularity } from '@/types/domain';

const POLL_INTERVAL_MS = 45_000;
const RANGES = ['1m', '3m', '6m', '1y'] as const;
type Range = (typeof RANGES)[number];

const RANGE_LABEL_KEYS: Record<Range, 'insightsRange1m' | 'insightsRange3m' | 'insightsRange6m' | 'insightsRange1y'> = {
  '1m': 'insightsRange1m',
  '3m': 'insightsRange3m',
  '6m': 'insightsRange6m',
  '1y': 'insightsRange1y',
};

function pointLabel(key: string, granularity: TrendGranularity, locale: string) {
  const isDay = granularity === 'day';
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, isDay ? day : 1));
  const options: Intl.DateTimeFormatOptions = isDay
    ? { day: 'numeric', month: 'short', timeZone: 'UTC' }
    : { month: 'short', timeZone: 'UTC' };
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return new Intl.DateTimeFormat('en', options).format(date);
  }
}

// The page's hero visual — full-width, taller than the other charts, with a
// 1M/3M/6M/1Y range toggle and two overlaid series (donations completed and
// new donor signups) so growth and activity read together at a glance.
export function NetworkTrendChart() {
  const { t, i18n } = useTranslation();
  const [range, setRange] = useState<Range>('6m');
  const [trends, setTrends] = useState<NetworkTrends | null>(null);

  const refresh = useCallback((forRange: Range) => {
    apiGet<NetworkTrends>(`/admin/trends?range=${forRange}`)
      .then(setTrends)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh(range);
    // Poll as a fallback; the socket listener below is what makes new
    // activity reflect here within moments instead of up to a minute late.
    const interval = setInterval(() => refresh(range), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [range, refresh]);

  useEffect(() => {
    const socket = getSocket();
    const handler = () => refresh(range);
    socket.on('admin:refresh', handler);
    return () => {
      socket.off('admin:refresh', handler);
    };
  }, [range, refresh]);

  const points = trends?.points ?? [];
  const granularity = trends?.granularity ?? 'month';
  const chartData = points.map((point) => ({ ...point, label: pointLabel(point.key, granularity, i18n.language) }));
  const donationsTotal = points.reduce((sum, point) => sum + point.donations, 0);
  const newDonorsTotal = points.reduce((sum, point) => sum + point.newDonors, 0);
  // 1-month range has 30 daily points — thin the x-axis ticks so labels don't
  // collide; month ranges (max 12 points) show every tick.
  const tickInterval = granularity === 'day' ? Math.max(Math.floor(points.length / 6) - 1, 0) : 0;

  return (
    <Card className="gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t('insightsNetworkTrendTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('insightsNetworkTrendDesc')}</p>
        </div>
        <Tabs value={range} onValueChange={(value) => setRange(value as Range)}>
          <TabsList>
            {RANGES.map((option) => (
              <TabsTrigger key={option} value={option}>
                {t(RANGE_LABEL_KEYS[option])}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: 'var(--chart-1)' }} />
          <span className="font-display text-2xl font-semibold tabular-nums">{donationsTotal}</span>
          <span className="text-sm text-muted-foreground">{t('insightsSeriesDonations')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: 'var(--chart-6)' }} />
          <span className="font-display text-2xl font-semibold tabular-nums">{newDonorsTotal}</span>
          <span className="text-sm text-muted-foreground">{t('insightsSeriesNewDonors')}</span>
        </div>
      </div>

      <div className="h-64 w-full sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="donationsTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="newDonorsTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-6)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--chart-6)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
            />
            <YAxis
              allowDecimals={false}
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--popover)',
                color: 'var(--popover-foreground)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
              }}
              labelFormatter={(label) => label}
              formatter={(value, name) => [value, name === 'donations' ? t('insightsSeriesDonations') : t('insightsSeriesNewDonors')]}
            />
            <Area
              type="monotone"
              dataKey="donations"
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              fill="url(#donationsTrendFill)"
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Area
              type="monotone"
              dataKey="newDonors"
              stroke="var(--chart-6)"
              strokeWidth={2.5}
              fill="url(#newDonorsTrendFill)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
