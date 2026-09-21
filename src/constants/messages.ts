import { ExchangeStatus } from './exchange';
import { ItemStatus } from './item';

export const PAGE_MESSAGES = {
  homeEmpty: '暂时没有符合条件的闲置物品',
  publishReady: '发布后会同步写入 localStorage 和 IndexedDB',
  exchangeEmpty: '还没有交换请求，先去首页挑一件合眼缘的物品',
  profileUpdated: '个人资料已更新',
  itemBookedByMe: '你的申请已发出，正在等待物主确认',
  itemBookedByOther: '这件物品已被他人预约，暂时不能发起交换',
};

export const FORM_MESSAGES = {
  requiredTitle: '物品标题不能为空',
  requiredDescription: '请描述你希望交换的物品',
  requiredPhone: '请填写联系方式',
  imageLimit: '最多上传 4 张图片',
  exchangeNeedOwnItem: '请先发布一件可交换物品',
  exchangeSelf: '不能用自己的物品与自己交换',
  exchangeTargetUnavailable: '目标物品当前不可交换',
  exchangeTargetBooked: '这件物品已被预约，不能重复申请',
  exchangeOwnBooked: '你选择的物品已在其他交换中被预约',
  exchangeDuplicate: '这件物品你已经发起过待确认的申请了',
  exchangeNotFound: '交换请求不存在',
  exchangeRejected: '已拒绝交换，物品已恢复可交换',
  exchangeWithdrawn: '已撤回申请，物品已恢复可交换',
  exchangeNotApplicant: '只有申请人可以撤回该申请',
  exchangeNotPending: '当前申请状态不允许撤回',
};

export const LOG_MESSAGES = {
  storageHydrated: 'storage hydrated with status maps',
  itemStatusUsed: `ItemStatus includes ${ItemStatus.AVAILABLE}, ${ItemStatus.BOOKED}, ${ItemStatus.EXCHANGED}, ${ItemStatus.OFFLINE}`,
  exchangeStatusUsed: `ExchangeStatus includes ${ExchangeStatus.PENDING}, ${ExchangeStatus.ACCEPTED}, ${ExchangeStatus.REJECTED}, ${ExchangeStatus.WITHDRAWN}, ${ExchangeStatus.COMPLETED}`,
  itemLocksReconciled: 'item booking locks reconciled from exchange records',
};

export const STATUS_MESSAGE_MAP = {
  [ItemStatus.AVAILABLE]: '这件物品可发起交换',
  [ItemStatus.BOOKED]: '这件物品预约中，暂时不能发起交换',
  [ItemStatus.EXCHANGED]: '这件物品已完成交换',
  [ItemStatus.OFFLINE]: '这件物品已下架',
  [ExchangeStatus.PENDING]: '等待对方确认',
  [ExchangeStatus.ACCEPTED]: '交换已同意，可确认完成',
  [ExchangeStatus.REJECTED]: '物主已拒绝，物品恢复可交换',
  [ExchangeStatus.WITHDRAWN]: '申请人已撤回，物品恢复可交换',
  [ExchangeStatus.COMPLETED]: '交换流程已完成',
};
