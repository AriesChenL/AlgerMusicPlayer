import { is } from '@electron-toolkit/utils';
import { app, BrowserWindow, globalShortcut, ipcMain, nativeImage, session, shell } from 'electron';
import Store from 'electron-store';
import { join } from 'path';

import {
  applyContentZoom,
  applyInitialState,
  getWindowOptions,
  getWindowState,
  initWindowSizeHandlers
} from './window-size';

const store = new Store();

// 保存主窗口引用，以便在 activate 事件中使用
let mainWindowInstance: BrowserWindow | null = null;
let isPlaying = false;
let isAppQuitting = false;

/**
 * 设置应用退出状态
 */
export function setAppQuitting(quitting: boolean) {
  isAppQuitting = quitting;
}

/**
 * 初始化代理设置
 */
function initializeProxy() {
  const defaultConfig = {
    enable: false,
    protocol: 'http',
    host: '127.0.0.1',
    port: 7890
  };

  const proxyConfig = store.get('set.proxyConfig', defaultConfig) as {
    enable: boolean;
    protocol: string;
    host: string;
    port: number;
  };

  if (proxyConfig?.enable) {
    const proxyRules = `${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`;
    session.defaultSession.setProxy({ proxyRules });
  } else {
    session.defaultSession.setProxy({ proxyRules: '' });
  }
}

function setThumbarButtons(window: BrowserWindow) {
  window.setThumbarButtons([
    {
      tooltip: 'prev',
      icon: nativeImage.createFromPath(join(app.getAppPath(), 'resources/icons', 'prev.png')),
      click() {
        window.webContents.send('global-shortcut', 'prevPlay');
      }
    },

    {
      tooltip: isPlaying ? 'pause' : 'play',
      icon: nativeImage.createFromPath(
        join(app.getAppPath(), 'resources/icons', isPlaying ? 'pause.png' : 'play.png')
      ),
      click() {
        window.webContents.send('global-shortcut', 'togglePlay');
      }
    },

    {
      tooltip: 'next',
      icon: nativeImage.createFromPath(join(app.getAppPath(), 'resources/icons', 'next.png')),
      click() {
        window.webContents.send('global-shortcut', 'nextPlay');
      }
    }
  ]);
}

/**
 * 初始化窗口管理相关的IPC监听
 */
export function initializeWindowManager() {
  // 初始化代理设置
  initializeProxy();

  ipcMain.on('minimize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.minimize();
    }
  });

  ipcMain.on('maximize-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
      // 状态保存在事件监听器中处理
    }
  });

  ipcMain.on('close-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      // 在 macOS 上，关闭窗口不应该退出应用，而是隐藏窗口
      if (process.platform === 'darwin') {
        win.hide();
      } else {
        win.destroy();
        app.quit();
      }
    }
  });

  // 强制退出应用（用于免责声明拒绝等场景）
  ipcMain.on('quit-app', () => {
    setAppQuitting(true);
    app.quit();
  });

  ipcMain.on('mini-tray', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.hide();
    }
  });

  ipcMain.on('update-play-state', (_, playing: boolean) => {
    isPlaying = playing;
    if (mainWindowInstance) {
      setThumbarButtons(mainWindowInstance);
    }
  });

  // 监听代理设置变化
  store.onDidChange('set.proxyConfig', () => {
    initializeProxy();
  });

  // 初始化窗口大小和缩放相关的IPC处理程序
  initWindowSizeHandlers(mainWindowInstance);
  // 监听 macOS 下点击 Dock 图标的事件
  app.on('activate', () => {
    // 当应用被激活时，检查主窗口是否存在
    if (mainWindowInstance && !mainWindowInstance.isDestroyed()) {
      // 如果窗口存在但被隐藏，则显示窗口
      if (!mainWindowInstance.isVisible()) {
        mainWindowInstance.show();
      }
    }
  });
}

/**
 * 创建主窗口
 */
export function createMainWindow(icon: Electron.NativeImage): BrowserWindow {
  console.log('开始创建主窗口...');

  // 获取窗口创建选项
  const options = getWindowOptions();

  // 添加图标和预加载脚本
  options.icon = icon;
  options.webPreferences = {
    preload: join(__dirname, '../preload/index.js'),
    sandbox: false,
    contextIsolation: true,
    webSecurity: false
  };

  console.log(
    `创建窗口，使用选项: ${JSON.stringify({
      width: options.width,
      height: options.height,
      x: options.x,
      y: options.y,
      minWidth: options.minWidth,
      minHeight: options.minHeight
    })}`
  );

  // 创建窗口
  const mainWindow = new BrowserWindow(options);

  const appOrigin = (() => {
    if (!is.dev || !process.env.ELECTRON_RENDERER_URL) return null;
    try {
      return new URL(process.env.ELECTRON_RENDERER_URL).origin;
    } catch {
      return null;
    }
  })();

  const shouldOpenInBrowser = (targetUrl: string): boolean => {
    try {
      const parsedUrl = new URL(targetUrl);
      if (parsedUrl.protocol === 'mailto:' || parsedUrl.protocol === 'tel:') {
        return true;
      }

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return false;
      }

      if (appOrigin && parsedUrl.origin === appOrigin) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  };

  const openInSystemBrowser = (targetUrl: string) => {
    shell.openExternal(targetUrl).catch((error) => {
      console.error('打开外部链接失败:', targetUrl, error);
    });
  };

  // 移除菜单
  mainWindow.removeMenu();

  // 应用初始状态 (例如最大化状态)
  applyInitialState(mainWindow);

  const savedState = getWindowState();

  mainWindow.on('show', () => {
    setThumbarButtons(mainWindow);
  });

  // 处理窗口关闭事件
  mainWindow.on('close', (event) => {
    // 在 macOS 上，阻止默认的关闭行为，改为隐藏窗口
    if (process.platform === 'darwin') {
      // 检查是否是应用正在退出
      if (!isAppQuitting) {
        event.preventDefault();
        mainWindow.hide();
        return;
      }
    }
    // 在其他平台上，或者应用正在退出时，允许正常关闭
  });

  mainWindow.on('ready-to-show', () => {
    const [width, height] = mainWindow.getSize();
    console.log(`窗口显示前的大小: ${width}x${height}`);

    // 强制确保窗口使用正确的大小
    if (savedState && !savedState.isMaximized) {
      mainWindow.setSize(savedState.width, savedState.height, false);
    }

    // 显示窗口
    mainWindow.show();
    // 应用页面内容缩放
    applyContentZoom(mainWindow);

    // 再次检查窗口大小是否正确应用
    setTimeout(() => {
      if (!mainWindow.isDestroyed() && !mainWindow.isMaximized()) {
        const [currentWidth, currentHeight] = mainWindow.getSize();
        if (savedState && !savedState.isMaximized) {
          if (
            Math.abs(currentWidth - savedState.width) > 2 ||
            Math.abs(currentHeight - savedState.height) > 2
          ) {
            console.log(
              `窗口大小不匹配，再次调整: 当前=${currentWidth}x${currentHeight}, 目标=${savedState.width}x${savedState.height}`
            );
            mainWindow.setSize(savedState.width, savedState.height, false);
          }
        }
      }
    }, 100);
  });

  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!shouldOpenInBrowser(targetUrl)) return;
    event.preventDefault();
    openInSystemBrowser(targetUrl);
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (shouldOpenInBrowser(details.url)) {
      openInSystemBrowser(details.url);
    }
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);

    // 注册快捷键 打开开发者工具
    globalShortcut.register('CommandOrControl+Shift+I', () => {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  initWindowSizeHandlers(mainWindow);

  // 保存主窗口引用
  mainWindowInstance = mainWindow;

  return mainWindow;
}
