/**
 * 兼容层（历史路径 `@/api/musicParser`）
 *
 * 解析逻辑已迁移至 `@/services/musicResolver`（统一契约 + 单一编排器）。
 * 本文件仅保留向后兼容的导出：
 *  - MusicParseResult：旧的解析结果结构，仍被 api/music.ts 的 getParsingMusicUrl 适配使用
 *  - CacheManager：缓存清理 API，仍被 ReparsePopover 等调用
 */

export { CacheManager } from '@/services/musicResolver/cache';

/** 旧解析结果结构（保留以兼容调用方对 res.data.data.url 的读取） */
export interface MusicParseResult {
  data: {
    code: number;
    message: string;
    data?: {
      url: string;
      [key: string]: any;
    };
  };
}
