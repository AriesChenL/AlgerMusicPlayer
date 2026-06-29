import type { LocalMusicMeta } from './localMusic';

export interface IElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  dragStart: (_data: string) => void;
  miniTray: () => void;
  restart: () => void;
  openLyric: () => void;
  sendLyric: (_data: string) => void;
  /** 统一主进程音源解析（GD 音乐台 / 自定义 API / unblock） */
  musicResolve: (_payload: {
    provider: 'gdmusic' | 'custom' | 'unblock';
    track: {
      id: number;
      name: string;
      artists: Array<{ name: string }>;
      album?: { name?: string };
    };
    quality: string;
    sources?: string[];
    customApiPlugin?: string;
  }) => Promise<{
    url: string;
    source: string;
    br?: number;
    size?: number;
    platform?: string;
  } | null>;
  /** 落雪音源主进程沙箱解析（失败时渲染端回退） */
  lxResolve: (_payload: {
    script: string;
    musicInfo: any;
    quality: string;
  }) => Promise<{ url: string; source: string; quality: string } | null>;
  importCustomApiPlugin: () => Promise<{ name: string; content: string } | null>;
  importLxMusicScript: () => Promise<{ name: string; content: string } | null>;
  onLyricWindowClosed: (_callback: () => void) => void;
  onLyricWindowReady: (_callback: () => void) => void;
  onLanguageChanged: (_callback: (_locale: string) => void) => void;
  store: {
    get: (_key: string) => Promise<any>;
    set: (_key: string, _value: any) => Promise<boolean>;
    delete: (_key: string) => Promise<boolean>;
  };
  /** 扫描指定文件夹中的本地音乐文件 */
  scanLocalMusic: (_folderPath: string) => Promise<{ files: string[]; count: number }>;
  /** 扫描指定文件夹中的本地音乐文件（包含修改时间） */
  scanLocalMusicWithStats: (
    _folderPath: string
  ) => Promise<{ files: { path: string; modifiedTime: number }[]; count: number }>;
  /** 批量解析本地音乐文件元数据 */
  parseLocalMusicMetadata: (_filePaths: string[]) => Promise<LocalMusicMeta[]>;
  // Download manager
  downloadAdd: (_task: any) => Promise<string>;
  downloadAddBatch: (_tasks: any) => Promise<{ batchId: string; taskIds: string[] }>;
  downloadPause: (_taskId: string) => Promise<void>;
  downloadResume: (_taskId: string) => Promise<void>;
  downloadCancel: (_taskId: string) => Promise<void>;
  downloadCancelAll: () => Promise<void>;
  downloadGetQueue: () => Promise<any[]>;
  downloadSetConcurrency: (_n: number) => void;
  downloadGetCompleted: () => Promise<any[]>;
  downloadDeleteCompleted: (_filePath: string) => Promise<boolean>;
  downloadClearCompleted: () => Promise<boolean>;
  getEmbeddedLyrics: (_filePath: string) => Promise<string | null>;
  downloadProvideUrl: (_taskId: string, _url: string) => Promise<void>;
  onDownloadProgress: (_cb: (_data: any) => void) => void;
  onDownloadStateChange: (_cb: (_data: any) => void) => void;
  onDownloadBatchComplete: (_cb: (_data: any) => void) => void;
  onDownloadRequestUrl: (_cb: (_data: any) => void) => void;
  removeDownloadListeners: () => void;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
