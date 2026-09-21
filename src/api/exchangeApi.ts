import { EXCHANGE_ACTION_FLOW, ExchangeStatus } from '@/constants/exchange';
import { ItemStatus } from '@/constants/item';
import type { Exchange, ExchangeDraft } from '@/models/exchange';

import { itemApi } from './itemApi';
import { storage, STORAGE_KEYS } from '@/utils/storage';

const seedExchanges: Exchange[] = [
  {
    id: 'exchange_seed',
    from_user_id: 'user_me',
    to_user_id: 'user_lin',
    from_item_id: 'item_chair',
    to_item_id: 'item_camera',
    status: ExchangeStatus.PENDING,
    message: '露营椅换拍立得，可以同城当面交换。',
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

const LOCKED_EXCHANGE_STATUSES: ExchangeStatus[] = [ExchangeStatus.PENDING, ExchangeStatus.ACCEPTED];

const isLockingStatus = (status: ExchangeStatus) => LOCKED_EXCHANGE_STATUSES.includes(status);

export const exchangeApi = {
  async list(): Promise<Exchange[]> {
    const exchanges = await storage.get<Exchange[]>(STORAGE_KEYS.exchanges, []);
    if (exchanges.length) return exchanges;
    await storage.set(STORAGE_KEYS.exchanges, seedExchanges);
    return seedExchanges;
  },

  async activeExchangeForItem(itemId: string): Promise<Exchange | undefined> {
    const exchanges = await this.list();
    return exchanges.find(
      (exchange) =>
        isLockingStatus(exchange.status) &&
        (exchange.from_item_id === itemId || exchange.to_item_id === itemId),
    );
  },

  async create(draft: ExchangeDraft): Promise<Exchange> {
    const exchanges = await this.list();
    const targetItem = await itemApi.detail(draft.to_item_id);
    if (!targetItem || targetItem.status !== ItemStatus.AVAILABLE) {
      throw new Error('目标物品当前不可交换');
    }
    const offerItem = await itemApi.detail(draft.from_item_id);
    if (!offerItem || offerItem.status !== ItemStatus.AVAILABLE) {
      throw new Error('你选择的交换物当前不可用');
    }
    if (offerItem.user_id !== draft.from_user_id) {
      throw new Error('只能使用自己发布的物品发起交换');
    }
    if (targetItem.user_id !== draft.to_user_id) {
      throw new Error('目标物品信息已变化，请刷新后重试');
    }
    const duplicated = exchanges.some(
      (exchange) =>
        isLockingStatus(exchange.status) &&
        (exchange.from_item_id === draft.from_item_id ||
          exchange.from_item_id === draft.to_item_id ||
          exchange.to_item_id === draft.from_item_id ||
          exchange.to_item_id === draft.to_item_id),
    );
    if (duplicated) {
      throw new Error('相关物品已有进行中的交换请求，不能重复预约');
    }
    const nextExchange: Exchange = {
      ...draft,
      id: storage.createId('exchange'),
      status: draft.status ?? ExchangeStatus.PENDING,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // 预约锁：申请创建即同时锁定双方物品，保证刷新后状态一致且不会重复占用
    await itemApi.setStatus(draft.to_item_id, ItemStatus.BOOKED);
    await itemApi.setStatus(draft.from_item_id, ItemStatus.BOOKED);
    await storage.set(STORAGE_KEYS.exchanges, [nextExchange, ...exchanges]);
    return nextExchange;
  },

  async transition(id: string, status: ExchangeStatus): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (!EXCHANGE_ACTION_FLOW[current.status].includes(status)) {
      throw new Error('当前状态不允许该操作');
    }
    const nextExchange: Exchange = { ...current, status, updated_at: new Date().toISOString() };
    // 先落盘新状态，再同步物品锁，否则释放判断仍会读到旧的进行中申请
    await storage.set(
      STORAGE_KEYS.exchanges,
      exchanges.map((item) => (item.id === id ? nextExchange : item)),
    );
    await this.applyItemLocks(nextExchange);
    return nextExchange;
  },

  async withdraw(id: string, userId: string): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error('交换请求不存在');
    if (current.from_user_id !== userId) {
      throw new Error('只有申请人可以撤回该请求');
    }
    return this.transition(id, ExchangeStatus.CANCELLED);
  },

  /**
   * 根据交换请求推导物品的锁定状态。
   * - PENDING：双方物品预约中
   * - ACCEPTED / COMPLETED：双方物品已交换
   * - REJECTED / CANCELLED：仅当不存在其他进行中的请求时恢复可交换
   */
  async applyItemLocks(exchange: Exchange): Promise<void> {
    if (exchange.status === ExchangeStatus.PENDING) {
      await itemApi.setStatus(exchange.to_item_id, ItemStatus.BOOKED);
      await itemApi.setStatus(exchange.from_item_id, ItemStatus.BOOKED);
      return;
    }
    if (exchange.status === ExchangeStatus.ACCEPTED || exchange.status === ExchangeStatus.COMPLETED) {
      await itemApi.setStatus(exchange.to_item_id, ItemStatus.EXCHANGED);
      await itemApi.setStatus(exchange.from_item_id, ItemStatus.EXCHANGED);
      return;
    }
    await this.releaseItemIfFree(exchange.to_item_id);
    await this.releaseItemIfFree(exchange.from_item_id);
  },

  async releaseItemIfFree(itemId: string): Promise<void> {
    const stillLocked = await this.activeExchangeForItem(itemId);
    if (!stillLocked) {
      await itemApi.setStatus(itemId, ItemStatus.AVAILABLE);
    }
  },

  /**
   * 刷新/重新打开页面时的一致性修复：以交换记录为事实来源，
   * 纠正物品的预约/交换状态，避免遗留锁或重复占用。
   */
  async reconcileItemLocks(): Promise<void> {
    const exchanges = await this.list();
    const items = await itemApi.list();
    for (const item of items) {
      if (item.status === ItemStatus.OFFLINE) continue;
      const active = exchanges.find(
        (exchange) =>
          isLockingStatus(exchange.status) &&
          (exchange.from_item_id === item.id || exchange.to_item_id === item.id),
      );
      if (active) {
        const expected =
          active.status === ExchangeStatus.PENDING ? ItemStatus.BOOKED : ItemStatus.EXCHANGED;
        if (item.status !== expected) {
          await itemApi.setStatus(item.id, expected);
        }
      } else if (item.status === ItemStatus.BOOKED) {
        // 没有进行中的请求却仍显示预约中（撤回/拒绝后残留锁），恢复可交换
        await itemApi.setStatus(item.id, ItemStatus.AVAILABLE);
      }
    }
  },
};
