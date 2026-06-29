import './index.css';
import '@/assets/css/design-tokens.css';
import '@/assets/css/mobile.css';
import 'animate.css';
// 仅引用 woff2 子集（Electron/Chromium 完整支持），避免 vite 把 svg/eot/ttf/woff 全量打入产物（省 ~4.4MB）
import '@/assets/fonts/remixicon.css';

import { createApp } from 'vue';

import { DEFAULT_LANGUAGE, FALLBACK_LANGUAGE } from '@/../i18n/languages';
import i18n, { ensureLanguageLoaded } from '@/../i18n/renderer';
import router from '@/router';
import pinia from '@/store';
import { isElectron } from '@/utils';

import App from './App.vue';
import directives from './directive';
import { logError } from './utils/logger';

// 读取持久化语言（与 settings store 的来源保持一致），mount 前预加载，避免首屏语言闪烁
function readPersistedLanguage(): string {
  try {
    const saved = isElectron
      ? (window as any).electron?.ipcRenderer?.sendSync('get-store-value', 'set')
      : JSON.parse(localStorage.getItem('appSettings') || '{}');
    return saved?.language || DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

async function bootstrap() {
  const startLang = readPersistedLanguage();
  // 启动仅加载当前语言 + 回退语言（其余语言切换时按需加载）
  await ensureLanguageLoaded(startLang);
  if (FALLBACK_LANGUAGE !== startLang) {
    await ensureLanguageLoaded(FALLBACK_LANGUAGE);
  }
  (i18n.global.locale as any).value = startLang;

  const app = createApp(App);

  // 全局错误捕获 → 写入日志，用于错误分析
  app.config.errorHandler = (err, _instance, info) => {
    console.error('[Vue Error]', err, info);
    logError('vue-error', err, { info });
  };
  window.addEventListener('error', (e) => {
    logError('window-error', e.error || e.message, {
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno
    });
  });
  window.addEventListener('unhandledrejection', (e) => {
    logError('unhandled-rejection', e.reason);
  });

  Object.keys(directives).forEach((key: string) => {
    app.directive(key, directives[key as keyof typeof directives]);
  });

  app.use(pinia);
  app.use(router);
  app.use(i18n as any);
  app.mount('#app');
}

bootstrap();
