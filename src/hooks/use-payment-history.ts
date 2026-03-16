import { useLiveQuery } from 'dexie-react-hooks';
import Dexie from 'dexie';
import { db } from '@/db/database';

export function usePaymentHistory(assetId: number) {
  return useLiveQuery(
    () => db.paymentHistory.where('[assetId+date]')
      .between([assetId, Dexie.minKey], [assetId, Dexie.maxKey])
      .toArray(),
    [assetId],
    [],
  );
}

export function useAllPaymentHistory() {
  return useLiveQuery(() => db.paymentHistory.toArray(), [], []);
}
