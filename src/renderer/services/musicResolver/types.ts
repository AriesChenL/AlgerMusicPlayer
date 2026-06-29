/**
 * 音源解析统一契约
 *
 * 重构目标：用一套接口取代历史上散落的三种返回结构
 * （MusicParseResult / ParsedMusicResult / UnblockResult）以及
 * getSongUrl 与 MusicParser 两处重复的降级编排。
 *
 * 所有音源（官方网易云、unblock 解灰、GD 音乐台、自定义 API 插件、落雪音源）
 * 都实现 {@link MusicProvider}，由 {@link MusicResolveEngine} 统一编排。
 */

import type { Platform, SongResult } from '@/types/music';

/**
 * 解析所需的轻量歌曲元信息。
 * 从 SongResult 归一化而来，屏蔽 ar/artists、al/album 等历史字段差异，
 * 供各 provider（含主进程 provider，需可结构化克隆）直接使用。
 */
export interface TrackMeta {
  id: number;
  name: string;
  /** 归一化后的艺术家列表 */
  artists: Array<{ name: string }>;
  album: { name: string; id?: string | number };
  /** 时长（毫秒） */
  duration?: number;
  picUrl?: string;
  /** 透传原始 SongResult，供少数 provider 需要完整字段时使用（仅渲染进程内 provider） */
  raw?: SongResult;
}

/** 解析上下文：一次解析请求的全部输入 */
export interface ResolveContext {
  track: TrackMeta;
  /** 网易云音质等级：higher / exhigh / lossless 等 */
  quality: string;
  /** 本次解析启用的音源列表（已合并歌曲级与全局配置） */
  sources: Platform[];
  /** 取消信号；切歌时 abort 之前的解析 */
  signal?: AbortSignal;
  /** 自定义 API 插件 JSON 字符串（下沉到主进程 provider 时随 payload 传递） */
  customApiPlugin?: string;
  /** 是否为下载场景（影响官方 provider 走 download/url 接口） */
  forDownload?: boolean;
}

/** 单个 provider 的一次尝试结果 */
export interface ResolveResult {
  url: string;
  /** 编排器内部 provider 标识：netease / unblock / gdmusic / custom / lx */
  provider: string;
  /** 实际命中的平台/音源，如 migu、gdmusic、lx-wy、网易云 */
  source: string;
  /** 码率（bps），可选 */
  br?: number;
  /** 音频格式，如 flac / mp3，下载流程依赖此字段 */
  type?: string;
  /** 是否为试听片段（仅官方 provider 可能产出） */
  isTrial?: boolean;
  /** 透传原始解析数据，供下载流程兼容旧字段 */
  raw?: Record<string, any>;
}

/** 一次解析的尝试轨迹，用于可观测/排障 */
export interface AttemptTrace {
  provider: string;
  ok: boolean;
  ms: number;
  reason?: string;
}

/**
 * 解析失败原因，用于上层弹出精准提示：
 *  - noSource：开启了解析但未配置任何音源
 *  - unblockDisabled：歌曲无完整官方地址且「音源解析」总开关关闭
 *  - vipNoSource：VIP 歌曲（官方仅试听），无可用音源且未开启试听回退
 *  - allFailed：已启用音源但全部解析失败（无版权或网络异常）
 */
export type ResolveFailReason = 'noSource' | 'unblockDisabled' | 'vipNoSource' | 'allFailed';

/** 携带失败原因的解析错误；上层据 reason / message 弹出提示 */
export class ResolveError extends Error {
  readonly reason: ResolveFailReason;
  constructor(reason: ResolveFailReason, message: string) {
    super(message);
    this.name = 'ResolveError';
    this.reason = reason;
  }
}

/** 音源解析策略统一接口 */
export interface MusicProvider {
  /** 唯一标识，同时用于失败缓存的 key */
  readonly name: string;
  /** 越小越优先 */
  readonly priority: number;
  /**
   * 判断在当前上下文下该 provider 是否可用。
   * @param ctx 解析上下文
   */
  canHandle(ctx: ResolveContext): boolean;
  /**
   * 执行解析，成功返回结果，失败/不可用返回 null。
   * 实现方不应抛出业务错误（内部自行 try/catch），仅在取消时可抛 AbortError。
   */
  resolve(ctx: ResolveContext): Promise<ResolveResult | null>;
}

/**
 * 把 SongResult 归一化为 TrackMeta。
 * 兼容 ar/artists、al/album、dt/duration、picUrl/al.picUrl 等历史字段。
 */
export const toTrackMeta = (id: number, song: SongResult): TrackMeta => {
  const artists = song?.ar?.length
    ? song.ar.map((a) => ({ name: a.name }))
    : song?.song?.artists?.length
      ? song.song.artists.map((a) => ({ name: a.name }))
      : (song as any)?.artists?.length
        ? (song as any).artists.map((a: any) => ({ name: a?.name ?? '' }))
        : [];

  const album = {
    name: song?.al?.name || (song as any)?.album?.name || '',
    id: song?.al?.id || (song as any)?.album?.id
  };

  return {
    id,
    name: song?.name || '',
    artists,
    album,
    duration: (song as any)?.dt || (song as any)?.duration || 0,
    picUrl: song?.picUrl || song?.al?.picUrl || '',
    raw: song
  };
};
