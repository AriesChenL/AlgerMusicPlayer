/**
 * 音源解析统一缓存层
 *
 * 取代历史上分散的两套渲染层缓存：
 *  - IndexedDB `music_url_cache`（成功 URL，30 分钟）
 *  - 内存 failedCacheMap（失败标记，1 分钟）
 *
 * 缓存有效性以「解析配置指纹」configKey 校验：音质、音源列表、解析总开关、
 * 试听回退、自定义 API 插件、激活的落雪脚本等任一改变都会使旧缓存失效，
 * 从而保证用户修改设置后立即生效（由 engine 统一计算 configKey 传入）。
 *
 * 注意：磁盘音频文件缓存（主进程 cache.ts）是另一层（缓存音频字节而非 URL），
 * 不在此处统一，由 resolveCachedPlaybackUrl 处理。
 */

import { cloneDeep } from 'lodash';

import { musicDB } from '@/hooks/MusicHook';

import type { ResolveResult } from './types';

const { saveData, getData, deleteData } = musicDB;

const CONFIG = {
  /** 成功 URL 缓存时间：30 分钟 */
  URL_TTL: 30 * 60 * 1000,
  /** 失败标记缓存时间：1 分钟 */
  FAILED_TTL: 60 * 1000
};

interface CachedEntry {
  id: number;
  result: ResolveResult;
  /** 解析配置指纹；与当前不一致则缓存失效 */
  configKey: string;
  createTime: number;
}

/** 内存失败缓存：key 为 `${id}_${provider}` */
const failedMap = new Map<string, number>();

export class ResolveCache {
  /** 读取成功 URL 缓存；解析配置变化或已过期则视为未命中 */
  static async get(id: number, configKey: string): Promise<ResolveResult | null> {
    try {
      const cached = (await getData('music_url_cache', id)) as CachedEntry | undefined;
      if (!cached?.createTime) return null;

      const expired = Date.now() - cached.createTime >= CONFIG.URL_TTL;
      if (expired || cached.configKey !== configKey) {
        await deleteData('music_url_cache', id);
        // 解析配置已变化：一并清除该歌的失败缓存，避免 1 分钟内被跳过导致设置不生效
        if (cached.configKey !== configKey) this.clearFailed(id);
        return null;
      }
      return cached.result;
    } catch (error) {
      console.warn('[ResolveCache] 读取缓存失败:', error);
      return null;
    }
  }

  /** 写入成功 URL 缓存。试听回退结果不应写入（由调用方控制） */
  static async set(id: number, result: ResolveResult, configKey: string): Promise<void> {
    try {
      const entry: CachedEntry = {
        id,
        result: cloneDeep(result),
        configKey,
        createTime: Date.now()
      };
      await saveData('music_url_cache', entry);
    } catch (error) {
      console.error('[ResolveCache] 写入缓存失败:', error);
    }
  }

  /** 是否处于某 provider 的失败缓存期内 */
  static isFailed(id: number, provider: string): boolean {
    const key = `${id}_${provider}`;
    const at = failedMap.get(key);
    if (at && Date.now() - at < CONFIG.FAILED_TTL) return true;
    if (at) failedMap.delete(key);
    return false;
  }

  /** 标记某 provider 解析失败 */
  static markFailed(id: number, provider: string): void {
    failedMap.set(`${id}_${provider}`, Date.now());
  }

  /** 清除某首歌的全部失败缓存 */
  static clearFailed(id: number): void {
    for (const key of [...failedMap.keys()]) {
      if (key.startsWith(`${id}_`)) failedMap.delete(key);
    }
  }

  /** 清除某首歌的全部缓存（URL + 失败标记） */
  static async clear(id: number): Promise<void> {
    this.clearFailed(id);
    try {
      await deleteData('music_url_cache', id);
    } catch (error) {
      console.error('[ResolveCache] 清除缓存失败:', error);
    }
  }
}

/**
 * 兼容旧 API：历史代码（如 ReparsePopover）通过
 * `import { CacheManager } from '@/api/musicParser'` 调用 clearMusicCache。
 * 保留同名静态方法，避免改动调用方。
 */
export class CacheManager {
  static async clearMusicCache(id: number): Promise<void> {
    await ResolveCache.clear(id);
  }

  static clearFailedCache(id: number): void {
    ResolveCache.clearFailed(id);
  }
}
