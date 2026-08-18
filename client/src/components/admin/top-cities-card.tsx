import { useTranslation } from 'react-i18next';
import { RankedListCard } from './ranked-list-card';
import type { CityCountPoint } from '@/types/domain';

export function TopCitiesCard({ data }: { data: CityCountPoint[] }) {
  const { t } = useTranslation();
  return (
    <RankedListCard
      data={data.map((entry) => ({ label: entry.city, count: entry.count }))}
      title={t('insightsTopCitiesTitle')}
      description={t('insightsTopCitiesDesc')}
      emptyMessage={t('insightsTopCitiesEmpty')}
      labelHeader={t('insightsTopCitiesColCity')}
      countHeader={t('insightsTopCitiesColDonors')}
    />
  );
}
