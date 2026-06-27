<template>
  <div>
    <!-- 侧边图标导航栏（设计稿 sidebar rail） -->
    <div class="app-menu" :class="{ 'app-menu-expanded': settingsStore.setData.isMenuExpanded }">
      <div class="app-menu-header">
        <div class="app-menu-logo" @click="toggleMenu">
          <img :src="icon" class="app-menu-logo-img" alt="logo" />
        </div>
      </div>
      <div class="app-menu-list">
        <div v-for="(item, index) in menus" :key="item.path" class="app-menu-item">
          <n-tooltip
            :delay="200"
            :disabled="settingsStore.setData.isMenuExpanded || isMobile"
            placement="right"
          >
            <template #trigger>
              <router-link
                class="app-menu-item-link"
                :class="{ active: isChecked(index) }"
                :to="item.path"
              >
                <i class="iconfont app-menu-item-icon" :class="item.meta.icon"></i>
                <span v-if="settingsStore.setData.isMenuExpanded" class="app-menu-item-text ml-3">{{
                  t(item.meta.title)
                }}</span>
              </router-link>
            </template>
            <div v-if="!settingsStore.setData.isMenuExpanded">{{ t(item.meta.title) }}</div>
          </n-tooltip>
        </div>
      </div>
      <!-- 底部下载入口 -->
      <div v-if="!isMobile" class="app-menu-footer">
        <n-tooltip :delay="200" :disabled="settingsStore.setData.isMenuExpanded" placement="right">
          <template #trigger>
            <router-link class="app-menu-item-link app-menu-download" to="/downloads">
              <i class="iconfont ri-download-2-line app-menu-item-icon"></i>
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
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import icon from '@/assets/icon.png';
import { useSettingsStore } from '@/store';
import { isMobile } from '@/utils';

const props = defineProps({
  size: {
    type: String,
    default: '26px'
  },
  color: {
    type: String,
    default: '#aaa'
  },
  selectColor: {
    type: String,
    default: '#e08a3c'
  },
  menus: {
    type: Array as any,
    default: () => []
  }
});

const route = useRoute();
const path = ref(route.path);
const settingsStore = useSettingsStore();
watch(
  () => route.path,
  async (newParams) => {
    path.value = newParams;
  }
);

const { t } = useI18n();

const isChecked = (index: number) => {
  return path.value === props.menus[index].path;
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
  display: flex;
  align-items: center;
  justify-content: center;
}

.app-menu-logo {
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: linear-gradient(140deg, var(--accent2), var(--accent));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 6px 14px -4px var(--accentLine);
  overflow: hidden;
}

.app-menu-logo-img {
  width: 30px;
  height: 30px;
  object-fit: contain;
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
  }
}

.app-menu-item-icon {
  font-size: 23px;
  line-height: 1;
}

/* ===== 展开态（保留原有功能：显示文字标签） ===== */
.app-menu-expanded {
  width: 184px;
  align-items: stretch;
  padding-left: 14px;
  padding-right: 14px;

  .app-menu-header {
    justify-content: flex-start;
    padding-left: 4px;
  }

  .app-menu-item {
    justify-content: stretch;
  }

  .app-menu-item-link {
    width: 100%;
    justify-content: flex-start;
    padding: 0 14px;
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
