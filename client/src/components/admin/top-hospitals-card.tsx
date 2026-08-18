import { useTranslation } from 'react-i18next';
import { RankedListCard } from './ranked-list-card';
import type { TopHospitalPoint } from '@/types/domain';

export function TopHospitalsCard({ data }: { data: TopHospitalPoint[] }) {
  const { t } = useTranslation();
  return (
    <RankedListCard
      data={data.map((entry) => ({ label: entry.hospitalName, count: entry.count }))}
      title={t('adminTopHospitalsTitle')}
      description={t('adminTopHospitalsDesc')}
      emptyMessage={t('adminTopHospitalsEmpty')}
      labelHeader={t('adminTopHospitalsColHospital')}
      countHeader={t('adminTopHospitalsColRequests')}
    />
  );
}
