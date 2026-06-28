<template>
  <div class="user-page">
    <template v-if="infoLoading">
      <div
        class="left-skeleton flex-1 max-w-[600px] rounded-2xl overflow-hidden p-4 bg-light-200 dark:bg-dark-100"
      >
        <div class="flex flex-col gap-6">
          <div class="flex justify-between">
            <div class="h-8 w-32 skeleton-shimmer rounded-lg" />
            <div class="h-6 w-20 skeleton-shimmer rounded-lg" />
          </div>
          <div class="flex items-center gap-4">
            <div class="h-[50px] w-[50px] skeleton-shimmer rounded-full" />
            <div class="flex w-2/5 justify-around">
              <div v-for="i in 3" :key="i" class="flex flex-col items-center gap-1">
                <div class="h-5 w-8 skeleton-shimmer rounded-lg" />
                <div class="h-4 w-12 skeleton-shimmer rounded-lg" />
              </div>
            </div>
          </div>
          <div class="h-4 w-3/4 skeleton-shimmer rounded-lg" />
          <div class="mt-4 rounded-xl bg-light p-4 dark:bg-dark">
            <div class="mb-4 h-8 w-full skeleton-shimmer rounded-xl" />
            <div class="space-y-4">
              <div v-for="i in 5" :key="i" class="flex gap-3">
                <div class="h-[50px] w-[50px] skeleton-shimmer rounded-xl flex-shrink-0" />
                <div class="flex flex-1 flex-col justify-center gap-2">
                  <div class="h-4 w-1/2 skeleton-shimmer rounded-lg" />
                  <div class="h-3 w-1/3 skeleton-shimmer rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="!isMobile" class="right">
        <div class="title"><div class="h-8 w-32 skeleton-shimmer rounded-lg" /></div>
        <div class="rounded-2xl bg-light p-4 dark:bg-dark">
          <div class="space-y-2">
            <div
              v-for="i in 10"
              :key="i"
              class="flex items-center gap-4 rounded-2xl bg-light-100 p-2 dark:bg-dark-100"
            >
              <div class="h-10 w-10 skeleton-shimmer rounded-full flex-shrink-0" />
              <div class="h-10 w-10 skeleton-shimmer rounded-xl flex-shrink-0" />
              <div class="flex flex-1 flex-col gap-2">
                <div class="h-4 w-1/3 skeleton-shimmer rounded-lg" />
                <div class="h-3 w-1/4 skeleton-shimmer rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <div v-if="userDetail && user" class="user-content">
        <!-- LEFT: 个人资料 + 标签 + 歌单 -->
        <div class="left-col" :class="setAnimationClass('animate__fadeIn')">
          <!-- 个人横幅 -->
          <div class="profile-banner">
            <div class="banner-strip" :style="bannerStyle">
              <div class="banner-circle banner-circle-1"></div>
              <div class="banner-circle banner-circle-2"></div>
            </div>
            <div class="profile-main">
              <div class="profile-avatar">
                <img :src="getImgUrl(user.avatarUrl, '200y200')" alt="" />
              </div>
              <div class="profile-meta">
                <div class="profile-name-row">
                  <span class="profile-name">{{ user.nickname }}</span>
                  <span class="profile-lv">Lv.{{ userDetail.level }}</span>
                </div>
                <div class="profile-sign">{{ userDetail.profile.signature }}</div>
              </div>
              <div class="profile-actions">
                <span v-if="currentLoginType" class="login-type-pill">
                  {{ t('login.title.' + currentLoginType) }}
                </span>
              </div>
            </div>
            <div class="profile-stats">
              <div class="stat-item" @click="showFollowerList">
                <span class="stat-num">{{ userDetail.profile.followeds }}</span>
                <span class="stat-label">{{ t('user.profile.followers') }}</span>
              </div>
              <div class="stat-div"></div>
              <div class="stat-item" @click="showFollowList">
                <span class="stat-num">{{ userDetail.profile.follows }}</span>
                <span class="stat-label">{{ t('user.profile.following') }}</span>
              </div>
              <div class="stat-div"></div>
              <div class="stat-item stat-item--static">
                <span class="stat-num accent">{{ userDetail.level }}</span>
                <span class="stat-label">{{ t('user.profile.level') }}</span>
              </div>
            </div>
          </div>

          <!-- 分段标签 -->
          <div class="seg-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              class="seg-tab"
              :style="tabStyle(tab.key)"
              @click="currentTab = tab.key"
            >
              {{ t(tab.label) }}
            </button>
          </div>

          <!-- 歌单列表 -->
          <div class="pl-list">
            <n-scrollbar>
              <div
                v-if="albumLoading && currentTab === 'album'"
                class="flex h-32 items-center justify-center"
              >
                <n-spin size="medium" />
              </div>
              <div v-else class="pl-list-inner">
                <button
                  v-if="isElectron && currentTab === 'created'"
                  class="pl-import"
                  @click="goToImportPlaylist"
                >
                  <span class="pl-import-icon">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                  <span class="pl-import-text">{{ t('comp.playlist.import.button') }}</span>
                </button>
                <div
                  v-for="(item, index) in currentList"
                  :key="index"
                  class="pl-item"
                  @click="handleItemClick(item)"
                >
                  <n-image
                    class="pl-thumb"
                    :src="getImgUrl(getCoverUrl(item), '100y100')"
                    lazy
                    preview-disabled
                  />
                  <div class="pl-info">
                    <div class="pl-name">
                      <n-ellipsis :line-clamp="1">{{ item.name }}</n-ellipsis>
                    </div>
                    <div class="pl-count">{{ getItemDescription(item) }}</div>
                  </div>
                  <span v-if="currentTab === 'created' && item.specialType === 5" class="pl-badge">
                    默认
                  </span>
                </div>
                <play-bottom />
              </div>
            </n-scrollbar>
          </div>
        </div>

        <!-- RIGHT: 听歌排行 -->
        <div v-if="!isMobile" class="right-col" :class="setAnimationClass('animate__fadeIn')">
          <div class="rank-header">
            <span class="rank-title">{{ t('user.ranking.title') }}</span>
            <span class="rank-total">累计 {{ recordList.length }} 首</span>
          </div>
          <div class="rank-list">
            <n-scrollbar>
              <div class="rank-list-inner">
                <div
                  v-for="(item, index) in recordList"
                  :key="item.id"
                  class="rank-item"
                  :class="setAnimationClass('animate__bounceInUp')"
                  :style="setAnimationDelay(index, 25)"
                  @click="playRecord(item)"
                >
                  <span class="rank-num" :class="{ accent: index < 3 }">{{ index + 1 }}</span>
                  <n-image
                    class="rank-thumb"
                    :src="getImgUrl(item.picUrl, '100y100')"
                    lazy
                    preview-disabled
                  />
                  <div class="rank-info">
                    <div class="rank-name">{{ item.name }}</div>
                    <div class="rank-artist">{{ recordArtist(item) }}</div>
                  </div>
                  <button
                    class="rank-btn"
                    :class="{ liked: isLiked(item) }"
                    @click.stop="toggleLike(item)"
                  >
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      :fill="isLiked(item) ? 'currentColor' : 'none'"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        d="M12 20.5S3 14.7 3 8.9C3 6 5.2 4 7.8 4c1.7 0 3.2.9 4.2 2.3C13 4.9 14.5 4 16.2 4 18.8 4 21 6 21 8.9c0 5.8-9 11.6-9 11.6z"
                      />
                    </svg>
                  </button>
                  <button class="rank-btn rank-btn-play" @click.stop="playRecord(item)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5.5v13l11-6.5z" />
                    </svg>
                  </button>
                </div>
                <play-bottom />
              </div>
            </n-scrollbar>
          </div>
        </div>
      </div>
    </template>
    <!-- 未登录时显示登录组件 -->
    <div
      v-if="!isLoggedIn && isMobile"
      class="login-container"
      :class="setAnimationClass('animate__fadeIn')"
    >
      <login-component @login-success="handleLoginSuccess" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getUserAlbumSublist, getUserDetail, getUserPlaylist, getUserRecord } from '@/api/user';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import PlayBottom from '@/components/common/PlayBottom.vue';
import { useFavoriteStore } from '@/store/modules/favorite';
import { usePlayerStore } from '@/store/modules/player';
import { useUserStore } from '@/store/modules/user';
import { getImgUrl, isElectron, isMobile, setAnimationClass, setAnimationDelay } from '@/utils';
import { checkLoginStatus as checkAuthStatus } from '@/utils/auth';
import LoginComponent from '@/views/login/index.vue';

defineOptions({
  name: 'User'
});

const { t } = useI18n();
const userStore = useUserStore();
const playerStore = usePlayerStore();
const favoriteStore = useFavoriteStore();
const router = useRouter();
const { userDetail, recordList } = storeToRefs(userStore);
const infoLoading = ref(false);
const albumLoading = ref(false);
const mounted = ref(true);
const message = useMessage();

// Tab 相关
const tabs = [
  { key: 'created', label: 'user.tabs.created' },
  { key: 'favorite', label: 'user.tabs.favorite' },
  { key: 'album', label: 'user.tabs.album' }
];
const currentTab = ref('created');

const user = computed(() => userStore.user);

// 创建的歌单（当前用户创建的）
const createdPlaylists = computed(() => {
  if (!user.value) return [];
  return userStore.playList.filter((item) => item.creator?.userId === user.value!.userId);
});

// 收藏的歌单（当前用户收藏的）
const favoritePlaylists = computed(() => {
  if (!user.value) return [];
  return userStore.playList.filter((item) => item.creator?.userId !== user.value!.userId);
});

// 当前显示的列表（根据 tab 切换）
const currentList = computed(() => {
  if (currentTab.value === 'album') {
    return userStore.albumList;
  }
  return currentTab.value === 'created' ? createdPlaylists.value : favoritePlaylists.value;
});

// 获取封面图片 URL
const getCoverUrl = (item: any) => {
  return item.coverImgUrl || item.picUrl || '';
};

// 获取列表项描述
const getItemDescription = (item: any) => {
  if (currentTab.value === 'album') {
    // 专辑：显示艺术家和歌曲数量
    const artist = item.artist?.name || '';
    const size = item.size ? ` · ${item.size}首` : '';
    return `${artist}${size}`;
  } else {
    // 歌单：显示曲目数和播放量
    return `${t('user.playlist.trackCount', { count: item.trackCount })}，${t('user.playlist.playCount', { count: item.playCount })}`;
  }
};

// ===== 设计稿样式辅助 =====
// 个人横幅：有背景图用图，否则用设计稿渐变
const bannerStyle = computed(() => {
  const url = user.value?.backgroundUrl ? getImgUrl(user.value.backgroundUrl, '800y300') : '';
  return url
    ? `background-image:url(${url});background-size:cover;background-position:center;`
    : 'background:linear-gradient(120deg,var(--accent) 0%,var(--accent2) 48%,#2a4a6c 100%);';
});
// 分段标签激活/未激活配色
const tabStyle = (key: string) =>
  currentTab.value === key
    ? 'background:var(--accent);color:var(--accentText);'
    : 'background:transparent;color:var(--text2);';
// 听歌排行的歌手名
const recordArtist = (item: any) =>
  ((item.ar || item.song?.ar || []) as any[]).map((a) => a.name).join(' / ');

// 统一处理列表项点击
const handleItemClick = (item: any) => {
  if (currentTab.value === 'album') {
    openAlbum(item);
  } else {
    openPlaylist(item);
  }
};

const goToImportPlaylist = () => {
  router.push('/playlist/import');
};

onBeforeUnmount(() => {
  mounted.value = false;
});

// 检查登录状态
const checkLoginStatus = () => {
  // userStore 的状态已经在 App.vue 中全局初始化，这里只需要检查
  if (userStore.user && userStore.loginType) {
    return true;
  }

  // 如果还是没有登录信息，跳转到登录页
  const loginInfo = checkAuthStatus();
  if (!loginInfo.isLoggedIn) {
    !isMobile.value && router.push('/login');
    return false;
  }

  return true;
};

const loadPage = async () => {
  if (!mounted.value) return;

  // 检查登录状态
  if (!checkLoginStatus()) return;

  await loadData();
};

const loadData = async () => {
  try {
    // 只有在没有数据时才显示加载状态
    if (!userDetail.value || !recordList.value?.length) {
      infoLoading.value = true;
    }

    if (!user.value) {
      console.warn('用户数据不存在，尝试重新获取');
      // 可以尝试重新获取用户数据
      return;
    }

    // 如果 store 中还没有数据，则加载
    const promises = [getUserDetail(user.value.userId), getUserRecord(user.value.userId)];

    if (userStore.playList.length === 0) {
      promises.push(getUserPlaylist(user.value.userId));
    }

    const results = await Promise.all(promises);

    if (!mounted.value) return;

    userDetail.value = results[0].data;
    recordList.value = results[1].data.allData.map((item: any) => ({
      ...item,
      ...item.song,
      picUrl: item.song.al.picUrl
    }));

    // 如果加载了歌单，更新 store
    if (results.length > 2 && results[2].data?.playlist) {
      userStore.playList = results[2].data.playlist;
    }
  } catch (error: any) {
    console.error('加载用户页面失败:', error);
    if (error.response?.status === 401) {
      userStore.handleLogout();
      router.push('/login');
    } else {
      // 添加更多错误处理和重试逻辑
      message.error(t('user.message.loadFailed'));
    }
  } finally {
    if (mounted.value) {
      infoLoading.value = false;
    }
  }
};

// 加载专辑列表
const loadAlbumList = async () => {
  // 如果 store 中已经有数据，直接返回
  if (userStore.albumList.length > 0) {
    return;
  }

  try {
    albumLoading.value = true;
    const res = await getUserAlbumSublist({ limit: 100, offset: 0 });
    if (!mounted.value) return;
    // 更新 store 中的专辑列表
    userStore.albumList = res.data.data || [];
  } catch (error: any) {
    console.error('加载专辑列表失败:', error);
    message.error('加载专辑列表失败');
  } finally {
    if (mounted.value) {
      albumLoading.value = false;
    }
  }
};

// 监听路由变化
watch(
  () => router.currentRoute.value.path,
  (newPath) => {
    console.log('newPath', newPath);
    if (newPath === '/user') {
      checkLoginStatus();
      loadData();
    }
  }
);

// 监听用户状态变化
watch(
  () => userStore.user,
  (newUser) => {
    if (!mounted.value) return;
    if (newUser) {
      checkLoginStatus();
      loadPage();
    }
  }
);

// 监听 tab 切换
watch(currentTab, async (newTab) => {
  if (newTab === 'album') {
    // 刷新收藏专辑列表到 store
    await userStore.initializeCollectedAlbums();
    // 如果 store 中列表为空，则加载
    if (userStore.albumList.length === 0) {
      loadAlbumList();
    }
  }
});

// 页面挂载时检查登录状态
onMounted(() => {
  checkLoginStatus() && loadData();
});

// 替换显示歌单的方法
const openPlaylist = (item: any) => {
  navigateToMusicList(router, {
    id: item.id,
    type: 'playlist',
    name: item.name,
    listInfo: item,
    canRemove: true // 保留可移除功能
  });
};

// 打开专辑
const openAlbum = async (item: any) => {
  navigateToMusicList(router, {
    id: item.id,
    type: 'album',
    name: item.name,
    listInfo: {
      ...item,
      coverImgUrl: item.picUrl || item.coverImgUrl
    },
    canRemove: false // 专辑不支持移除歌曲
  });
};

// 播放听歌排行中指定的一首
const playRecord = (item: any) => {
  playerStore.setPlayList(recordList.value || []);
  playerStore.setPlay(item);
};

// 收藏/取消收藏
const isLiked = (item: any) => favoriteStore.isFavorite(item.id);
const toggleLike = (item: any) => {
  if (favoriteStore.isFavorite(item.id)) {
    favoriteStore.removeFromFavorite(item.id);
  } else {
    favoriteStore.addToFavorite(item.id);
  }
};

// 显示关注列表
const showFollowList = () => {
  if (!user.value) return;
  router.push('/user/follows');
};

// 显示粉丝列表
const showFollowerList = () => {
  if (!user.value) return;
  router.push('/user/followers');
};

const handleLoginSuccess = () => {
  // 处理登录成功后的逻辑
  checkLoginStatus();
  loadData();
};

const isLoggedIn = computed(() => userStore.user);
const currentLoginType = computed(() => userStore.loginType);
</script>

<style lang="scss" scoped>
/* ===== 1:1 还原设计稿「我的」页 ===== */
.user-page {
  @apply flex h-full;
  padding-left: var(--page-pl);
  padding-right: var(--page-pr);
}

.user-content {
  flex: 1;
  display: flex;
  min-height: 0;
  gap: 20px;
  padding-bottom: 18px;
  width: 100%;
}

/* ---- 左侧 ---- */
.left-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.profile-banner {
  position: relative;
  border-radius: var(--rc);
  overflow: hidden;
  flex: none;
  background: var(--panel);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
}

.banner-strip {
  height: 96px;
  position: relative;
}

.banner-circle {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.banner-circle-1 {
  top: -30px;
  right: 60px;
  width: 150px;
  height: 150px;
  background: rgba(255, 255, 255, 0.1);
}
.banner-circle-2 {
  bottom: -40px;
  right: 160px;
  width: 120px;
  height: 120px;
  background: rgba(255, 255, 255, 0.07);
}

.profile-main {
  padding: 0 24px 20px;
  display: flex;
  align-items: flex-end;
  gap: 18px;
  margin-top: -40px;
  position: relative;
}

.profile-avatar {
  width: 84px;
  height: 84px;
  border-radius: 24px;
  flex: none;
  overflow: hidden;
  background: linear-gradient(140deg, #79c6ff, #2f6488);
  box-shadow:
    0 8px 20px -6px rgba(0, 0, 0, 0.4),
    0 0 0 4px var(--panel);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.profile-meta {
  flex: 1;
  min-width: 0;
  padding-bottom: 2px;
}
.profile-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.profile-name {
  font-size: 21px;
  font-weight: 800;
  color: var(--text);
}
.profile-lv {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--accentSoft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  flex: none;
}
.profile-sign {
  font-size: 12.5px;
  color: var(--text3);
  margin-top: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-actions {
  display: flex;
  gap: 9px;
  flex: none;
  padding-bottom: 2px;
}
.login-type-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: 999px;
  background: var(--accentSoft);
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.profile-stats {
  display: flex;
  gap: 8px;
  padding: 0 24px 20px;
}
.stat-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  cursor: pointer;

  &--static {
    cursor: default;
  }
}
.stat-num {
  font-size: 18px;
  font-weight: 800;
  color: var(--text);
  &.accent {
    color: var(--accent);
  }
}
.stat-label {
  font-size: 12px;
  color: var(--text3);
}
.stat-div {
  width: 1px;
  background: var(--line2);
  margin: 2px 14px;
}

/* 分段标签 */
.seg-tabs {
  display: flex;
  gap: 4px;
  margin-top: 16px;
  flex: none;
  padding: 5px;
  border-radius: 14px;
  background: var(--panel2);
  border: 1px solid var(--line);
  align-self: flex-start;
}
.seg-tab {
  padding: 8px 26px;
  border: none;
  cursor: pointer;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 600;
  font-family: inherit;
  transition: all 0.18s ease;
}

/* 歌单列表 */
.pl-list {
  flex: 1;
  min-height: 0;
  margin-top: 14px;
}
.pl-list-inner {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pl-import {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 11px 12px;
  border-radius: var(--rb);
  cursor: pointer;
  border: 1px dashed var(--line2);
  background: transparent;
  font-family: inherit;
  text-align: left;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--accentLine);
    background: var(--accentSoft);
  }
}
.pl-import-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--panel2);
  color: var(--accent);
}
.pl-import-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.pl-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 12px;
  border-radius: var(--rb);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: var(--elev);
  }
}
.pl-thumb {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  flex: none;
  overflow: hidden;
  :deep(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
.pl-info {
  flex: 1;
  min-width: 0;
}
.pl-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.pl-count {
  font-size: 12px;
  color: var(--text3);
  margin-top: 3px;
}
.pl-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--accentSoft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  flex: none;
}

/* ---- 右侧：听歌排行 ---- */
.right-col {
  width: 420px;
  flex: none;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.rank-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex: none;
  margin-bottom: 14px;
}
.rank-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text);
}
.rank-total {
  font-size: 12px;
  color: var(--text3);
}
.rank-list {
  flex: 1;
  min-height: 0;
}
.rank-list-inner {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rank-item {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 9px 12px;
  border-radius: var(--rb);
  cursor: pointer;
  background: var(--panel);
  border: 1px solid var(--line);
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--accentLine);
  }
}
.rank-num {
  font-size: 15px;
  font-weight: 800;
  color: var(--text3);
  width: 26px;
  flex: none;
  font-variant-numeric: tabular-nums;
  text-align: center;
  &.accent {
    color: var(--accent);
  }
}
.rank-thumb {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  flex: none;
  overflow: hidden;
  :deep(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
.rank-info {
  flex: 1;
  min-width: 0;
}
.rank-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rank-artist {
  font-size: 12px;
  color: var(--text3);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rank-btn {
  width: 32px;
  height: 32px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.15s ease;

  &:hover {
    background: var(--elev);
    color: var(--accent);
  }

  &.liked {
    color: var(--accent);
  }

  &.rank-btn-play {
    background: var(--accentSoft);
    color: var(--accent);

    &:hover {
      background: var(--accent);
      color: var(--accentText);
    }
  }
}

/* 移动端 / 登录态 */
.mobile {
  .user-page {
    padding-left: var(--page-pl);
    padding-right: var(--page-pr);
  }
  .login-container {
    @apply flex justify-center items-center h-full w-full;
  }
}
</style>
