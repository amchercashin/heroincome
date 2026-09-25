import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { useNdflRates } from '@/hooks/use-ndfl-rates';
import { updateNdflRate } from '@/services/app-settings';
import { getTypeColor } from '@/models/account';
import { Card, Section } from '@/components/ds/surface';
import { NdflRateSelector } from './ndfl-rate-selector';

export function NdflSettings() {
  const categories = useLiveQuery(async () => {
    const assets = await db.assets.toArray();
    const types = new Set(assets.map((a) => a.type));
    return [...types].sort();
  }, []);

  const ndflRates = useNdflRates();

  if (!categories || categories.length === 0) return null;

  return (
    <Section
      title="НДФЛ с дохода"
      description="Выплаты хранятся до налога. Доход и доходность считаются после применения ставки."
    >
      <Card className="overflow-hidden px-4">
        {categories.map((type, i) => (
          <div key={type} className={i > 0 ? 'border-t border-[var(--hi-line)]' : ''}>
            <NdflRateSelector
              category={type}
              color={getTypeColor(type)}
              rate={ndflRates.get(type) ?? 0}
              onChange={(rate) => updateNdflRate(type, rate)}
            />
          </div>
        ))}
      </Card>
    </Section>
  );
}
