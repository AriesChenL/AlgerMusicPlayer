<template>
  <setting-section v-if="isElectron" :title="t('settings.sections.logs')">
    <!-- 开关 -->
    <setting-item :title="t('settings.logs.enable')" :description="t('settings.logs.enableDesc')">
      <n-switch v-model:value="setData.logEnabled">
        <template #checked>{{ t('common.on') }}</template>
        <template #unchecked>{{ t('common.off') }}</template>
      </n-switch>
    </setting-item>

    <!-- 日志级别 -->
    <setting-item :title="t('settings.logs.level')" :description="t('settings.logs.levelDesc')">
      <s-select v-model="setData.logLevel" :options="levelOptions" width="w-40" />
    </setting-item>

    <!-- 存储目录 -->
    <setting-item :title="t('settings.logs.directory')">
      <template #description>
        <span class="break-all">{{
          setData.logDir || effectiveDir || t('settings.logs.directoryDesc')
        }}</span>
      </template>
      <template #action>
        <div class="flex items-center gap-2 max-md:flex-wrap">
          <s-btn @click="selectLogDirectory">{{ t('settings.logs.selectDirectory') }}</s-btn>
          <s-btn @click="openLogDirectory">{{ t('settings.logs.openDirectory') }}</s-btn>
          <s-btn v-if="setData.logDir" @click="resetLogDirectory">{{
            t('settings.logs.reset')
          }}</s-btn>
        </div>
      </template>
    </setting-item>

    <!-- 保留天数 -->
    <setting-item
      :title="t('settings.logs.retention')"
      :description="t('settings.logs.retentionDesc')"
    >
      <template #action>
        <s-input
          v-model="setData.logRetentionDays"
          type="number"
          :min="0"
          :max="365"
          :step="1"
          :suffix="t('settings.logs.days')"
          width="w-[160px] max-md:w-32"
        />
      </template>
    </setting-item>

    <!-- 日志文件状态 -->
    <setting-item
      :title="t('settings.logs.status')"
      :description="
        t('settings.logs.statusDesc', { count: logFiles.length, size: formatBytes(totalSize) })
      "
    >
      <template #action>
        <div class="flex items-center gap-2 max-md:flex-wrap">
          <s-btn @click="refreshLogFiles">{{ t('common.refresh') }}</s-btn>
          <s-btn variant="danger" @click="handleClearLogs">{{ t('settings.logs.clear') }}</s-btn>
        </div>
      </template>
    </setting-item>
  </setting-section>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { isElectron } from '@/utils';
import { selectDirectory } from '@/utils/fileOperation';
import { clearLogs, getLogDir, listLogFiles, type LogFileInfo, openLogDir } from '@/utils/logger';

import { SETTINGS_DATA_KEY, SETTINGS_MESSAGE_KEY } from '../keys';
import SBtn from '../SBtn.vue';
import SettingItem from '../SettingItem.vue';
import SettingSection from '../SettingSection.vue';
import SInput from '../SInput.vue';
import SSelect from '../SSelect.vue';

const { t } = useI18n();
const setData = inject(SETTINGS_DATA_KEY)!;
const message = inject(SETTINGS_MESSAGE_KEY)!;

const effectiveDir = ref('');
const logFiles = ref<LogFileInfo[]>([]);

const levelOptions = computed(() => [
  { label: t('settings.logs.levels.error'), value: 'error' },
  { label: t('settings.logs.levels.warn'), value: 'warn' },
  { label: t('settings.logs.levels.info'), value: 'info' },
  { label: t('settings.logs.levels.debug'), value: 'debug' }
]);

const totalSize = computed(() => logFiles.value.reduce((sum, f) => sum + (f.size || 0), 0));

const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const refreshLogFiles = async () => {
  const result = await listLogFiles();
  effectiveDir.value = result.dir;
  logFiles.value = result.files;
};

const selectLogDirectory = async () => {
  const dir = await selectDirectory(message);
  if (dir) {
    setData.value = { ...setData.value, logDir: dir };
    await refreshLogFiles();
    message.success(t('settings.logs.messages.dirChanged'));
  }
};

const resetLogDirectory = async () => {
  setData.value = { ...setData.value, logDir: '' };
  effectiveDir.value = await getLogDir();
  await refreshLogFiles();
  message.success(t('settings.logs.messages.dirReset'));
};

const openLogDirectory = () => {
  openLogDir();
};

const handleClearLogs = async () => {
  const result = await clearLogs();
  if (result.success) {
    message.success(t('settings.logs.messages.cleared', { count: result.removed }));
    await refreshLogFiles();
  } else {
    message.error(t('settings.logs.messages.clearFailed'));
  }
};

onMounted(async () => {
  if (!isElectron) return;
  effectiveDir.value = await getLogDir();
  await refreshLogFiles();
});
</script>
