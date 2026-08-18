import { useTranslation } from 'react-i18next';
import { BloodGroupPieChart } from './blood-group-pie-chart';
import type { BloodGroupDemandPoint } from '@/types/domain';

export function DonorsByGroupChart({ data }: { data: BloodGroupDemandPoint[] }) {
  const { t } = useTranslation();
  return (
    <BloodGroupPieChart
      data={data}
      title={t('insightsDonorsByGroupTitle')}
      description={t('insightsDonorsByGroupDesc')}
      emptyMessage={t('insightsDonorsByGroupEmpty')}
    />
  );
}
