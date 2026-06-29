<template>
  <div class="h-full w-full mr-win transition-colors duration-500 flex flex-col">
    <!-- 顶部导航区 -->
    <div
      class="flex-shrink-0 border-b border-gray-100 dark:border-gray-800 mr-win z-10 page-padding pt-6 pb-2"
    >
      <h1 class="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white mb-6">
        {{ t('common.settings') }}
      </h1>

      <n-scrollbar x-scrollable class="w-full">
        <div class="flex items-center pl-2 pb-2 whitespace-nowrap">
          <div
            v-for="section in navSections"
            :key="section.id"
            class="set-nav-chip py-1.5 px-4 mr-3 inline-block rounded-full cursor-pointer transition-colors duration-200 text-sm font-medium select-none"
            :class="currentSection === section.id ? 'is-active' : ''"
            @click="currentSection = section.id"
          >
            {{ section.title }}
          </div>
        </div>
      </n-scrollbar>
    </div>

    <!-- 内容区域 -->
    <n-scrollbar class="flex-1">
      <div class="w-full mx-auto pb-2 pt-6 page-padding">
        <div v-show="currentSection === 'basic'" class="animate-fade-in">
          <basic-tab />
        </div>

        <div v-show="currentSection === 'playback'" class="animate-fade-in">
          <playback-tab />
        </div>

        <div v-show="currentSection === 'application'" class="animate-fade-in">
          <application-tab />
        </div>

        <div v-show="currentSection === 'network'" class="animate-fade-in">
          <network-tab />
        </div>

        <div v-show="currentSection === 'system'" class="animate-fade-in">
          <system-tab />
        </div>

        <div v-show="currentSection === 'logs'" class="animate-fade-in">
          <logs-tab />
        </div>

        <div v-show="currentSection === 'about'" class="animate-fade-in">
          <about-tab />
        </div>

        <play-bottom height="78px" />
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
import { useDialog, useMessage } from 'naive-ui';
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import PlayBottom from '@/components/common/PlayBottom.vue';
import { useSettingsStore } from '@/store/modules/settings';
import { isElectron } from '@/utils';

import config from '../../../../package.json';
import { createDefaultAppUpdateState } from '../../../shared/appUpdate';
import { SETTINGS_DATA_KEY, SETTINGS_DIALOG_KEY, SETTINGS_MESSAGE_KEY } from './keys';
import AboutTab from './tabs/AboutTab.vue';
import ApplicationTab from './tabs/ApplicationTab.vue';
import BasicTab from './tabs/BasicTab.vue';
import LogsTab from './tabs/LogsTab.vue';
import NetworkTab from './tabs/NetworkTab.vue';
import PlaybackTab from './tabs/PlaybackTab.vue';
import SystemTab from './tabs/SystemTab.vue';

const settingsStore = useSettingsStore();
const message = useMessage();
const dialog = useDialog();
const { t } = useI18n();

// ==================== 设置数据管理 ====================
const saveSettings = useDebounceFn((data) => {
  settingsStore.setSetData(data);
}, 500);

const localSetData = ref({ ...settingsStore.setData });

const setData = computed({
  get: () => localSetData.value,
  set: (newData) => {
    localSetData.value = newData;
  }
});

watch(
  () => localSetData.value,
  (newValue) => saveSettings(newValue),
  { deep: true }
);

watch(
  () => settingsStore.setData,
  (newValue) => {
    if (JSON.stringify(localSetData.value) !== JSON.stringify(newValue)) {
      localSetData.value = { ...newValue };
    }
  },
  { deep: true, immediate: true }
);

onUnmounted(() => {
  settingsStore.setSetData(localSetData.value);
});

// ==================== Provide ====================
provide(SETTINGS_DATA_KEY, setData);
provide(SETTINGS_MESSAGE_KEY, message);
provide(SETTINGS_DIALOG_KEY, dialog);

// ==================== 导航相关 ====================
type SettingSectionConfig = {
  id: string;
  electron?: boolean;
};

const settingSections: SettingSectionConfig[] = [
  { id: 'basic' },
  { id: 'playback' },
  { id: 'application', electron: true },
  { id: 'network', electron: true },
  { id: 'system', electron: true },
  { id: 'logs', electron: true },
  { id: 'about' }
];

const navSections = computed(() => {
  return settingSections
    .filter((section) => !section.electron || isElectron)
    .map((section) => ({
      id: section.id,
      title: t(`settings.sections.${section.id}`)
    }));
});

const currentSection = ref('basic');

// ==================== 初始化 ====================
onMounted(() => {
  if (isElectron && settingsStore.appUpdateState.currentVersion === '') {
    settingsStore.setAppUpdateState(createDefaultAppUpdateState(config.version));
  }
  if (setData.value.proxyConfig) {
    // proxy form init moved to NetworkTab
  }
  if (setData.value.enableRealIP === undefined) {
    setData.value = { ...setData.value, enableRealIP: false };
  }
  if (setData.value.enableDiskCache === undefined) {
    setData.value = { ...setData.value, enableDiskCache: true };
  }
  if (!setData.value.diskCacheMaxSizeMB) {
    setData.value = { ...setData.value, diskCacheMaxSizeMB: 4096 };
  }
  if (!['lru', 'fifo'].includes(setData.value.diskCacheCleanupPolicy)) {
    setData.value = { ...setData.value, diskCacheCleanupPolicy: 'lru' };
  }
});
</script>

<style scoped>
:deep(.n-select .n-base-selection) {
  border-radius: 10px;
}

/* 标签配色与「发现」页保持一致 */
.set-nav-chip {
  background: var(--chip);
  color: var(--chipText);
}
.set-nav-chip:hover {
  background: var(--accentSoft);
  color: var(--accent);
}
.set-nav-chip.is-active {
  background: var(--accent);
  color: var(--accentText);
  box-shadow: 0 8px 16px -4px var(--accentLine);
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
