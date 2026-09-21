import { defineStore } from 'pinia';

import { itemApi } from '@/api/itemApi';
import { exchangeApi } from '@/api/exchangeApi';
import { ExchangeStatus } from '@/constants/exchange';
import { FORM_MESSAGES } from '@/constants/messages';
import type { Exchange, ExchangeDraft } from '@/models/exchange';
import { message } from '@/utils/message';

import { useAuthStore } from './authStore';
import { useItemStore } from './itemStore';

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
    // 用户对某件目标物品是否已有待确认的申请（用于详情页撤回入口）
    pendingByUserForItem: (state) => (userId: string, itemId: string) =>
      state.exchanges.find(
        (item) =>
          item.status === ExchangeStatus.PENDING &&
          item.from_user_id === userId &&
          item.to_item_id === itemId,
      ),
  },
  actions: {
    // 交换记录的预约锁对账可能回写物品状态，读取后同步 itemStore
    async syncItems() {
      useItemStore().items = await itemApi.list();
    },
    async hydrate() {
      this.loading = true;
      try {
        this.exchanges = await exchangeApi.list();
        await this.syncItems();
      } finally {
        this.loading = false;
      }
    },
    async create(draft: ExchangeDraft) {
      try {
        const exchange = await exchangeApi.create({ ...draft, status: ExchangeStatus.PENDING });
        this.exchanges = await exchangeApi.list();
        await this.syncItems();
        message('交换请求已发出，物品已预约', 'success');
        return exchange;
      } catch (error) {
        message(error instanceof Error ? error.message : '发起交换失败', 'error');
        return null;
      }
    },
    async accept(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.ACCEPTED);
      this.exchanges = await exchangeApi.list();
      await this.syncItems();
      message('已同意交换，双方物品已转为已交换', 'success');
    },
    async reject(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.REJECTED);
      this.exchanges = await exchangeApi.list();
      await this.syncItems();
      message(FORM_MESSAGES.exchangeRejected, 'success');
    },
    async withdraw(id: string) {
      const userId = useAuthStore().currentUser?.id;
      if (!userId) return false;
      try {
        await exchangeApi.withdraw(id, userId);
        this.exchanges = await exchangeApi.list();
        await this.syncItems();
        message(FORM_MESSAGES.exchangeWithdrawn, 'success');
        return true;
      } catch (error) {
        message(error instanceof Error ? error.message : '撤回失败', 'error');
        return false;
      }
    },
    async complete(id: string) {
      await exchangeApi.transition(id, ExchangeStatus.COMPLETED);
      this.exchanges = await exchangeApi.list();
      await this.syncItems();
      message('交换已完成，双方物品状态已更新', 'success');
    },
  },
});
