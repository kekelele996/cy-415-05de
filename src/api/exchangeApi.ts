import { EXCHANGE_ACTION_FLOW, ExchangeStatus, LOCKING_STATUSES } from '@/constants/exchange';
import { EXCHANGEABLE_STATUSES, ItemStatus } from '@/constants/item';
import { FORM_MESSAGES, LOG_MESSAGES } from '@/constants/messages';
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

// 根据交换记录对物品状态进行预约锁对账。
// 已同意/已完成 -> 已交换；待确认 -> 预约中；锁释放后仅把“预约中”的物品恢复为可交换，
// 已交换/已下架是终态，不在这里复活。每次读取交换列表后都会执行，保证刷新后状态一致。
const syncItemLocks = async (exchanges: Exchange[]) => {
  const items = await itemApi.list();

  const isLocking = (exchange: Exchange) => LOCKING_STATUSES.includes(exchange.status);
  // 已同意/已完成优先于待确认：同一件物品被多个交换引用时取更强的占用状态
  const strongest = (itemId: string): ExchangeStatus | undefined =>
    exchanges.find(
      (exchange) =>
        isLocking(exchange) &&
        (exchange.from_item_id === itemId || exchange.to_item_id === itemId) &&
        exchange.status === ExchangeStatus.ACCEPTED,
    )?.status ??
    exchanges.find(
      (exchange) =>
        exchange.status === ExchangeStatus.PENDING &&
        (exchange.from_item_id === itemId || exchange.to_item_id === itemId),
    )?.status;

  let changed = false;
  const nextItems = items.map((item) => {
    const lock = strongest(item.id);
    if (lock === ExchangeStatus.ACCEPTED) {
      if (item.status !== ItemStatus.EXCHANGED) {
        changed = true;
        return { ...item, status: ItemStatus.EXCHANGED };
      }
      return item;
    }
    if (lock === ExchangeStatus.PENDING) {
      // 只有仍可被预约的物品加锁；已交换/已下架等终态不被旧申请改回
      if (item.status === ItemStatus.AVAILABLE) {
        changed = true;
        return { ...item, status: ItemStatus.BOOKED };
      }
      return item;
    }
    if (item.status === ItemStatus.BOOKED) {
      changed = true;
      return { ...item, status: ItemStatus.AVAILABLE };
    }
    return item;
  });

  if (changed) {
    await storage.set(STORAGE_KEYS.items, nextItems);
    if (import.meta.env.DEV) {
      console.debug(LOG_MESSAGES.itemLocksReconciled);
    }
  }
  return nextItems;
};

const assertItemExchangeable = async (itemId: string, bookedMessage: string) => {
  const item = await itemApi.detail(itemId);
  if (!item) throw new Error('物品不存在');
  if (item.status === ItemStatus.BOOKED) throw new Error(bookedMessage);
  if (!EXCHANGEABLE_STATUSES.includes(item.status)) {
    throw new Error(FORM_MESSAGES.exchangeTargetUnavailable);
  }
  return item;
};

// 纯前端没有数据库行锁，用串行队列把创建/状态流转排队，
// 避免双击或并发调用在 await 交错后对同一物品重复占用。
let taskChain: Promise<unknown> = Promise.resolve();
const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
  const run = taskChain.then(task, task);
  taskChain = run.catch(() => undefined);
  return run;
};

export const exchangeApi = {
  async list(): Promise<Exchange[]> {
    const exchanges = await storage.get<Exchange[]>(STORAGE_KEYS.exchanges, []);
    if (exchanges.length) {
      await syncItemLocks(exchanges);
      return exchanges;
    }
    await storage.set(STORAGE_KEYS.exchanges, seedExchanges);
    await syncItemLocks(seedExchanges);
    return seedExchanges;
  },

  async create(draft: ExchangeDraft): Promise<Exchange> {
    return enqueue(async () => {
      const exchanges = await this.list();

      if (draft.from_user_id === draft.to_user_id) {
        throw new Error(FORM_MESSAGES.exchangeSelf);
      }
      const duplicated = exchanges.some(
        (exchange) =>
          exchange.status === ExchangeStatus.PENDING &&
          exchange.from_user_id === draft.from_user_id &&
          exchange.to_item_id === draft.to_item_id,
      );
      if (duplicated) {
        throw new Error(FORM_MESSAGES.exchangeDuplicate);
      }
      // 目标物品与申请人拿出的物品都不能处于预约/已交换状态，避免重复占用
      await assertItemExchangeable(draft.to_item_id, FORM_MESSAGES.exchangeTargetBooked);
      await assertItemExchangeable(draft.from_item_id, FORM_MESSAGES.exchangeOwnBooked);

      const nextExchange: Exchange = {
        ...draft,
        id: storage.createId('exchange'),
        status: ExchangeStatus.PENDING,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const nextExchanges = [nextExchange, ...exchanges];
      await storage.set(STORAGE_KEYS.exchanges, nextExchanges);
      await syncItemLocks(nextExchanges);
      return nextExchange;
    });
  },

  async transition(id: string, status: ExchangeStatus): Promise<Exchange> {
    return enqueue(async () => {
      const exchanges = await this.list();
      const current = exchanges.find((item) => item.id === id);
      if (!current) throw new Error(FORM_MESSAGES.exchangeNotFound);
      if (!EXCHANGE_ACTION_FLOW[current.status].includes(status)) {
        throw new Error('当前状态不允许该操作');
      }
      const nextExchange: Exchange = { ...current, status, updated_at: new Date().toISOString() };
      const nextExchanges = exchanges.map((item) => (item.id === id ? nextExchange : item));
      await storage.set(STORAGE_KEYS.exchanges, nextExchanges);
      // 同意即成交：双方物品转为已交换；拒绝/撤回释放预约锁，物品恢复可交换
      await syncItemLocks(nextExchanges);
      return nextExchange;
    });
  },

  // 申请人撤回待确认申请
  async withdraw(id: string, userId: string): Promise<Exchange> {
    const exchanges = await this.list();
    const current = exchanges.find((item) => item.id === id);
    if (!current) throw new Error(FORM_MESSAGES.exchangeNotFound);
    if (current.from_user_id !== userId) throw new Error(FORM_MESSAGES.exchangeNotApplicant);
    if (current.status !== ExchangeStatus.PENDING) throw new Error(FORM_MESSAGES.exchangeNotPending);
    return this.transition(id, ExchangeStatus.WITHDRAWN);
  },
};
