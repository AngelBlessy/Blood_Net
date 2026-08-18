import { useTranslation } from 'react-i18next';
import { LabeledPieChart } from './labeled-pie-chart';
import type { DonorAvailabilityBreakdown } from '@/types/domain';

export function DonorAvailabilityChart({ data }: { data: DonorAvailabilityBreakdown }) {
  const { t } = useTranslation();
  return (
    <LabeledPieChart
      data={[
        { label: t('insightsAvailabilityAvailable'), count: data.available, color: 'var(--success)' },
        { label: t('insightsAvailabilityTraveling'), count: data.traveling, color: 'var(--chart-6)' },
      ]}
      title={t('insightsAvailabilityChartTitle')}
      description={t('insightsAvailabilityChartDesc')}
      emptyMessage={t('insightsAvailabilityChartEmpty')}
    />
  );
}
