import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useInventoryStore, LOW_STOCK_THRESHOLD } from '@/store/inventory-store';

export function InventoryGrid() {
  const { t } = useTranslation();
  const items = useInventoryStore((state) => state.items);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => {
        const low = item.units < LOW_STOCK_THRESHOLD;
        return (
          <Card key={item.group} className={`gap-1 p-4 ${low ? 'border-destructive/40' : ''}`}>
            <div className="flex items-center justify-between">
              <strong className="text-lg">{item.group}</strong>
              {low && (
                <Badge variant="destructive" className="text-[10px]">
                  {t('lowStockBadge')}
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium">{t('unitsLabel', { count: item.units })}</p>
            <p className="text-xs text-muted-foreground">
              {t('inventoryLocationExpiry', { location: item.location, expiry: item.expiry })}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
