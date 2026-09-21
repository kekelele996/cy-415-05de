export enum ItemStatus {
  AVAILABLE = 'available',
  BOOKED = 'booked',
  EXCHANGED = 'exchanged',
  OFFLINE = 'offline',
}

export enum ItemCondition {
  NEW = 'new',
  LIKE_NEW = 'like_new',
  GOOD = 'good',
  WORN = 'worn',
}

export const ITEM_STATUS_OPTIONS = [
  { label: '可交换', value: ItemStatus.AVAILABLE },
  { label: '预约中', value: ItemStatus.BOOKED },
  { label: '已交换', value: ItemStatus.EXCHANGED },
  { label: '已下架', value: ItemStatus.OFFLINE },
];

// 物品在首页等浏览列表中可见的状态：被预约的物品仍展示“预约中”，但不能再申请
export const VISIBLE_BROWSE_STATUSES: ItemStatus[] = [ItemStatus.AVAILABLE, ItemStatus.BOOKED];
// 可以被新交换申请占用的状态
export const EXCHANGEABLE_STATUSES: ItemStatus[] = [ItemStatus.AVAILABLE];

export const ITEM_CONDITION_OPTIONS = [
  { label: '全新', value: ItemCondition.NEW },
  { label: '九成新', value: ItemCondition.LIKE_NEW },
  { label: '八成新', value: ItemCondition.GOOD },
  { label: '战损', value: ItemCondition.WORN },
];

export const ITEM_CATEGORIES = ['全部', '数码', '书籍', '家居', '服饰', '运动', '玩具', '其他'];

export const ITEM_STORAGE_HINTS = {
  statusKey: 'reswap:items',
  statusTouchedBy: ['models/item.ts', 'stores/itemStore.ts', 'components/common/ItemCard.vue', 'pages/ItemDetail.vue'],
};
