export type ThemeType = 'dark' | 'light';
export type AccentType = 'orange' | 'amber' | 'terracotta';
export type RadiusType = 'default' | 'round' | 'sharp';

// 检测系统主题
export const getSystemTheme = (): ThemeType => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

// 应用主题
export const applyTheme = (theme: ThemeType) => {
  // 使用 Tailwind 的暗色主题类
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  // 暖色设计令牌通过 data-theme 切换（暗色为默认，明色覆盖）
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  // 保存主题到本地存储
  localStorage.setItem('theme', theme);
};

// 应用强调色
export const applyAccent = (accent: AccentType) => {
  if (accent && accent !== 'orange') {
    document.documentElement.setAttribute('data-accent', accent);
  } else {
    document.documentElement.removeAttribute('data-accent');
  }
};

// 应用圆角风格
export const applyRadius = (radius: RadiusType) => {
  if (radius && radius !== 'default') {
    document.documentElement.setAttribute('data-radius', radius);
  } else {
    document.documentElement.removeAttribute('data-radius');
  }
};

// 获取当前主题
export const getCurrentTheme = (): ThemeType => {
  return (localStorage.getItem('theme') as ThemeType) || 'light';
};

// 监听系统主题变化
export const watchSystemTheme = (callback: (theme: ThemeType) => void) => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      callback(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);

    // 返回清理函数
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }
  return () => {};
};
