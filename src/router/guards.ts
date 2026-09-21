import type { Router } from 'vue-router';

import { ExchangeStatus } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import { LOG_MESSAGES } from '@/constants/messages';
import { useAuthStore } from '@/stores/authStore';
import { useExchangeStore } from '@/stores/exchangeStore';
import { useItemStore } from '@/stores/itemStore';

export const setupRouterGuards = (router: Router) => {
  router.beforeEach(async () => {
    const authStore = useAuthStore();
    const itemStore = useItemStore();
    const exchangeStore = useExchangeStore();
    if (!authStore.currentUser) {
      await authStore.hydrate();
    }
    if (!itemStore.items.length) {
      await itemStore.hydrate();
    }
    if (!exchangeStore.exchanges.length) {
      await exchangeStore.hydrate();
    }

    // 以交换记录为准修复物品预约锁，保证刷新/重新打开页面后状态一致
    await exchangeStore.reconcileLocks();

    const statusProbe = itemStore.items.some(
      (item) => item.status === ItemStatus.AVAILABLE || item.status === ItemStatus.BOOKED,
    );
    const exchangeProbe = exchangeStore.exchanges.some(
      (item) => item.status === ExchangeStatus.PENDING || item.status === ExchangeStatus.CANCELLED,
    );
    if (import.meta.env.DEV && (statusProbe || exchangeProbe)) {
      console.debug(LOG_MESSAGES.storageHydrated);
    }
    return true;
  });
};
