<template>
  <div
    id="title-bar"
    class="mr-titlebar"
    :class="{ 'is-mac': isMac, 'is-blur': !isWindowFocused }"
    @mousedown="drag"
  >
    <!-- 左侧：产品名（macOS 下位于原生交通灯右侧，由 .is-mac 的 padding-left 让位） -->
    <div id="title" class="mr-titlebar-title">Aries Music</div>
    <div class="mr-titlebar-flex"></div>
    <div id="buttons" class="mr-titlebar-buttons">
      <n-button
        v-if="!isElectron"
        type="primary"
        size="small"
        text
        title="下载应用"
        @click="openDownloadPage"
      >
        <i class="ri-download-line"></i>
        下载桌面版
      </n-button>
      <template v-if="isElectron">
        <!-- 最小化 / 关闭：macOS 交由原生交通灯接管，仅非 macOS 显示自绘按钮 -->
        <template v-if="!isMac">
          <button class="mr-titlebar-btn" title="最小化" @click="minimize">
            <i class="iconfont icon-minisize"></i>
          </button>
          <button class="mr-titlebar-btn mr-titlebar-btn-close" title="关闭" @click="handleClose">
            <i class="iconfont icon-close"></i>
          </button>
        </template>
      </template>
    </div>
  </div>

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showCloseModal"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="showCloseModal = false"
      >
        <div
          class="relative w-[360px] transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all dark:bg-dark-100 border border-neutral-200 dark:border-neutral-800"
        >
          <!-- Close Icon -->
          <button
            class="absolute top-4 right-4 p-1 rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors focus:outline-none"
            @click="showCloseModal = false"
          >
            <i class="ri-close-line text-xl leading-none"></i>
          </button>

          <h3 class="text-lg font-bold leading-6 text-neutral-900 dark:text-white mb-2">
            {{ t('comp.titleBar.closeApp') }}
          </h3>
          <div class="mt-2">
            <p class="text-sm text-neutral-500 dark:text-neutral-400">
              {{ t('comp.titleBar.closeTitle') }}
            </p>
          </div>

          <div
            class="mt-4 flex w-fit cursor-pointer items-center gap-2 group"
            @click="rememberChoice = !rememberChoice"
          >
            <div
              class="relative flex h-5 w-5 items-center justify-center transition-colors duration-200"
              :class="
                rememberChoice
                  ? 'text-primary'
                  : 'text-neutral-400 group-hover:text-neutral-500 dark:text-neutral-500 dark:group-hover:text-neutral-400'
              "
            >
              <i
                class="text-xl"
                :class="
                  rememberChoice ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'
                "
              ></i>
            </div>
            <span
              class="select-none text-xs text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-300"
              :class="{ 'text-neutral-800 dark:text-neutral-200': rememberChoice }"
            >
              {{ t('comp.titleBar.rememberChoice') }}
            </span>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              class="rounded-full px-4 py-2 text-sm font-medium text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 transition-colors focus:outline-none"
              @click="showCloseModal = false"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              class="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 transition-colors focus:outline-none"
              @click="handleAction('close')"
            >
              {{ t('comp.titleBar.exitApp') }}
            </button>
            <button
              class="rounded-full bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary-pressed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors shadow-lg shadow-primary/20"
              @click="handleAction('minimize')"
            >
              {{ t('comp.titleBar.minimizeToTray') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSettingsStore } from '@/store/modules/settings';
import { isElectron } from '@/utils';

const { t } = useI18n();

// 窗口失焦时，品牌名与 mini 按钮跟随原生交通灯一起变灰（但保持可见）
const isWindowFocused = ref(true);
const handleWindowFocus = () => {
  isWindowFocused.value = true;
};
const handleWindowBlur = () => {
  isWindowFocused.value = false;
};

onMounted(() => {
  isWindowFocused.value = document.hasFocus();
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('blur', handleWindowBlur);
});

onUnmounted(() => {
  window.removeEventListener('focus', handleWindowFocus);
  window.removeEventListener('blur', handleWindowBlur);
});

// macOS 使用原生交通灯按钮，隐藏自绘的最小化/关闭按钮与标题文字
const isMac = isElectron && window.electron.ipcRenderer.sendSync('get-platform') === 'darwin';

const settingsStore = useSettingsStore();
const showCloseModal = ref(false);
const rememberChoice = ref(false);

const openDownloadPage = () => {
  if (!isElectron) {
    window.open('https://github.com/AriesChenL/AriesMusicPlayer/releases', '_blank');
  }
};

const minimize = () => {
  if (!isElectron) {
    return;
  }
  window.api.minimize();
};

const handleAction = (action: 'minimize' | 'close') => {
  if (rememberChoice.value) {
    settingsStore.setSetData({
      ...settingsStore.setData,
      closeAction: action
    });
  }

  if (action === 'minimize') {
    showCloseModal.value = false;
    setTimeout(() => {
      window.api.miniTray();
    }, 200);
  } else {
    // Fix: Use quitApp instead of close to ensure app exits on macOS
    window.api.quitApp();
    showCloseModal.value = false;
  }
};

const handleClose = () => {
  const { closeAction } = settingsStore.setData;

  if (closeAction === 'minimize') {
    window.api.miniTray();
  } else if (closeAction === 'close') {
    window.api.close();
  } else {
    showCloseModal.value = true;
  }
};

const drag = (event: MouseEvent) => {
  if (!isElectron) {
    return;
  }
  window.api.dragStart(event as unknown as string);
};
</script>

<style scoped lang="scss">
/* ===== 玻璃标题栏（设计稿 titlebar，46px） ===== */
.mr-titlebar {
  height: 46px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 18px;
  position: relative;
  background: var(--titlebar);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--line);
  -webkit-app-region: drag;
  z-index: 3000;

  /* macOS 原生交通灯位于左上角，留出空间 */
  &.is-mac {
    padding-left: 80px;
  }
}

.mr-titlebar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text2);
  letter-spacing: 0.3px;
  transition: opacity 0.2s ease;
}

/* 失焦时：品牌名与按钮变灰（与原生交通灯一致），但仍可见 */
.mr-titlebar.is-blur .mr-titlebar-title,
.mr-titlebar.is-blur .mr-titlebar-buttons {
  opacity: 0.45;
}

.mr-titlebar-flex {
  flex: 1;
}

.mr-titlebar-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
  -webkit-app-region: no-drag;
  transition: opacity 0.2s ease;
}

.mr-titlebar-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.18s ease;
  font-size: 17px;

  &:hover {
    background: var(--elev);
    color: var(--text);
  }

  &.mr-titlebar-btn-close:hover {
    background: #ff5f57;
    color: #fff;
  }
}
</style>
