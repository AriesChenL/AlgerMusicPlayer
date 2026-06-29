// 渲染进程日志工具：通过 IPC 把行为/错误事件交给主进程落盘（JSONL）。
// 非 Electron 环境（web）降级为 console，不写文件。
// 设计原则：永不抛出，任何失败都静默，避免日志影响业务。

import { isElectron } from '.';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export type LogCategory = 'behavior' | 'error' | 'app';

interface LogConfig {
  enabled: boolean;
  level: LogLevel;
  dir: string;
  retentionDays: number;
}

interface LogFileInfo {
  name: string;
  size: number;
  mtime: number;
}

function send(level: LogLevel, category: LogCategory, event: string, data?: any) {
  try {
    if (isElectron && window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('log:write', { level, category, event, data });
    } else if (level === 'error') {
      // web 端仅在出错时回落到控制台，避免噪音
      console.error(`[${category}] ${event}`, data ?? '');
    }
  } catch {
    // 静默
  }
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

/** 记录一次用户行为（导航、搜索、播放等） */
export function logBehavior(event: string, data?: any): void {
  send('info', 'behavior', event, data);
}

/** 记录一次错误（异常、API 失败等） */
export function logError(event: string, error?: any, data?: any): void {
  send('error', 'error', event, { ...serializeError(error), ...(data || {}) });
}

export function logWarn(event: string, data?: any): void {
  send('warn', 'app', event, data);
}

export function logInfo(event: string, data?: any): void {
  send('info', 'app', event, data);
}

// ==================== 设置页用的管理接口 ====================

export async function getLogDir(): Promise<string> {
  if (!isElectron) return '';
  try {
    return (await window.electron.ipcRenderer.invoke('log:get-dir')) as string;
  } catch {
    return '';
  }
}

export async function listLogFiles(): Promise<{ dir: string; files: LogFileInfo[] }> {
  if (!isElectron) return { dir: '', files: [] };
  try {
    return (await window.electron.ipcRenderer.invoke('log:list-files')) as {
      dir: string;
      files: LogFileInfo[];
    };
  } catch {
    return { dir: '', files: [] };
  }
}

export async function openLogDir(): Promise<void> {
  if (!isElectron) return;
  try {
    await window.electron.ipcRenderer.invoke('log:open-dir');
  } catch {
    // 静默
  }
}

export async function clearLogs(): Promise<{ success: boolean; removed: number }> {
  if (!isElectron) return { success: false, removed: 0 };
  try {
    return (await window.electron.ipcRenderer.invoke('log:clear')) as {
      success: boolean;
      removed: number;
    };
  } catch {
    return { success: false, removed: 0 };
  }
}

export type { LogConfig, LogFileInfo };
