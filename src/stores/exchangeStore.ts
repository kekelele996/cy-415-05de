import { defineStore } from 'pinia';

import { exchangeApi } from '@/api/exchangeApi';
import { ExchangeStatus } from '@/constants/exchange';
import type { Exchange, ExchangeDraft } from '@/models/exchange';
import { useAuthStore } from '@/stores/authStore';
import { useItemStore } from '@/stores/itemStore';
import { message } from '@/utils/message';

export const useExchangeStore = defineStore('exchanges', {
  state: () => ({
    exchanges: [] as Exchange[],
    statusFilter: 'all' as ExchangeStatus | 'all',
    loading: false,
  }),
  getters: {
    sent: (state) => (userId: string) => state.exchanges.filter((item) => item.from_user_id === userId),
    received: (state) => (userId: string) => state.exchanges.filter((item) => item.to_user_id === userId),
    filtered: (state) => {
      if (state.statusFilter === 'all') return state.exchanges;
      return state.exchanges.filter((item) => item.status === state.statusFilter);
    },
  },
  actions: {
    async hydrate() {
      this.loading = true;
      try {
        this.exchanges = await exchangeApi.list();
      } finally {
        this.loading = false;
      }
    },
    /** 以交换记录为准修复物品预约锁，保证刷新/重开页面后状态一致 */
    async reconcileLocks() {
      await exchangeApi.reconcileItemLocks();
      const itemStore = useItemStore();
      await itemStore.hydrate();
    },
    async create(draft: ExchangeDraft) {
      const exchange = await exchangeApi.create({ ...draft, status: ExchangeStatus.PENDING });
      this.exchanges = await exchangeApi.list();
      const itemStore = useItemStore();
      await itemStore.hydrate();
      message('交换请求已发出，双方物品已预约锁定', 'success');
      return exchange;
    },
    async accept(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.ACCEPTED);
      this.exchanges = await exchangeApi.list();
      const itemStore = useItemStore();
      await itemStore.hydrate();
      message('已同意交换，相关物品已转为已交换', 'success');
    },
    async reject(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.REJECTED);
      this.exchanges = await exchangeApi.list();
      const itemStore = useItemStore();
      await itemStore.hydrate();
      message('已拒绝交换，物品恢复可交换', 'success');
    },
    async withdraw(id: string) {
      const authStore = useAuthStore();
      if (!authStore.currentUser) throw new Error('请先登录');
      await exchangeApi.withdraw(id, authStore.currentUser.id);
      this.exchanges = await exchangeApi.list();
      const itemStore = useItemStore();
      await itemStore.hydrate();
      message('已撤回申请，物品恢复可交换', 'success');
    },
    async complete(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.COMPLETED);
      this.exchanges = await exchangeApi.list();
      const itemStore = useItemStore();
      await itemStore.hydrate();
      message('交换已完成，双方物品状态已更新', 'success');
    },
  },
});
