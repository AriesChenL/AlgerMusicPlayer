/**
 * 音源 provider 集合
 *
 * - netease：官方网易云，渲染进程调本地 NeteaseCloudMusicApi（耦合 token / 拦截器）
 * - lx：落雪音源，渲染进程 Web Worker 沙箱
 * - gdmusic / custom / unblock：下沉主进程，经 IPC `music:resolve`
 *
 * 失败缓存由 {@link MusicResolveEngine} 统一管理，provider 内部不重复处理。
 */

import { getLxMusicRunner, initLxMusicRunner } from '@/services/LxMusicSourceRunner';
import { useSettingsStore, useUserStore } from '@/store';
import type { LxMusicInfo, LxQuality, LxSourceKey } from '@/types/lxMusic';
import { QUALITY_TO_LX } from '@/types/lxMusic';
import request from '@/utils/request';

import type { MusicProvider, ResolveContext, ResolveResult } from './types';

// ==================== 官方网易云 ====================

export const neteaseProvider: MusicProvider = {
  name: 'netease',
  priority: 2,
  canHandle: () => true,
  async resolve(ctx: ResolveContext): Promise<ResolveResult | null> {
    const userStore = useUserStore();
    const level = ctx.quality || 'higher';
    const encodeType = ctx.quality === 'lossless' ? 'aac' : 'flac';

    // VIP 下载走 download/url 接口
    if (ctx.forDownload && userStore.user && userStore.user.vipType !== 0) {
      try {
        const res = await request.get('/song/download/url/v1', {
          params: {
            id: ctx.track.id,
            level,
            encodeType,
            cookie: `${localStorage.getItem('token')} os=pc;`
          }
        });
        const d = res?.data?.data;
        if (d?.url) {
          return {
            url: d.url,
            provider: 'netease',
            source: '网易云',
            br: d.br,
            type: d.type,
            isTrial: !!d.freeTrialInfo,
            raw: d
          };
        }
      } catch (error) {
        console.error('[netease] download/url 失败:', error);
      }
    }

    const { data } = await request.get('/song/url/v1', {
      params: { id: ctx.track.id, level, encodeType }
    });
    const detail = data?.data?.[0];
    if (!detail || !detail.url) return null;
    return {
      url: detail.url,
      provider: 'netease',
      source: '网易云',
      br: detail.br,
      type: detail.type,
      isTrial: !!detail.freeTrialInfo,
      raw: detail
    };
  }
};

// ==================== 落雪音源（渲染 Worker 沙箱） ====================

const LX_SOURCE_PRIORITY: LxSourceKey[] = ['wy', 'kw', 'mg', 'kg', 'tx'];

const toLxMusicInfo = (ctx: ResolveContext): LxMusicInfo => {
  const { track } = ctx;
  const singer = track.artists
    .map((a) => a.name)
    .filter(Boolean)
    .join('、');
  const ms = track.duration || 0;
  const interval = `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(
    Math.floor((ms % 60000) / 1000)
  ).padStart(2, '0')}`;
  return {
    songmid: track.id,
    name: track.name,
    singer,
    album: track.album.name,
    albumId: track.album.id || '',
    source: 'wy',
    interval,
    img: track.picUrl || ''
  };
};

/** 部分落雪脚本返回的是 API 端点而非直链，做一次 HEAD/GET 解析 */
const resolveLxAudioUrl = async (url: string): Promise<string> => {
  try {
    const isApiEndpoint = url.includes('/api/') || (url.includes('?') && url.includes('type=url'));
    if (!isApiEndpoint) return url;

    const head = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    if (head.status >= 300 && head.status < 400) {
      const location = head.headers.get('Location');
      if (location) return location;
    }
    const res = await fetch(url, { redirect: 'follow' });
    const contentType = res.headers.get('Content-Type') || '';
    if (contentType.includes('audio/') || contentType.includes('application/octet-stream')) {
      return res.url;
    }
    if (contentType.includes('json')) {
      const json = await res.json();
      const audioUrl = json.url || json.data?.url || json.audio_url || json.link || json.src;
      if (typeof audioUrl === 'string' && audioUrl) return audioUrl;
    }
    return url;
  } catch {
    return url;
  }
};

/** 读取当前激活的落雪音源脚本内容 */
const getActiveLxScript = (): string | null => {
  const settingsStore = useSettingsStore();
  const activeId = settingsStore.setData?.activeLxMusicApiId;
  if (!activeId) return null;
  const scripts = settingsStore.setData?.lxMusicScripts || [];
  const active = scripts.find((s: any) => s.id === activeId);
  return active?.script || null;
};

/** 渲染进程 Web Worker 回退实现（主进程沙箱不可用/失败时使用） */
const resolveLxViaRenderer = async (
  ctx: ResolveContext,
  script: string
): Promise<ResolveResult | null> => {
  let runner = getLxMusicRunner();
  if (!runner || !runner.isInitialized()) {
    runner = await initLxMusicRunner(script);
  }

  const available = Object.keys(runner.getSources()) as LxSourceKey[];
  if (available.length === 0) return null;
  const source = LX_SOURCE_PRIORITY.find((s) => available.includes(s)) || available[0];

  const lxQuality: LxQuality = QUALITY_TO_LX[ctx.quality || 'higher'] || '320k';
  const rawUrl = await runner.getMusicUrl(source, toLxMusicInfo(ctx), lxQuality);
  if (!rawUrl) return null;

  const url = await resolveLxAudioUrl(rawUrl);
  if (!url) return null;
  return { url, provider: 'lx', source: `lx-${source}`, type: lxQuality };
};

export const lxProvider: MusicProvider = {
  name: 'lx',
  priority: 0,
  canHandle(ctx: ResolveContext): boolean {
    return ctx.sources.includes('lxMusic') && Boolean(getActiveLxScript());
  },
  async resolve(ctx: ResolveContext): Promise<ResolveResult | null> {
    const script = getActiveLxScript();
    if (!script) return null;

    // 1) 优先走主进程 worker_threads 沙箱
    if (window.api?.lxResolve) {
      try {
        const r = await window.api.lxResolve({
          script,
          musicInfo: toLxMusicInfo(ctx),
          quality: ctx.quality
        });
        if (r?.url) {
          const url = await resolveLxAudioUrl(r.url);
          if (url) return { url, provider: 'lx', source: r.source || 'lx', type: r.quality };
        }
      } catch (error) {
        console.warn('[lxProvider] 主进程沙箱解析失败，回退渲染进程:', error);
      }
    }

    // 2) 回退渲染进程 Web Worker
    return resolveLxViaRenderer(ctx, script);
  }
};

// ==================== 下沉主进程的 provider ====================

const mapMainResult = (
  raw: { url: string; source: string; br?: number; platform?: string } | null,
  provider: string
): ResolveResult | null => {
  if (!raw?.url) return null;
  return { url: raw.url, provider, source: raw.source || provider, br: raw.br, raw };
};

const callMain = (
  provider: 'gdmusic' | 'custom' | 'unblock',
  ctx: ResolveContext,
  extra: { sources?: string[]; customApiPlugin?: string } = {}
) => {
  // 非 Electron（web）环境没有主进程桥接
  if (!window.api?.musicResolve) return Promise.resolve(null);
  return window.api.musicResolve({
    provider,
    track: {
      id: ctx.track.id,
      name: ctx.track.name,
      artists: ctx.track.artists,
      album: ctx.track.album
    },
    quality: ctx.quality,
    ...extra
  });
};

export const customProvider: MusicProvider = {
  name: 'custom',
  priority: 1,
  canHandle(ctx: ResolveContext): boolean {
    return ctx.sources.includes('custom') && Boolean(ctx.customApiPlugin);
  },
  async resolve(ctx: ResolveContext): Promise<ResolveResult | null> {
    const raw = await callMain('custom', ctx, { customApiPlugin: ctx.customApiPlugin });
    return mapMainResult(raw, 'custom');
  }
};

export const gdmusicProvider: MusicProvider = {
  name: 'gdmusic',
  priority: 3,
  canHandle(ctx: ResolveContext): boolean {
    return ctx.sources.includes('gdmusic');
  },
  async resolve(ctx: ResolveContext): Promise<ResolveResult | null> {
    const raw = await callMain('gdmusic', ctx);
    return mapMainResult(raw, 'gdmusic');
  }
};

export const unblockProvider: MusicProvider = {
  name: 'unblock',
  priority: 4,
  canHandle(ctx: ResolveContext): boolean {
    // unblock 处理 custom / gdmusic / lxMusic 之外的平台（migu/kugou/kuwo/pyncmd/qq/joox）
    return ctx.sources.some((s) => !['custom', 'gdmusic', 'lxMusic'].includes(s));
  },
  async resolve(ctx: ResolveContext): Promise<ResolveResult | null> {
    const sources = ctx.sources.filter((s) => !['custom', 'gdmusic', 'lxMusic'].includes(s));
    const raw = await callMain('unblock', ctx, { sources });
    return mapMainResult(raw, 'unblock');
  }
};

/** 全部 provider（未排序） */
export const ALL_PROVIDERS: MusicProvider[] = [
  lxProvider,
  customProvider,
  neteaseProvider,
  gdmusicProvider,
  unblockProvider
];
