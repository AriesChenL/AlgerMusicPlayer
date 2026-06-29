<template>
  <div class="flex items-center gap-2 pt-6 pb-4 page-padding">
    <!-- 返回按钮 + 页面标题（meta.back 详情页；搜索框为左对齐主元素）-->
    <div v-if="showBackButton && !isSearchExpanded" class="flex items-center gap-2 flex-shrink-0">
      <button class="back-btn" @click="goBack">
        <i class="ri-arrow-left-line" />
      </button>
      <transition name="nav-title">
        <span v-if="navTitleStore.isVisible" class="nav-page-title">
          {{ navTitleStore.title }}
        </span>
      </transition>
    </div>

    <!-- 搜索输入框（收起时固定宽，展开时 flex-1 撑满）-->
    <div class="search-wrap" :class="isSearchExpanded ? 'search-wrap--open' : 'search-wrap--idle'">
      <n-popover
        trigger="manual"
        placement="bottom-end"
        :show="showSuggestions"
        :show-arrow="false"
        style="margin-top: 6px"
        content-style="padding:0;border-radius:14px;overflow:hidden;box-shadow:var(--shadow);border:1px solid var(--line);"
        raw
      >
        <template #trigger>
          <div class="search-inner" :class="{ 'search-inner--focus': inputFocused }">
            <i class="iconfont icon-search search-icon-glyph" />
            <input
              ref="inputRef"
              v-model="searchValue"
              class="search-input"
              :placeholder="hotSearchKeyword"
              @input="handleInput(searchValue)"
              @keydown="handleKeydown"
              @focus="handleFocus"
              @blur="handleBlur"
            />
            <n-dropdown
              v-if="searchTypeOptions.length && isSearchExpanded"
              trigger="hover"
              :options="searchTypeOptions"
              @select="selectSearchType"
              @mousedown.prevent
            >
              <div class="type-chip" @mousedown.prevent>
                <span>{{
                  searchTypeOptions.find((i) => i.key === searchStore.searchType)?.label
                }}</span>
                <i class="iconfont icon-xiasanjiaoxing text-[10px]" />
              </div>
            </n-dropdown>
          </div>
        </template>
        <div class="suggestions-box">
          <n-scrollbar style="max-height: 260px">
            <div v-if="suggestionsLoading" class="suggest-loading">
              <n-spin size="small" />
            </div>
            <div
              v-for="(s, i) in suggestions"
              :key="i"
              class="suggest-row"
              :class="{ 'suggest-row--hi': i === highlightedIndex }"
              @mousedown.prevent="selectSuggestion(s)"
              @mouseenter="highlightedIndex = i"
            >
              <i class="ri-search-line suggest-icon" />
              <span>{{ s }}</span>
            </div>
          </n-scrollbar>
        </div>
      </n-popover>
    </div>

    <!-- ── SPACER（搜索收起时撑开间距，按钮靠右）─────────────── -->
    <div v-if="!isSearchExpanded" class="flex-1" />

    <!-- 下载按钮 -->
    <button v-if="showDownloadButton" class="action-btn" @click="navigateToDownloads">
      <n-badge :value="downloadingCount" :max="99" :show="downloadingCount > 0" :offset="[-2, 2]">
        <i class="ri-download-cloud-2-line" />
      </n-badge>
    </button>

    <!-- 心动模式按钮 -->
    <n-tooltip v-if="showIntelligenceBtn" trigger="hover">
      <template #trigger>
        <button
          class="action-btn"
          :class="{ 'intelligence-active': isIntelligenceMode }"
          @click="toggleIntelligenceMode"
        >
          <i class="ri-heart-pulse-line" />
        </button>
      </template>
      {{
        isIntelligenceMode
          ? t('comp.searchBar.exitIntelligence')
          : t('comp.searchBar.intelligenceMode')
      }}
    </n-tooltip>

    <!-- 用户 -->
    <n-popover trigger="hover" placement="bottom-end" :show-arrow="false" raw>
      <template #trigger>
        <div class="user-btn">
          <n-avatar
            v-if="userStore.user"
            circle
            :size="26"
            :src="getImgUrl(userStore.user.avatarUrl)"
            class="cursor-pointer"
            @click="selectItem('user')"
          />
          <span v-else class="login-label" @click="toLogin">{{ t('comp.searchBar.login') }}</span>
        </div>
      </template>
      <div class="user-menu">
        <div v-if="userStore.user" class="user-menu-top" @click="selectItem('user')">
          <n-avatar circle :size="30" :src="getImgUrl(userStore.user?.avatarUrl)" />
          <span class="user-name">{{ userStore.user?.nickname }}</span>
        </div>
        <div v-if="userStore.user" class="menu-sep" />
        <div class="menu-list">
          <div v-if="!userStore.user" class="menu-row" @click="toLogin">
            <i class="ri-login-box-line" /><span>{{ t('comp.searchBar.toLogin') }}</span>
          </div>
          <div v-if="userStore.user" class="menu-row" @click="selectItem('logout')">
            <i class="ri-logout-box-r-line" /><span>{{ t('comp.searchBar.logout') }}</span>
          </div>
          <div class="menu-row" @click="selectItem('set')">
            <i class="ri-settings-3-line" /><span>{{ t('comp.searchBar.set') }}</span>
          </div>
          <div v-if="isElectron" class="menu-row">
            <i class="ri-zoom-in-line" /><span>{{ t('comp.searchBar.zoom') }}</span>
            <div class="zoom-ctrl ml-auto">
              <button class="zoom-btn" @click.stop="decreaseZoom">
                <i class="ri-subtract-line" />
              </button>
              <n-tooltip trigger="hover">
                <template #trigger>
                  <span
                    class="zoom-val"
                    :class="{ 'zoom-val--100': isZoom100() }"
                    @click.stop="resetZoom"
                  >
                    {{ Math.round(zoomFactor * 100) }}%
                  </span>
                </template>
                {{ isZoom100() ? t('comp.searchBar.zoom100') : t('comp.searchBar.resetZoom') }}
              </n-tooltip>
              <button class="zoom-btn" @click.stop="increaseZoom"><i class="ri-add-line" /></button>
            </div>
          </div>
          <div class="menu-row">
            <i :class="isDark ? 'ri-moon-line' : 'ri-sun-line'" />
            <span>{{ t('comp.searchBar.theme') }}</span>
            <n-switch v-model:value="isDark" class="ml-auto" size="small">
              <template #checked><i class="ri-moon-line text-[10px]" /></template>
              <template #unchecked><i class="ri-sun-line text-[10px]" /></template>
            </n-switch>
          </div>
          <div class="menu-row" @click="restartApp">
            <i class="ri-restart-line" /><span>{{ t('comp.searchBar.restart') }}</span>
          </div>
          <div class="menu-row" @click="selectItem('refresh')">
            <i class="ri-refresh-line" /><span>{{ t('comp.searchBar.refresh') }}</span>
          </div>
          <div class="menu-sep" />
          <div class="menu-row" @click="toGithubRelease">
            <i class="ri-github-fill" /><span>{{ t('comp.searchBar.currentVersion') }}</span>
            <span class="ver-chip ml-auto">{{ updateInfo.currentVersion }}</span>
            <n-tag v-if="updateInfo.hasUpdate" type="success" size="small" class="ml-1">New</n-tag>
          </div>
        </div>
      </div>
    </n-popover>

    <!-- GitHub -->
    <button class="action-btn" @click="toGithub">
      <i class="ri-github-fill" />
    </button>
  </div>
</template>

<script lang="ts" setup>
import { useDebounceFn } from '@vueuse/core';
import { computed, onMounted, ref, watch, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getSearchKeyword } from '@/api/home';
import { getUserDetail } from '@/api/login';
import { getSearchSuggestions } from '@/api/search';
import { SEARCH_TYPES, USER_SET_OPTIONS } from '@/const/bar-const';
import { useZoom } from '@/hooks/useZoom';
import { useDownloadStore } from '@/store/modules/download';
import { useIntelligenceModeStore } from '@/store/modules/intelligenceMode';
import { useNavTitleStore } from '@/store/modules/navTitle';
import { useSearchStore } from '@/store/modules/search';
import { useSettingsStore } from '@/store/modules/settings';
import { useUserStore } from '@/store/modules/user';
import { getImgUrl, isElectron } from '@/utils';
import { checkUpdate, UpdateResult } from '@/utils/update';

import config from '../../../../package.json';

const router = useRouter();
const navTitleStore = useNavTitleStore();
const searchStore = useSearchStore();
const settingsStore = useSettingsStore();
const userStore = useUserStore();
const userSetOptions = ref(USER_SET_OPTIONS);
const { t, locale } = useI18n();

const intelligenceModeStore = useIntelligenceModeStore();
const downloadStore = useDownloadStore();
const downloadingCount = computed(() => downloadStore.downloadingCount);
const navigateToDownloads = () => {
  router.push('/downloads');
};
const showDownloadButton = computed(
  () =>
    isElectron && (settingsStore.setData?.alwaysShowDownloadButton || downloadingCount.value > 0)
);
const { zoomFactor, initZoomFactor, increaseZoom, decreaseZoom, resetZoom, isZoom100 } = useZoom();

// ── 心动模式 ─────────────────────────────────────────
const isIntelligenceMode = computed(() => intelligenceModeStore.isIntelligenceMode);
const showIntelligenceBtn = computed(() => userStore.user && userStore.loginType === 'cookie');
const toggleIntelligenceMode = async () => {
  if (isIntelligenceMode.value) {
    intelligenceModeStore.clearIntelligenceMode();
  } else {
    await intelligenceModeStore.playIntelligenceMode();
  }
};

// ── Back button ───────────────────────────────────────
const showBackButton = computed(() => {
  const meta = router.currentRoute.value.meta;
  if (!settingsStore.isMobile && meta.isMobile === false) return false;
  return meta.back === true;
});
const goBack = () => router.back();

// ── Search expand / collapse ──────────────────────────
const isSearchExpanded = ref(false);
const inputFocused = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

const handleFocus = () => {
  inputFocused.value = true;
  isSearchExpanded.value = true;
  if (searchValue.value && suggestions.value.length) showSuggestions.value = true;
};
const handleBlur = () => {
  inputFocused.value = false;
  setTimeout(() => {
    showSuggestions.value = false;
    isSearchExpanded.value = false;
  }, 150);
};

// ── Search logic ──────────────────────────────────────
const hotSearchKeyword = ref(t('comp.searchBar.searchPlaceholder'));
const hotSearchValue = ref('');
const searchValue = ref('');

watch(
  () => searchStore.searchValue,
  (v) => {
    if (v) searchValue.value = v;
  },
  { immediate: true }
);

const search = () => {
  const val = searchValue.value;
  if (!val) {
    searchValue.value = hotSearchValue.value;
    return;
  }
  const q = { keyword: val, type: searchStore.searchType };
  if (router.currentRoute.value.path === '/search-result') {
    searchStore.searchValue = val;
    router.replace({ path: '/search-result', query: q });
  } else {
    router.push({ path: '/search-result', query: q });
  }
  showSuggestions.value = false;
};

const selectSearchType = (key: number) => {
  searchStore.searchType = key;
  if (searchValue.value)
    router.push({ path: '/search-result', query: { keyword: searchValue.value, type: key } });
  nextTick(() => inputRef.value?.focus());
};

const rawSearchTypes = ref(SEARCH_TYPES);
const searchTypeOptions = computed(() => {
  locale.value;
  return rawSearchTypes.value
    .filter(() => isElectron)
    .map((type) => ({ label: t(type.label), key: type.key }));
});

const suggestions = ref<string[]>([]);
const showSuggestions = ref(false);
const suggestionsLoading = ref(false);
const highlightedIndex = ref(-1);

const debouncedSuggest = useDebounceFn(async (kw: string) => {
  if (!kw.trim()) {
    suggestions.value = [];
    showSuggestions.value = false;
    return;
  }
  suggestionsLoading.value = true;
  suggestions.value = await getSearchSuggestions(kw);
  suggestionsLoading.value = false;
  showSuggestions.value = suggestions.value.length > 0;
  highlightedIndex.value = -1;
}, 300);

const handleInput = (v: string) => debouncedSuggest(v);

const selectSuggestion = (s: string) => {
  searchValue.value = s;
  showSuggestions.value = false;
  search();
};

const handleKeydown = (e: KeyboardEvent) => {
  const len = suggestions.value.length;
  if (!showSuggestions.value || !len) {
    if (e.key === 'Enter') search();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightedIndex.value = (highlightedIndex.value + 1) % len;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightedIndex.value = (highlightedIndex.value - 1 + len) % len;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    highlightedIndex.value >= 0
      ? selectSuggestion(suggestions.value[highlightedIndex.value])
      : search();
  }
  if (e.key === 'Escape') {
    showSuggestions.value = false;
  }
};

// ── User / misc ───────────────────────────────────────
const loadHotSearch = async () => {
  const { data } = await getSearchKeyword();
  hotSearchKeyword.value = data.data.showKeyword;
  hotSearchValue.value = data.data.realkeyword;
};
const loadPage = async () => {
  if (!localStorage.getItem('token')) return;
  const { data } = await getUserDetail();
  userStore.user =
    data.profile || userStore.user || JSON.parse(localStorage.getItem('user') || '{}');
  localStorage.setItem('user', JSON.stringify(userStore.user));
};
loadPage();
watchEffect(() => {
  userSetOptions.value = userStore.user
    ? USER_SET_OPTIONS
    : USER_SET_OPTIONS.filter((i) => i.key !== 'logout');
});

const restartApp = () => window.electron.ipcRenderer.send('restart');
const toLogin = () => router.push('/user');
const toGithub = () =>
  window.open('https://github.com/AriesChenL/AriesMusicPlayer/releases', '_blank');
const toGithubRelease = () => {
  window.location.href = 'https://github.com/AriesChenL/AriesMusicPlayer/releases';
};

const isDark = computed({
  get: () => settingsStore.theme === 'dark',
  set: () => settingsStore.toggleTheme()
});

const selectItem = (key: string) => {
  switch (key) {
    case 'logout':
      userStore.handleLogout();
      break;
    case 'set':
      router.push('/set');
      break;
    case 'user':
      router.push('/user');
      break;
    case 'refresh':
      window.location.reload();
      break;
  }
};

const updateInfo = ref<UpdateResult>({
  hasUpdate: false,
  latestVersion: '',
  currentVersion: config.version,
  releaseInfo: null
});
const checkForUpdates = async () => {
  try {
    const r = await checkUpdate(config.version);
    if (r) updateInfo.value = r;
  } catch (e) {
    void e; // 更新检查失败时静默处理
  }
};

onMounted(() => {
  loadHotSearch();
  loadPage();
  checkForUpdates();
  isElectron && initZoomFactor();
});
</script>

<style scoped>
/* ── Back button ─────────────────────────────────────── */
.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  border: 1px solid var(--line2);
  background: transparent;
  color: #6b7280;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
}
.dark .back-btn {
  border-color: var(--line2);
  color: #9ca3af;
}
.back-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
}

/* ── Search wrap ─────────────────────────────────────── */
.search-wrap {
  transition:
    flex 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.search-wrap--idle {
  flex: 1 1 0%;
  max-width: 560px;
}
.search-wrap--open {
  flex: 1 1 0%;
  max-width: 9999px;
}

/* 复刻设计稿全局搜索框 */
.search-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--panel2);
  transition:
    border-color 0.18s ease,
    background 0.18s ease;
}
.search-inner:hover,
.search-inner--focus {
  border-color: var(--accentLine);
}

.search-icon-glyph {
  font-size: 17px;
  color: var(--text3);
  flex-shrink: 0;
  transition: color 0.18s ease;
}
.search-inner--focus .search-icon-glyph {
  color: var(--accent);
}

.search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  font-family: inherit;
  color: var(--text);
}
.search-input::placeholder {
  color: var(--text3);
}

.type-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--text2);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease;
  flex-shrink: 0;
}
.type-chip:hover {
  color: var(--accent);
}

/* ── Action buttons ──────────────────────────────────── */
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  border: 1px solid var(--line2);
  background: transparent;
  color: #6b7280;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.15s;
}
.dark .action-btn {
  border-color: var(--line2);
  color: #9ca3af;
}
.action-btn:hover {
  color: var(--accent);
  border-color: var(--accentLine);
  background: var(--accentSoft);
}
.dark .action-btn:hover {
  border-color: var(--accentLine);
  background: var(--accentSoft);
  color: var(--accent);
}
.action-btn.intelligence-active {
  color: #ec4899;
  border-color: #fbcfe8;
  background: #fdf2f8;
}
.dark .action-btn.intelligence-active {
  color: #ec4899;
  border-color: #831843;
  background: rgba(236, 72, 153, 0.1);
}

/* ── User button ─────────────────────────────────────── */
.user-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 2px;
  border-radius: 9999px;
  border: 1px solid var(--line2);
  background: transparent;
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.dark .user-btn {
  border-color: var(--line2);
}
.user-btn:hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accentSoft);
}

.login-label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  padding: 0 8px;
}
.dark .login-label {
  color: #9ca3af;
}

/* ── User menu ───────────────────────────────────────── */
.user-menu {
  min-width: 220px;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #f3f4f6;
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.1),
    0 1px 4px rgba(0, 0, 0, 0.05);
}
.dark .user-menu {
  background: #111827;
  border-color: #1f2937;
}

.user-menu-top {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 14px 10px;
  cursor: pointer;
  transition: background 0.15s;
}
.user-menu-top:hover {
  background: #f9fafb;
}
.dark .user-menu-top:hover {
  background: #1f2937;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dark .user-name {
  color: #f3f4f6;
}

.menu-sep {
  height: 1px;
  background: #f3f4f6;
  margin: 2px 0;
}
.dark .menu-sep {
  background: #1f2937;
}

.menu-list {
  padding: 3px 0 5px;
}

.menu-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  font-size: 13px;
  color: var(--line2);
  cursor: pointer;
  transition: background 0.12s;
}
.dark .menu-row {
  color: #d1d5db;
}
.menu-row:hover {
  background: #f9fafb;
}
.dark .menu-row:hover {
  background: #1f2937;
}

.menu-row i {
  font-size: 15px;
  color: #9ca3af;
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.zoom-ctrl {
  display: flex;
  align-items: center;
  gap: 3px;
}
.zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: none;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.12s;
}
.zoom-btn:hover {
  background: var(--accentSoft);
  color: var(--accent);
}
.zoom-val {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f3f4f6;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.12s;
}
.zoom-val--100 {
  background: var(--accentSoft);
  color: var(--accent);
}
.ver-chip {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 5px;
  background: #f3f4f6;
  color: #6b7280;
}
.dark .ver-chip {
  background: #1f2937;
  color: #9ca3af;
}

/* ── Suggestions（对齐设计稿 token 体系）──────────────── */
.suggestions-box {
  background: var(--panel);
}

.suggest-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  font-size: 14px;
  color: var(--text2);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
.suggest-row:hover,
.suggest-row--hi {
  background: var(--accentSoft);
  color: var(--accent);
}
.suggest-icon {
  font-size: 15px;
  color: var(--text3);
  flex-shrink: 0;
}
.suggest-loading {
  display: flex;
  justify-content: center;
  padding: 12px;
}

/* ── Nav page title ──────────────────────────────────── */
.nav-page-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
  letter-spacing: -0.01em;
}
.dark .nav-page-title {
  color: #f9fafb;
}

/* ── Transitions ─────────────────────────────────────── */
.nav-title-enter-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}
.nav-title-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.nav-title-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.nav-title-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
