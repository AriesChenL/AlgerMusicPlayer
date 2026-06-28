<template>
  <div>
    <!-- 侧边图标导航栏（设计稿 sidebar rail，严格 8 项 + 内联描边 SVG） -->
    <div class="app-menu" :class="{ 'app-menu-expanded': settingsStore.setData.isMenuExpanded }">
      <div class="app-menu-header">
        <div class="app-menu-logo" @click="toggleMenu">
          <svg class="app-menu-logo-mark" viewBox="4.65 3.2 113.6 113.6" fill="currentColor">
            <rect x="16" y="50" width="5.4" height="20" rx="2.7" />
            <rect x="25.5" y="42" width="5.4" height="36" rx="2.7" />
            <rect x="35" y="32" width="5.4" height="56" rx="2.7" />
            <rect x="44.5" y="44" width="5.4" height="32" rx="2.7" />
            <rect x="54" y="24" width="5.4" height="72" rx="2.7" />
            <rect x="63.5" y="38" width="5.4" height="44" rx="2.7" />
            <rect x="73" y="30" width="5.4" height="60" rx="2.7" />
            <rect x="82.5" y="44" width="5.4" height="32" rx="2.7" />
            <rect x="92" y="36" width="5.4" height="48" rx="2.7" />
            <rect x="101.5" y="50" width="5.4" height="20" rx="2.7" />
          </svg>
        </div>
        <span v-if="settingsStore.setData.isMenuExpanded" class="app-menu-logo-text">
          <span class="wm">Aries</span><span class="wm2">Music</span>
        </span>
        <button
          v-if="settingsStore.setData.isMenuExpanded"
          class="app-menu-chevron"
          title="收起"
          @click="toggleMenu"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
      </div>
      <div class="app-menu-list">
        <div v-for="item in navItems" :key="item.path" class="app-menu-item">
          <n-tooltip
            :delay="200"
            :disabled="settingsStore.setData.isMenuExpanded || isMobile"
            placement="right"
          >
            <template #trigger>
              <router-link
                class="app-menu-item-link"
                :class="{ active: isActive(item.path) }"
                :to="item.path"
              >
                <span class="app-menu-item-icon" v-html="item.icon"></span>
                <span v-if="settingsStore.setData.isMenuExpanded" class="app-menu-item-text ml-3">{{
                  item.label
                }}</span>
              </router-link>
            </template>
            <div v-if="!settingsStore.setData.isMenuExpanded">{{ item.label }}</div>
          </n-tooltip>
        </div>
      </div>
      <!-- 底部下载入口 -->
      <div v-if="!isMobile" class="app-menu-footer">
        <n-tooltip :delay="200" :disabled="settingsStore.setData.isMenuExpanded" placement="right">
          <template #trigger>
            <router-link class="app-menu-item-link app-menu-download" to="/downloads">
              <span class="app-menu-item-icon" v-html="downloadIcon"></span>
              <span v-if="settingsStore.setData.isMenuExpanded" class="app-menu-item-text ml-3">{{
                t('common.download')
              }}</span>
            </router-link>
          </template>
          <div v-if="!settingsStore.setData.isMenuExpanded">{{ t('common.download') }}</div>
        </n-tooltip>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import { useSettingsStore } from '@/store';
import { isMobile } from '@/utils';

// 设计稿侧栏 8 项 + 内联描边 SVG（viewBox 0 0 24 24，stroke-width 1.8，圆角线帽）
const svg = (inner: string) =>
  `<svg width="23" height="23" style="flex:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const navItems = [
  {
    path: '/',
    label: '主页',
    icon: svg('<path d="M4 11.4 12 5l8 6.4V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>')
  },
  {
    path: '/discover',
    label: '发现',
    icon: svg('<circle cx="12" cy="12" r="8"/><path d="m15 9-2.2 4L8.5 15l2.2-4z"/>')
  },
  {
    path: '/list',
    label: '歌单',
    icon: svg(
      '<path d="M4 7h12M4 12h12M4 17h8M18 16V8l3-1v8"/><circle cx="16.5" cy="16.5" r="1.6"/>'
    )
  },
  { path: '/toplist', label: '排行', icon: svg('<path d="M5 20v-7M10 20V5M15 20v-9M20 20v-5"/>') },
  {
    path: '/video',
    label: '视频',
    icon: svg(
      '<rect x="3" y="6" width="18" height="12" rx="3.5"/><path d="m11 9.7 4 2.3-4 2.3z" fill="currentColor"/>'
    )
  },
  {
    path: '/vip',
    label: '会员',
    icon: svg('<path d="m12 4 2.3 4.7 5.2.7-3.8 3.7.9 5.2L12 16.6l-4.6 2.4.9-5.2L4.5 10l5.2-.7z"/>')
  },
  {
    path: '/user',
    label: '我的',
    icon: svg('<circle cx="12" cy="9" r="3.2"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/>')
  },
  {
    path: '/set',
    label: '设置',
    icon: svg(
      '<circle cx="12" cy="12" r="3"/><path d="M12 4v2.5M12 17.5V20M4 12h2.5M17.5 12H20M6 6l1.8 1.8M16.2 16.2 18 18M18 6l-1.8 1.8M7.8 16.2 6 18"/>'
    )
  }
];

const downloadIcon = `<svg width="22" height="22" style="flex:none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v9m0 0 3.5-3.5M12 13l-3.5-3.5M5 18h14"/></svg>`;

const route = useRoute();
const settingsStore = useSettingsStore();

const { t } = useI18n();

// 直接基于响应式 route.path 判定高亮，避免 ref 间接层造成的过期
const isActive = (p: string) => {
  if (p === '/') return route.path === '/';
  return route.path === p || route.path.startsWith(`${p}/`);
};

const toggleMenu = () => {
  settingsStore.setSetData({
    isMenuExpanded: !settingsStore.setData.isMenuExpanded
  });
};
</script>

<style lang="scss" scoped>
/* ===== 桌面端侧边图标导航栏（设计稿 sidebar rail，78px） ===== */
.app-menu {
  width: 78px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 0;
  border-right: 1px solid var(--line);
  background: var(--panel);
  transition: width 0.3s ease;
}

.app-menu-header {
  flex: none;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-menu-logo {
  width: 42px;
  height: 42px;
  flex: none;
  border-radius: 13px;
  background: linear-gradient(140deg, var(--accent2), var(--accent));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--accentText);
  box-shadow: 0 6px 14px -4px var(--accentLine);
}

.app-menu-logo-mark {
  width: 26px;
  height: 26px;
  display: block;
}

.app-menu-list {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: 22px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 0;
  }
}

.app-menu-footer {
  flex: none;
  width: 100%;
  display: flex;
  justify-content: center;
  padding-top: 8px;
}

.app-menu-item {
  width: 100%;
  display: flex;
  justify-content: center;
}

.app-menu-item-link {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  color: var(--text3);
  transition: all 0.18s ease;

  &:hover {
    background: var(--elev);
    color: var(--text);
  }

  &.active {
    background: var(--accentSoft);
    color: var(--accent);
    font-weight: 600;
  }
}

.app-menu-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

/* ===== 展开态（设计稿 214px，显示字标 + 文字标签 + 收起箭头） ===== */
.app-menu-expanded {
  width: 214px;
  align-items: stretch;
  padding-left: 12px;
  padding-right: 12px;

  .app-menu-header {
    justify-content: flex-start;
    gap: 11px;
    padding: 0 4px;
  }

  .app-menu-logo-text {
    font-size: 16px;
    letter-spacing: -0.01em;
    white-space: nowrap;

    .wm {
      font-weight: 800;
      color: var(--text);
    }
    .wm2 {
      font-weight: 500;
      color: var(--text3);
      margin-left: 4px;
    }
  }

  .app-menu-chevron {
    width: 30px;
    height: 30px;
    flex: none;
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text3);
    border-radius: 9px;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      background: var(--elev);
      color: var(--text);
    }
  }

  .app-menu-item {
    justify-content: stretch;
  }

  .app-menu-item-link {
    width: 100%;
    height: 46px;
    justify-content: flex-start;
    padding: 0 13px;
    gap: 14px;
  }

  .app-menu-item-text {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
  }
}

/* ===== 移动端底部横向导航 ===== */
.mobile {
  .app-menu {
    max-width: 100%;
    width: 100vw;
    height: auto;
    flex-direction: row;
    position: relative;
    bottom: 0;
    left: 0;
    z-index: 99999;
    padding: 6px 0;
    border-right: none;
    border-top: 1px solid var(--line);
    background: var(--panel);

    &-header,
    &-footer {
      display: none;
    }

    &-list {
      flex-direction: row;
      justify-content: space-between;
      width: 100%;
      margin-top: 0;
      padding: 0 16px;
      gap: 0;
      max-height: none !important;
      overflow: visible !important;
    }

    &-item {
      width: auto;
    }

    &-expanded {
      width: 100%;
    }
  }
}
</style>
