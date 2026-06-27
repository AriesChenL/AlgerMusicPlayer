<template>
  <div class="flex gap-6 h-full pb-4 page-padding pt-6 mr-win">
    <favorite class="flex-item" v-if="!isMobile" />
    <history-list class="flex-item" />
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'History'
});

import { isMobile } from '@/utils';
import Favorite from '@/views/favorite/index.vue';
import HistoryList from '@/views/history/index.vue';
</script>

<style scoped>
.flex-item {
  @apply flex-1 bg-gray-50 dark:bg-dark-100/50 rounded-3xl overflow-hidden border border-gray-100 dark:border-neutral-800 transition-all duration-300;
}
</style>
