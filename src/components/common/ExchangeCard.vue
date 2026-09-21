<template>
  <article class="exchange-card">
    <header>
      <span class="status-pill" :class="statusToneClass(exchange.status)">
        {{ formatExchangeStatus(exchange.status) }}
      </span>
      <small>{{ formatDate(exchange.updated_at) }}</small>
    </header>
    <div class="exchange-card__items">
      <div>
        <span>拿出</span>
        <strong>{{ fromItem?.title ?? '未知物品' }}</strong>
      </div>
      <div>
        <span>换取</span>
        <strong>{{ toItem?.title ?? '未知物品' }}</strong>
      </div>
    </div>
    <p>{{ exchange.message || formatStatusMessage(exchange.status) }}</p>
    <footer>
      <span v-if="fromUser && toUser">{{ fromUser.nickname }} → {{ toUser.nickname }}</span>
      <div v-if="hasAction" class="exchange-card__actions">
        <template v-if="exchange.status === ExchangeStatus.PENDING">
          <button v-if="isOwner" type="button" @click="$emit('accept', exchange.id)">同意</button>
          <button v-if="isOwner" type="button" @click="$emit('reject', exchange.id)">拒绝</button>
          <button v-if="isApplicant" type="button" @click="$emit('withdraw', exchange.id)">
            撤回申请
          </button>
        </template>
        <button v-if="exchange.status === ExchangeStatus.ACCEPTED && canComplete" type="button" @click="$emit('complete', exchange.id)">
          完成
        </button>
      </div>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ExchangeStatus } from '@/constants/exchange';
import type { Exchange } from '@/models/exchange';
import type { Item } from '@/models/item';
import type { User } from '@/models/user';
import { useAuthStore } from '@/stores/authStore';
import { formatDate, formatExchangeStatus, formatStatusMessage, statusToneClass } from '@/utils/formatters';

const props = defineProps<{
  exchange: Exchange;
  items: Item[];
  users: User[];
}>();

defineEmits<{
  accept: [id: string];
  reject: [id: string];
  withdraw: [id: string];
  complete: [id: string];
}>();

const authStore = useAuthStore();
const fromItem = computed(() => props.items.find((item) => item.id === props.exchange.from_item_id));
const toItem = computed(() => props.items.find((item) => item.id === props.exchange.to_item_id));
const fromUser = computed(() => props.users.find((user) => user.id === props.exchange.from_user_id));
const toUser = computed(() => props.users.find((user) => user.id === props.exchange.to_user_id));
const isOwner = computed(() => authStore.currentUser?.id === props.exchange.to_user_id);
const isApplicant = computed(() => authStore.currentUser?.id === props.exchange.from_user_id);
const canComplete = computed(
  () =>
    isOwner.value ||
    (isApplicant.value && props.exchange.status === ExchangeStatus.ACCEPTED),
);
const canOperate = computed(() => isOwner.value || isApplicant.value);
const hasAction = computed(
  () =>
    canOperate.value &&
    ((props.exchange.status === ExchangeStatus.PENDING) ||
      (props.exchange.status === ExchangeStatus.ACCEPTED && canComplete.value)),
);
</script>
