export enum ExchangeStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
  COMPLETED = 'completed',
}

export const EXCHANGE_STATUS_OPTIONS = [
  { label: '待确认', value: ExchangeStatus.PENDING },
  { label: '已同意', value: ExchangeStatus.ACCEPTED },
  { label: '已拒绝', value: ExchangeStatus.REJECTED },
  { label: '已撤回', value: ExchangeStatus.WITHDRAWN },
  { label: '已完成', value: ExchangeStatus.COMPLETED },
];

// 仍在占用物品的交换状态：待确认持有预约锁，已同意锁定到完成
export const LOCKING_STATUSES: ExchangeStatus[] = [ExchangeStatus.PENDING, ExchangeStatus.ACCEPTED];

export const EXCHANGE_ACTION_FLOW: Record<ExchangeStatus, ExchangeStatus[]> = {
  [ExchangeStatus.PENDING]: [ExchangeStatus.ACCEPTED, ExchangeStatus.REJECTED, ExchangeStatus.WITHDRAWN],
  [ExchangeStatus.ACCEPTED]: [ExchangeStatus.COMPLETED],
  [ExchangeStatus.REJECTED]: [],
  [ExchangeStatus.WITHDRAWN]: [],
  [ExchangeStatus.COMPLETED]: [],
};

export const EXCHANGE_STORAGE_HINTS = {
  statusKey: 'reswap:exchanges',
  statusTouchedBy: ['models/exchange.ts', 'stores/exchangeStore.ts', 'components/common/ExchangeCard.vue'],
};
