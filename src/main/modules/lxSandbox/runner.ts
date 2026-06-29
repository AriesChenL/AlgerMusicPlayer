/**
 * 落雪音源主进程运行器
 *
 * 负责管理 worker_threads 沙箱 worker 的生命周期，并对外暴露 IPC `lx:resolve`。
 * 任何环节失败（worker 加载失败 / 脚本为 ESM / 解析失败）都返回 null，
 * 由渲染进程的 lxProvider 回退到既有的渲染 Web Worker 实现。
 */

import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

import { ipcMain } from 'electron';

// 落雪音源类型（与 src/renderer/types/lxMusic.ts 保持一致，主进程侧内联避免跨边界 import）
type LxQuality = '128k' | '320k' | 'flac' | 'flac24bit';
type LxSourceKey = 'kw' | 'kg' | 'tx' | 'wy' | 'mg' | 'local';

interface LxSourceConfig {
  actions: ('musicUrl' | 'lyric' | 'pic')[];
  qualitys: LxQuality[];
}

interface LxResolvePayload {
  script: string;
  musicInfo: any;
  quality: string;
}

const SOURCE_PRIORITY: LxSourceKey[] = ['wy', 'kw', 'mg', 'kg', 'tx'];

const QUALITY_TO_LX: Record<string, LxQuality> = {
  standard: '128k',
  higher: '320k',
  exhigh: '320k',
  lossless: 'flac',
  hires: 'flac24bit',
  jyeffect: 'flac',
  sky: 'flac',
  dolby: 'flac',
  jymaster: 'flac24bit'
};

/** 提取脚本头部 @name */
const parseScriptInfo = (script: string): { name: string; rawScript: string } => {
  const info = { name: '未知音源', rawScript: script };
  const header = script.match(/^\/\*+[\s\S]*?\*\//)?.[0];
  const nameMatch = header?.match(/@name\s+(.+?)(?:\r?\n|\*\/)/);
  if (nameMatch) info.name = nameMatch[1].trim().replace(/^\*\s*/, '');
  return info;
};

const WORKER_PATH = join(__dirname, 'lxSandbox.worker.js');
const INIT_TIMEOUT = 10000;
const INVOKE_TIMEOUT = 20000;

class MainLxRunner {
  private worker: Worker | null = null;
  private currentScript: string | null = null;
  private sources: Partial<Record<LxSourceKey, LxSourceConfig>> = {};
  private initialized = false;
  private callSeq = 0;
  private pending = new Map<
    string,
    { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
  >();
  private initResolve: (() => void) | null = null;
  private initReject: ((e: Error) => void) | null = null;
  private initTimer: NodeJS.Timeout | null = null;

  /** 确保 worker 已用指定脚本完成初始化（脚本变化则重建） */
  private async ensure(script: string): Promise<void> {
    if (this.worker && this.initialized && this.currentScript === script) return;

    this.dispose();
    this.currentScript = script;

    const worker = new Worker(WORKER_PATH);
    this.worker = worker;
    worker.on('message', (msg: any) => this.handleMessage(msg));
    worker.on('error', (err) => {
      this.failInit(err instanceof Error ? err : new Error(String(err)));
      this.rejectAll(err instanceof Error ? err : new Error(String(err)));
    });

    const initPromise = new Promise<void>((resolve, reject) => {
      this.initResolve = resolve;
      this.initReject = reject;
      this.initTimer = setTimeout(
        () => this.failInit(new Error('落雪脚本初始化超时')),
        INIT_TIMEOUT
      );
    });

    worker.postMessage({ type: 'initialize', script, scriptInfo: parseScriptInfo(script) });
    await initPromise;
  }

  private clearInit() {
    if (this.initTimer) clearTimeout(this.initTimer);
    this.initTimer = null;
    this.initResolve = null;
    this.initReject = null;
  }

  private failInit(error: Error) {
    this.initReject?.(error);
    this.clearInit();
  }

  private rejectAll(error: Error) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(error);
    }
    this.pending.clear();
  }

  private handleMessage(msg: any) {
    switch (msg?.type) {
      case 'initialized':
        this.sources = msg.data?.sources || {};
        this.initialized = true;
        this.initResolve?.();
        this.clearInit();
        break;
      case 'script-error':
        this.failInit(new Error(msg.message || '脚本初始化失败'));
        break;
      case 'invoke-result': {
        const p = this.pending.get(msg.callId);
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(msg.callId);
          p.resolve(msg.result);
        }
        break;
      }
      case 'invoke-error': {
        const p = this.pending.get(msg.callId);
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(msg.callId);
          p.reject(new Error(msg.message || '脚本执行失败'));
        }
        break;
      }
      case 'log':
        // 透传脚本日志，统一前缀
        (console as any)[msg.level === 'log' ? 'log' : msg.level]?.(
          '[LxScript][main]',
          ...(msg.args || [])
        );
        break;
      default:
        break;
    }
  }

  private invoke(payload: any): Promise<any> {
    if (!this.worker || !this.initialized) return Promise.reject(new Error('worker 未初始化'));
    const callId = `call_${++this.callSeq}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(callId);
        reject(new Error('脚本请求超时'));
      }, INVOKE_TIMEOUT);
      this.pending.set(callId, { resolve, reject, timer });
      this.worker!.postMessage({ type: 'invoke-request', callId, payload });
    });
  }

  private pickSource(): LxSourceKey | null {
    const available = Object.keys(this.sources) as LxSourceKey[];
    if (available.length === 0) return null;
    return SOURCE_PRIORITY.find((s) => available.includes(s)) || available[0];
  }

  /** 解析音乐 URL；失败返回 null */
  async resolve(
    payload: LxResolvePayload
  ): Promise<{ url: string; source: string; quality: string } | null> {
    await this.ensure(payload.script);

    const source = this.pickSource();
    if (!source) return null;

    const sourceConfig = this.sources[source];
    if (!sourceConfig?.actions.includes('musicUrl')) return null;

    let quality: LxQuality = QUALITY_TO_LX[payload.quality || 'higher'] || '320k';
    if (!sourceConfig.qualitys.includes(quality)) {
      const fallback: LxQuality[] = ['flac24bit', 'flac', '320k', '128k'];
      quality = fallback.find((q) => sourceConfig.qualitys.includes(q)) || quality;
    }

    const result = await this.invoke({
      source,
      action: 'musicUrl',
      info: { type: quality, musicInfo: payload.musicInfo }
    });

    let url: string | undefined;
    if (typeof result === 'string') url = result;
    else if (result && typeof result === 'object') url = result.url || result.data;

    if (!url || typeof url !== 'string') return null;
    return { url, source: `lx-${source}`, quality };
  }

  dispose() {
    this.rejectAll(new Error('worker 已销毁'));
    this.clearInit();
    if (this.worker) {
      void this.worker.terminate();
      this.worker = null;
    }
    this.initialized = false;
    this.sources = {};
    this.currentScript = null;
  }
}

const runner = new MainLxRunner();

export const registerLxResolve = (): void => {
  ipcMain.handle('lx:resolve', async (_event, payload: LxResolvePayload) => {
    if (!payload?.script || !payload?.musicInfo) return null;
    try {
      return await runner.resolve(payload);
    } catch (error) {
      console.error('[lxRunner] 解析失败，将回退到渲染进程:', (error as Error).message);
      return null;
    }
  });
};
