<template>
  <div class="app-container h-full w-full" :class="{ mobile: isMobile, noElectron: !isElectron }">
    <n-config-provider
      :theme="theme === 'dark' ? darkTheme : lightTheme"
      :theme-overrides="theme === 'dark' ? darkThemeOverrides : lightThemeOverrides"
    >
      <n-dialog-provider>
        <n-message-provider>
          <router-view></router-view>
          <traffic-warning-drawer v-if="!isElectron"></traffic-warning-drawer>
        </n-message-provider>
      </n-dialog-provider>
    </n-config-provider>
  </div>
</template>

<script setup lang="ts">
import { cloneDeep } from 'lodash';
import { darkTheme, type GlobalThemeOverrides, lightTheme } from 'naive-ui';
import { computed, nextTick, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import TrafficWarningDrawer from '@/components/TrafficWarningDrawer.vue';
import { usePlayerStore } from '@/store/modules/player';
import { usePlayerCoreStore } from '@/store/modules/playerCore';
import { useSettingsStore } from '@/store/modules/settings';
import { useUserStore } from '@/store/modules/user';
import { isElectron, isLyricWindow } from '@/utils';
import { checkLoginStatus } from '@/utils/auth';

import { initAudioListeners, initMusicHook } from './hooks/MusicHook';
import { audioService } from './services/audioService';
import { initLxMusicRunner } from './services/LxMusicSourceRunner';
import { isMobile } from './utils';
import { useAppShortcuts } from './utils/appShortcuts';

// naive-ui 主题覆盖：蓝色强调色（与 --accent 令牌一致）与深海军蓝面板
const PRIMARY = '#307fb6';
const PRIMARY_HOVER = '#3f8dc5';
const PRIMARY_PRESSED = '#005b90';

const commonThemeOverrides: GlobalThemeOverrides['common'] = {
  primaryColor: PRIMARY,
  primaryColorHover: PRIMARY_HOVER,
  primaryColorPressed: PRIMARY_PRESSED,
  primaryColorSuppl: PRIMARY_HOVER,
  // 绑定到圆角令牌，使设置里的「圆角风格」对所有 naive-ui 组件生效
  borderRadius: 'var(--rb)',
  borderRadiusSmall: 'var(--rs)'
};

const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    ...commonThemeOverrides,
    bodyColor: '#eef5fb',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    tableColor: '#ffffff',
    inputColor: '#f0f6fc',
    borderColor: 'rgba(0,57,107,.15)'
  }
};

const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    ...commonThemeOverrides,
    bodyColor: '#060b18',
    cardColor: '#0c1426',
    modalColor: '#0c1426',
    popoverColor: '#111a30',
    tableColor: '#0c1426',
    inputColor: '#111a30',
    borderColor: 'rgba(255,255,255,.11)'
  }
};

const { locale } = useI18n();
const settingsStore = useSettingsStore();
const playerStore = usePlayerStore();
const playerCoreStore = usePlayerCoreStore();
const userStore = useUserStore();
const router = useRouter();

// 监听语言变化
watch(
  () => settingsStore.setData.language,
  (newLanguage) => {
    if (newLanguage && newLanguage !== locale.value) {
      locale.value = newLanguage;
    }
  },
  { immediate: true }
);

const theme = computed(() => {
  return settingsStore.theme;
});

// 监听字体变化并应用
watch(
  () => [settingsStore.setData.fontFamily, settingsStore.setData.fontScope],
  ([newFont, fontScope]) => {
    const appElement = document.body;
    if (newFont && fontScope === 'global') {
      appElement.style.fontFamily = newFont;
    } else {
      appElement.style.fontFamily = '';
    }
  }
);

// 监听音源解析相关设置变化：使播放列表中已解析的 URL 失效，确保修改立即生效
// （URL 结果缓存已由 engine 的 configKey 指纹自动失效，此处处理歌曲对象上的 playMusicUrl）
watch(
  () =>
    JSON.stringify([
      settingsStore.setData.enabledMusicSources,
      settingsStore.setData.musicQuality,
      settingsStore.setData.enableMusicUnblock,
      settingsStore.setData.enableTrialFallback,
      settingsStore.setData.customApiPlugin,
      settingsStore.setData.activeLxMusicApiId
    ]),
  async () => {
    const { usePlaylistStore } = await import('@/store/modules/playlist');
    usePlaylistStore().invalidateResolvedUrls();
  }
);

const handleSetLanguage = (value: string) => {
  console.log('应用语言变更:', value);
  if (value) {
    locale.value = value;
  }
};

if (!isLyricWindow.value) {
  settingsStore.initializeSettings();
  settingsStore.initializeTheme();
  settingsStore.initializeSystemFonts();

  // 初始化登录状态 - 从 localStorage 恢复用户信息和登录类型
  const loginInfo = checkLoginStatus();
  if (loginInfo.isLoggedIn) {
    if (loginInfo.user && !userStore.user) {
      userStore.setUser(loginInfo.user);
    }
    if (loginInfo.loginType && !userStore.loginType) {
      userStore.setLoginType(loginInfo.loginType);
    }
  }
}

handleSetLanguage(settingsStore.setData.language);

if (isElectron) {
  window.api.onLanguageChanged(handleSetLanguage);
}

// 使用应用内快捷键
useAppShortcuts();

onMounted(async () => {
  playerStore.setIsPlay(false);
  if (isLyricWindow.value) {
    return;
  }

  // 检查网络状态，离线时自动跳转到本地音乐页面
  if (!navigator.onLine) {
    router.push('/local-music');
  }

  // 监听网络状态变化，断网时跳转到本地音乐页面
  const handleOffline = () => {
    router.push('/local-music');
  };
  window.addEventListener('offline', handleOffline);
  onUnmounted(() => {
    window.removeEventListener('offline', handleOffline);
  });

  // 初始化 MusicHook，注入 playerStore
  initMusicHook(playerStore);
  // 设置 URL 过期自动续播处理器
  const { setupUrlExpiredHandler } = await import('@/services/playbackController');
  setupUrlExpiredHandler();
  // 初始化播放状态
  await playerStore.initializePlayState();

  // 初始化音频设备变化监听器
  playerCoreStore.initAudioDeviceListener();

  // 初始化落雪音源（如果有激活的音源）
  const activeLxApiId = settingsStore.setData?.activeLxMusicApiId;
  if (activeLxApiId) {
    const lxMusicScripts = settingsStore.setData?.lxMusicScripts || [];
    const activeScript = lxMusicScripts.find((script: any) => script.id === activeLxApiId);
    if (activeScript && activeScript.script) {
      try {
        console.log('[App] 初始化激活的落雪音源:', activeScript.name);
        await initLxMusicRunner(activeScript.script);
      } catch (error) {
        console.error('[App] 初始化落雪音源失败:', error);
      }
    }
  }

  // 如果有正在播放的音乐，则初始化音频监听器
  if (playerStore.playMusic && playerStore.playMusic.id) {
    // 使用 nextTick 确保 DOM 更新后再初始化
    await nextTick();
    initAudioListeners();
    if (isElectron) {
      window.api.sendSong(cloneDeep(playerStore.playMusic));
    }
  }

  audioService.releaseOperationLock();
});
</script>

<style lang="scss" scoped>
.app-container {
  user-select: none;
}

.mobile {
  .text-base {
    font-size: 14px !important;
  }
}

.html:has(.mobile) {
  font-size: 14px;
}
</style>
