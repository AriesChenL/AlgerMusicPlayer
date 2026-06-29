import { app, ipcMain, shell } from 'electron';
import { promises as fsp } from 'fs';
import * as path from 'path';

import { getStore } from './config';

// 日志级别阈值：写入条件为 LEVELS[entry] <= LEVELS[配置级别]
const LEVELS: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  level: LogLevel;
  // 行为 behavior / 错误 error / 其它 app
  category?: 'behavior' | 'error' | 'app';
  event: string;
  data?: any;
  from?: 'main' | 'renderer';
}

let ensuredDir = '';
let lastCleanup = 0;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 每小时最多清理一次

// 读取配置（electron-store 为内存缓存，读取成本极低，可实时反映设置变更）
function readConfig() {
  const store = getStore();
  const enabled = store?.get('set.logEnabled');
  const level = (store?.get('set.logLevel') as LogLevel) || 'info';
  const dir = (store?.get('set.logDir') as string) || '';
  const retentionDays = Number(store?.get('set.logRetentionDays')) || 14;
  return {
    enabled: enabled !== false, // 默认开启
    level,
    retentionDays,
    dir: dir || path.join(app.getPath('logs'))
  };
}

// 当前生效的日志目录（用户未自定义时回退到系统 logs 目录）
export function getEffectiveLogDir(): string {
  return readConfig().dir;
}

function dateStamp(d = new Date()): string {
  // 本地日期 YYYY-MM-DD，按天分文件
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function currentFile(dir: string): string {
  return path.join(dir, `app-${dateStamp()}.jsonl`);
}

async function ensureDir(dir: string): Promise<void> {
  if (dir === ensuredDir) return;
  await fsp.mkdir(dir, { recursive: true });
  ensuredDir = dir;
}

function serializeError(err: any) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  if (err && typeof err === 'object') {
    try {
      return JSON.parse(JSON.stringify(err));
    } catch {
      return { value: String(err) };
    }
  }
  return { value: String(err) };
}

// 清理超过保留天数的日志文件
async function maybeCleanup(dir: string, retentionDays: number): Promise<void> {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  if (retentionDays <= 0) return; // 0 表示不自动清理
  try {
    const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
    const files = await fsp.readdir(dir);
    await Promise.all(
      files
        .filter((f) => /^app-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
        .map(async (f) => {
          const m = f.match(/^app-(\d{4})-(\d{2})-(\d{2})\.jsonl$/);
          if (!m) return;
          const fileTime = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`).getTime();
          if (fileTime < cutoff) {
            await fsp.unlink(path.join(dir, f)).catch(() => {});
          }
        })
    );
  } catch {
    // 清理失败不影响主流程
  }
}

// 核心写入：永不抛出，避免日志故障影响业务
export async function writeLog(entry: LogEntry): Promise<void> {
  try {
    const cfg = readConfig();
    if (!cfg.enabled) return;
    const lvl = LEVELS[entry.level] ?? LEVELS.info;
    if (lvl > (LEVELS[cfg.level] ?? LEVELS.info)) return;

    await ensureDir(cfg.dir);
    const record = {
      ts: new Date().toISOString(),
      level: entry.level,
      category: entry.category || 'app',
      event: entry.event,
      from: entry.from || 'main',
      data: entry.data ?? null
    };
    await fsp.appendFile(currentFile(cfg.dir), `${JSON.stringify(record)}\n`, 'utf-8');
    void maybeCleanup(cfg.dir, cfg.retentionDays);
  } catch {
    // 静默失败
  }
}

// 供主进程其它模块直接调用的便捷方法
export function logMain(
  level: LogLevel,
  category: LogEntry['category'],
  event: string,
  data?: any
): void {
  void writeLog({ level, category, event, data, from: 'main' });
}

export function logBehaviorMain(event: string, data?: any): void {
  void writeLog({ level: 'info', category: 'behavior', event, data, from: 'main' });
}

export function logErrorMain(event: string, error: any, data?: any): void {
  void writeLog({
    level: 'error',
    category: 'error',
    event,
    data: { ...serializeError(error), ...(data || {}) },
    from: 'main'
  });
}

/**
 * 初始化日志模块：注册 IPC、捕获主进程全局异常、记录启动事件。
 * 必须在 electron-store 初始化（initializeConfig）之后、app ready 之后调用。
 */
export function initializeLogger(): void {
  // 渲染进程写日志（fire-and-forget）
  ipcMain.on('log:write', (_event, entry: LogEntry) => {
    void writeLog({ ...entry, from: 'renderer' });
  });

  // 获取当前生效目录
  ipcMain.handle('log:get-dir', () => getEffectiveLogDir());

  // 列出日志文件（名称、大小、修改时间）
  ipcMain.handle('log:list-files', async () => {
    const dir = getEffectiveLogDir();
    try {
      const names = (await fsp.readdir(dir)).filter((f) => /\.jsonl$/.test(f));
      const files = await Promise.all(
        names.map(async (name) => {
          const stat = await fsp.stat(path.join(dir, name)).catch(() => null);
          return stat ? { name, size: stat.size, mtime: stat.mtimeMs } : null;
        })
      );
      return {
        dir,
        files: files.filter(Boolean).sort((a: any, b: any) => b.mtime - a.mtime)
      };
    } catch {
      return { dir, files: [] };
    }
  });

  // 打开日志目录
  ipcMain.handle('log:open-dir', async () => {
    const dir = getEffectiveLogDir();
    await fsp.mkdir(dir, { recursive: true }).catch(() => {});
    return shell.openPath(dir);
  });

  // 清空全部日志文件
  ipcMain.handle('log:clear', async () => {
    const dir = getEffectiveLogDir();
    try {
      const names = (await fsp.readdir(dir)).filter((f) => /^app-.*\.jsonl$/.test(f));
      await Promise.all(names.map((n) => fsp.unlink(path.join(dir, n)).catch(() => {})));
      ensuredDir = ''; // 强制下次写入重新建目录
      return { success: true, removed: names.length };
    } catch (error) {
      return { success: false, removed: 0, error: String(error) };
    }
  });

  // 捕获主进程未处理异常（不退出，仅记录）
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    logErrorMain('main-uncaught-exception', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
    logErrorMain('main-unhandled-rejection', reason);
  });

  // 记录应用启动
  logBehaviorMain('app-start', {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch
  });
}
