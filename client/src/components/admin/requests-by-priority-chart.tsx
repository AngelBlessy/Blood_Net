import { useTranslation } from 'react-i18next';
import { LabeledPieChart } from './labeled-pie-chart';
import { PRIORITY_LABEL_KEYS } from '@/lib/request-labels';
import type { RequestPriorityPoint } from '@/types/domain';

const PRIORITY_COLORS: Record<RequestPriorityPoint['priority'], string> = {
  Critical: 'var(--destructive)',
  Urgent: 'var(--chart-2)',
  Routine: 'var(--chart-4)',
};

export function RequestsByPriorityChart({ data }: { data: RequestPriorityPoint[] }) {
  const { t } = useTranslation();
  return (
    <LabeledPieChart
      data={data.map((entry) => ({
        label: t(PRIORITY_LABEL_KEYS[entry.priority]),
        count: entry.count,
        color: PRIORITY_COLORS[entry.priority],
      }))}
      title={t('insightsPriorityChartTitle')}
      description={t('insightsPriorityChartDesc')}
      emptyMessage={t('insightsPriorityChartEmpty')}
    />
  );
}
