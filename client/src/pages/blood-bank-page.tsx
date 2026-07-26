import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { InventoryForm } from '@/components/blood-bank/inventory-form';
import { InventoryGrid } from '@/components/blood-bank/inventory-grid';
import { useInventoryStore } from '@/store/inventory-store';

export function BloodBankPage() {
  const { t } = useTranslation();
  const fetchItems = useInventoryStore((state) => state.fetchItems);

  useEffect(() => {
    fetchItems({ mine: true });
  }, [fetchItems]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader eyebrow={t('workspaceEyebrow')} title={t('bloodBankTitle')} description={t('bloodBankDesc')} />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <span className="text-sm font-medium text-primary">{t('inventoryUpdateEyebrow')}</span>
          <h2 className="mb-4 text-lg font-semibold">{t('inventoryUpdateTitle')}</h2>
          <InventoryForm />
        </Card>

        <Card className="p-6">
          <span className="text-sm font-medium text-primary">{t('liveStockEyebrow')}</span>
          <h2 className="mb-4 text-lg font-semibold">{t('liveStockTitle')}</h2>
          <InventoryGrid />
        </Card>
      </div>
    </div>
  );
}
