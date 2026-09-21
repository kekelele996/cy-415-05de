import { defineStore } from 'pinia';
import { orderBy } from 'lodash-es';

import { itemApi } from '@/api/itemApi';
import { ItemStatus, VISIBLE_BROWSE_STATUSES } from '@/constants/item';
import { FORM_MESSAGES } from '@/constants/messages';
import type { Item, ItemDraft } from '@/models/item';
import { message } from '@/utils/message';
import { validateItemDraft } from '@/utils/validators';

export const useItemStore = defineStore('items', {
  state: () => ({
    items: [] as Item[],
    keyword: '',
    category: '全部',
    statusFilter: ItemStatus.AVAILABLE as ItemStatus,
    loading: false,
  }),
  getters: {
    visibleItems: (state) => {
      return orderBy(
        state.items.filter((item) => {
          const categoryMatched = state.category === '全部' || item.category === state.category;
          const keywordMatched = `${item.title}${item.description}${item.location}`
            .toLowerCase()
            .includes(state.keyword.toLowerCase());
          // 可交换与预约中的物品都在首页展示，预约中显示“预约中”且不能再申请
          return categoryMatched && keywordMatched && VISIBLE_BROWSE_STATUSES.includes(item.status);
        }),
        ['created_at'],
        ['desc'],
      );
    },
    myItems: (state) => (userId: string) => state.items.filter((item) => item.user_id === userId),
    availableMyItems: (state) => (userId: string) =>
      state.items.filter((item) => item.user_id === userId && item.status === ItemStatus.AVAILABLE),
    bookedMyItems: (state) => (userId: string) =>
      state.items.filter((item) => item.user_id === userId && item.status === ItemStatus.BOOKED),
  },
  actions: {
    async hydrate() {
      this.loading = true;
      try {
        this.items = await itemApi.list();
      } finally {
        this.loading = false;
      }
    },
    async publish(draft: ItemDraft) {
      const error = validateItemDraft(draft);
      if (error) {
        message(error, 'error');
        return null;
      }
      const item = await itemApi.create({
        user_id: draft.user_id,
        title: draft.title,
        description: draft.description,
        category: draft.category,
        condition: draft.condition,
        images: [...draft.images],
        location: draft.location,
        status: ItemStatus.AVAILABLE,
      });
      this.items = await itemApi.list();
      message('物品已发布，等待合适的交换', 'success');
      return item;
    },
    async offline(itemId: string) {
      const target = this.items.find((item) => item.id === itemId);
      if (target?.status === ItemStatus.BOOKED) {
        message('物品预约中，不能下架', 'error');
        return;
      }
      await itemApi.setStatus(itemId, ItemStatus.OFFLINE);
      this.items = await itemApi.list();
      message('物品已下架', 'success');
    },
    assertCanExchange(userId: string) {
      const ownItems = this.availableMyItems(userId);
      if (!ownItems.length) {
        message(FORM_MESSAGES.exchangeNeedOwnItem, 'error');
        return false;
      }
      return true;
    },
  },
});
