import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useInventoryStore, LOW_STOCK_THRESHOLD } from '@/store/inventory-store';

export function InventoryGrid() {
  const { t } = useTranslation();
  const items = useInventoryStore((state) => state.items);

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => {
        const low = item.units < LOW_STOCK_THRESHOLD;
        return (
          <Card key={item.group} className={`gap-0.5 p-2.5 ${low ? 'border-destructive/40' : ''}`}>
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-1.5">
                <strong className="text-base">{item.group}</strong>
                <span className="text-xs font-medium text-muted-foreground">
                  {t('unitsLabel', { count: item.units })}
                </span>
              </div>
              {low && (
                <Badge variant="destructive" className="text-[9px]">
                  {t('lowStockBadge')}
                </Badge>
              )}
            </div>
            <p className="text-[11px] leading-tight text-muted-foreground">
              {t('inventoryLocationExpiry', {
                location: item.location,
                expiry: item.expiry ? new Date(item.expiry).toLocaleDateString() : '—',
              })}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
