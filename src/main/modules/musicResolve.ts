/**
 * 主进程音源解析
 *
 * 把原本在渲染进程发起的第三方解析（GD 音乐台、自定义 API 插件）下沉到主进程，
 * 以使用 Node 的 http 能力、规避渲染进程 CORS、避免插件地址/密钥暴露在前端。
 * unblock 解灰本就在主进程，这里统一收口为单一 IPC 通道 `music:resolve`。
 *
 * 注意：官方网易云解析仍在渲染进程（强耦合 localStorage token 与 request 拦截器），
 * 落雪音源仍在渲染进程 Web Worker 沙箱，两者不在此处。
 */

import axios from 'axios';
import { ipcMain } from 'electron';
import { get } from 'lodash';

import { type Platform as UnblockPlatform, unblockMusic } from '../unblockMusic';

/** 主进程解析返回的统一结果 */
export interface MainResolveResult {
  url: string;
  source: string;
  br?: number;
  size?: number;
  platform?: string;
}

interface ResolveTrack {
  id: number;
  name: string;
  artists: Array<{ name: string }>;
  album?: { name?: string };
}

interface MainResolvePayload {
  provider: 'gdmusic' | 'custom' | 'unblock';
  track: ResolveTrack;
  quality: string;
  /** unblock 启用的平台列表 */
  sources?: string[];
  /** custom 插件 JSON 字符串 */
  customApiPlugin?: string;
}

// ==================== GD 音乐台 ====================

const GD_BASE_URL = 'https://music-api.gdstudio.xyz/api.php';
const GD_SOURCES = ['joox', 'tidal', 'netease'];

const buildSearchQuery = (track: ResolveTrack): string => {
  const artistNames = (track.artists || [])
    .map((a) => a?.name)
    .filter(Boolean)
    .join(' ');
  return `${track.name || ''} ${artistNames}`.trim();
};

const resolveGd = async (track: ResolveTrack): Promise<MainResolveResult | null> => {
  const searchQuery = buildSearchQuery(track);
  if (searchQuery.length < 2) {
    console.warn('[musicResolve] GD 搜索查询过短:', searchQuery);
    return null;
  }

  // GD 音乐台音质用数字档位，网易云档位无法直接映射，统一用最高档 999
  const gdQuality = '999';

  for (const source of GD_SOURCES) {
    try {
      const searchUrl = `${GD_BASE_URL}?types=search&source=${source}&name=${encodeURIComponent(
        searchQuery
      )}&count=1&pages=1`;
      const searchRes = await axios.get(searchUrl, { timeout: 5000 });
      const first = Array.isArray(searchRes.data) ? searchRes.data[0] : null;
      if (!first?.id) continue;

      const trackSource = first.source || source;
      const songUrl = `${GD_BASE_URL}?types=url&source=${trackSource}&id=${first.id}&br=${gdQuality}`;
      const songRes = await axios.get(songUrl, { timeout: 5000 });
      const data = songRes.data;
      if (data?.url) {
        return {
          url: String(data.url).replace(/\\/g, ''),
          source: 'gdmusic',
          br: parseInt(data.br, 10) * 1000 || 320000,
          size: data.size || 0,
          platform: 'gdmusic'
        };
      }
    } catch (error) {
      console.error(`[musicResolve] GD ${source} 解析失败:`, (error as Error).message);
    }
  }
  return null;
};

// ==================== 自定义 API 插件 ====================

interface CustomApiPlugin {
  name: string;
  apiUrl: string;
  method?: 'GET' | 'POST';
  params: Record<string, string>;
  qualityMapping?: Record<string, string>;
  responseUrlPath: string;
}

const resolveCustom = async (
  track: ResolveTrack,
  quality: string,
  pluginString?: string
): Promise<MainResolveResult | null> => {
  if (!pluginString) return null;

  let plugin: CustomApiPlugin;
  try {
    plugin = JSON.parse(pluginString);
  } catch (error) {
    console.error('[musicResolve] 自定义 API 插件 JSON 解析失败:', error);
    return null;
  }
  if (!plugin.apiUrl || !plugin.params || !plugin.responseUrlPath) {
    console.error('[musicResolve] 自定义 API 插件配置不完整');
    return null;
  }

  const finalParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(plugin.params)) {
    if (value === '{songId}') finalParams[key] = String(track.id);
    else if (value === '{quality}') finalParams[key] = plugin.qualityMapping?.[quality] ?? quality;
    else finalParams[key] = value;
  }

  try {
    const method = plugin.method?.toUpperCase() === 'POST' ? 'POST' : 'GET';
    const response =
      method === 'POST'
        ? await axios.post(plugin.apiUrl, finalParams, { timeout: 10000 })
        : await axios.get(plugin.apiUrl, { params: finalParams, timeout: 10000 });

    const musicUrl = get(response.data, plugin.responseUrlPath);
    if (musicUrl && typeof musicUrl === 'string') {
      return {
        url: musicUrl,
        source: plugin.name?.toLowerCase().replace(/\s/g, '') || 'custom',
        platform: plugin.name?.toLowerCase().replace(/\s/g, '') || 'custom'
        // 注意：不再用 parseInt(quality)*1000 计算 br（quality 为 'higher' 等字符串会得到 NaN）
      };
    }
    console.error('[musicResolve] 自定义 API 未在响应中找到 URL:', plugin.responseUrlPath);
    return null;
  } catch (error) {
    console.error(`[musicResolve] 自定义 API [${plugin.name}] 执行失败:`, (error as Error).message);
    return null;
  }
};

// ==================== unblock 解灰 ====================

const resolveUnblock = async (
  track: ResolveTrack,
  sources?: string[]
): Promise<MainResolveResult | null> => {
  try {
    const result = await unblockMusic(
      track.id,
      {
        name: track.name,
        artists: track.artists,
        album: { name: track.album?.name || '' }
      },
      1,
      sources as UnblockPlatform[] | undefined
    );
    const data = result?.data?.data;
    if (data?.url) {
      return {
        url: data.url,
        source: data.platform || 'unblock',
        br: data.br,
        size: data.size,
        platform: data.platform
      };
    }
    return null;
  } catch (error) {
    console.error('[musicResolve] unblock 解析失败:', (error as Error).message);
    return null;
  }
};

// ==================== IPC 注册 ====================

export const registerMusicResolve = (): void => {
  ipcMain.handle('music:resolve', async (_event, payload: MainResolvePayload) => {
    if (!payload?.provider || !payload?.track?.id) return null;
    try {
      switch (payload.provider) {
        case 'gdmusic':
          return await resolveGd(payload.track);
        case 'custom':
          return await resolveCustom(payload.track, payload.quality, payload.customApiPlugin);
        case 'unblock':
          return await resolveUnblock(payload.track, payload.sources);
        default:
          return null;
      }
    } catch (error) {
      console.error('[musicResolve] 解析异常:', error);
      return null;
    }
  });
};
