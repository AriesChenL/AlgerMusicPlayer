/**
 * 音源解析编排器
 *
 * 合并历史上分散在 getSongUrl（hooks/usePlayerHooks.ts）与 MusicParser
 * （api/musicParser.ts）两处的降级逻辑，统一为单一编排：
 *
 *  - resolvePlayback：完整链路（自定义 API 优先 → 官方/第三方 → 试听回退），供播放/下载
 *  - resolveThirdParty：仅第三方级联（含 custom），供用户手动「换音源重解析」
 *
 * 行为等价要点（与旧实现保持一致）：
 *  1. 自定义 API 始终最优先，且不受「音乐解析总开关」enableMusicUnblock 约束
 *  2. 有歌曲级音源配置时，第三方先于官方；否则官方先于第三方
 *  3. lx/gd/unblock 第三方级联受 enableMusicUnblock 约束
 *  4. 官方仅返回试听片段且第三方全失败时，按 enableTrialFallback 回退到试听片段
 *  5. 试听回退结果不写入 URL 缓存
 */

import i18n from '@/../i18n/renderer';
import { SongSourceConfigManager } from '@/services/SongSourceConfigManager';
import { useSettingsStore } from '@/store';
import type { Platform, SongResult } from '@/types/music';
import { isElectron } from '@/utils';
import requestMusic from '@/utils/request_music';

import { ResolveCache } from './cache';
import {
  customProvider,
  gdmusicProvider,
  lxProvider,
  neteaseProvider,
  unblockProvider
} from './providers';
import type { MusicProvider, ResolveContext, ResolveFailReason, ResolveResult } from './types';
import { ResolveError, toTrackMeta } from './types';

interface ResolveOptions {
  forDownload?: boolean;
  signal?: AbortSignal;
}

const THIRD_PARTY: MusicProvider[] = [lxProvider, gdmusicProvider, unblockProvider].sort(
  (a, b) => a.priority - b.priority
);

const buildContext = (
  id: number,
  song: SongResult,
  opts: ResolveOptions
): {
  ctx: ResolveContext;
  hasSongConfig: boolean;
  enableUnblock: boolean;
  enableTrialFallback: boolean;
} => {
  const settingsStore = useSettingsStore();
  const setData = settingsStore.setData || ({} as any);

  const songConfig = SongSourceConfigManager.getConfig(id);
  const sources: Platform[] = songConfig?.sources?.length
    ? songConfig.sources
    : setData.enabledMusicSources || [];

  const ctx: ResolveContext = {
    track: toTrackMeta(id, song),
    quality: setData.musicQuality || 'higher',
    sources,
    customApiPlugin: setData.customApiPlugin,
    forDownload: opts.forDownload,
    signal: opts.signal
  };

  return {
    ctx,
    hasSongConfig: Boolean(songConfig),
    // 与旧 MusicParser 一致：未显式开启即视为关闭第三方解灰
    enableUnblock: Boolean(setData.enableMusicUnblock),
    enableTrialFallback: setData.enableTrialFallback !== false
  };
};

const ensureNotAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    const err = new Error('Request cancelled');
    err.name = 'AbortError';
    throw err;
  }
};

/** 执行单个 provider，带失败缓存。返回结果或 null */
const tryProvider = async (
  provider: MusicProvider,
  ctx: ResolveContext
): Promise<ResolveResult | null> => {
  if (!provider.canHandle(ctx)) return null;
  if (ResolveCache.isFailed(ctx.track.id, provider.name)) return null;

  ensureNotAborted(ctx.signal);
  try {
    const result = await provider.resolve(ctx);
    ensureNotAborted(ctx.signal);
    if (result?.url) return result;
    ResolveCache.markFailed(ctx.track.id, provider.name);
    return null;
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    console.error(`[resolveEngine] provider ${provider.name} 异常:`, error);
    ResolveCache.markFailed(ctx.track.id, provider.name);
    return null;
  }
};

/** 非 Electron 环境后备：直接请求远端 /music 接口 */
const fallbackWebMusic = async (id: number): Promise<ResolveResult | null> => {
  try {
    const res = await requestMusic.get<any>('/music', { params: { id } });
    const d = res?.data?.data;
    if (d?.url) return { url: d.url, provider: 'fallback', source: 'fallback', raw: d };
  } catch (error) {
    console.error('[resolveEngine] 后备 /music 请求失败:', error);
  }
  return null;
};

/**
 * 第三方级联（lx/gd/unblock），带 URL 结果缓存。
 * @param providers 参与级联的 provider（默认 THIRD_PARTY；reparse 时额外含 custom）
 */
const runThirdParty = async (
  ctx: ResolveContext,
  enableUnblock: boolean,
  providers: MusicProvider[] = THIRD_PARTY
): Promise<ResolveResult | null> => {
  if (!isElectron) return fallbackWebMusic(ctx.track.id);

  // 命中缓存直接返回
  const cached = await ResolveCache.get(ctx.track.id, ctx.quality, ctx.sources);
  if (cached?.url) return cached;

  // 与旧 MusicParser 一致：解析总开关关闭时直接返回（不走远端 /music 兜底）
  if (!enableUnblock) return null;

  for (const provider of providers) {
    const result = await tryProvider(provider, ctx);
    if (result?.url) {
      await ResolveCache.set(ctx.track.id, result, ctx.quality, ctx.sources);
      return result;
    }
  }

  // 与旧 MusicParser 一致：第三方全失败（或无可用音源）时回退远端 /music 接口
  return fallbackWebMusic(ctx.track.id);
};

/**
 * 完整解析链路。返回原始解析结果（含 url），磁盘缓存解析由调用方完成。
 */
export const resolvePlayback = async (
  id: number,
  song: SongResult,
  opts: ResolveOptions = {}
): Promise<ResolveResult | null> => {
  const { ctx, hasSongConfig, enableUnblock, enableTrialFallback } = buildContext(id, song, opts);

  // 1) 自定义 API 始终最优先，不受 enableMusicUnblock 约束
  const custom = await tryProvider(customProvider, ctx);
  if (custom?.url) {
    await ResolveCache.set(ctx.track.id, custom, ctx.quality, ctx.sources);
    return custom;
  }

  let trialCandidate: ResolveResult | null = null;

  const runNetease = async (): Promise<ResolveResult | null> => {
    const r = await tryProvider(neteaseProvider, ctx);
    if (r?.url && !r.isTrial) return r;
    if (r?.isTrial) trialCandidate = r; // 试听不作为成功结果，暂存备用
    return null;
  };

  if (hasSongConfig) {
    // 歌曲级音源：第三方优先，官方其后
    const tp = await runThirdParty(ctx, enableUnblock);
    if (tp?.url) return tp;
    const ne = await runNetease();
    if (ne?.url) return ne;
  } else {
    // 全局：官方优先，第三方其后
    const ne = await runNetease();
    if (ne?.url) return ne;
    const tp = await runThirdParty(ctx, enableUnblock);
    if (tp?.url) return tp;
  }

  // 2) 全部失败：按开关回退到官方试听片段（不缓存）
  if (trialCandidate && enableTrialFallback) {
    console.log('[resolveEngine] 全部解析失败，回退到官方试听片段');
    return trialCandidate;
  }

  // 3) 彻底失败：抛出带原因的错误，供上层弹出精准提示
  let reason: ResolveFailReason;
  if (trialCandidate) {
    // 官方仅返回试听片段（VIP 歌曲），但试听回退已关闭且无其他可用音源
    reason = 'vipNoSource';
  } else if (!enableUnblock) {
    reason = 'unblockDisabled';
  } else if (ctx.sources.length === 0) {
    reason = 'noSource';
  } else {
    reason = 'allFailed';
  }
  throw new ResolveError(reason, i18n.global.t(`player.resolveFail.${reason}`));
};

/**
 * 仅第三方级联（含 custom），供「换音源重新解析」使用。
 * 等价于旧 MusicParser.parseMusic 的第三方部分。
 */
export const resolveThirdParty = async (
  id: number,
  song: SongResult
): Promise<ResolveResult | null> => {
  const { ctx, enableUnblock } = buildContext(id, song, {});
  const providers = [customProvider, ...THIRD_PARTY].sort((a, b) => a.priority - b.priority);
  return runThirdParty(ctx, enableUnblock, providers);
};
