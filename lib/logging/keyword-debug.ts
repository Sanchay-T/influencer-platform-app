const STORAGE_KEY = 'keywordSearchDebug';
const GLOBAL_FLAG = '__keywordSearchDebug';

type KeywordDebugScope = 'page' | 'review' | 'suggestions' | 'api';

function getWindow(): (Window & typeof globalThis & { [GLOBAL_FLAG]?: boolean }) | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window as typeof window & { [GLOBAL_FLAG]?: boolean };
}

export function isKeywordDebugEnabled(): boolean {
  const win = getWindow();
  if (!win) {
    return false;
  }

  if (typeof win[GLOBAL_FLAG] === 'boolean') {
    return win[GLOBAL_FLAG] as boolean;
  }

  try {
    const stored = win.localStorage?.getItem(STORAGE_KEY);
    const enabled = stored === '1' || stored === 'true';
    win[GLOBAL_FLAG] = enabled;
    return enabled;
  } catch {
    return false;
  }
}

export function setKeywordDebugEnabled(value: boolean): void {
  const win = getWindow();
  if (!win) {
    return;
  }
  win[GLOBAL_FLAG] = value;
  try {
    win.localStorage?.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

export function keywordDebugLog(scope: KeywordDebugScope, message: string, meta?: unknown): void {
  if (!isKeywordDebugEnabled()) {
    return;
  }

  const prefix = `[KeywordDebug:${scope}]`;
  if (meta === undefined) {
    console.info(prefix, message);
    return;
  }
  console.info(prefix, message, meta);
}

export function keywordDebugWarn(scope: KeywordDebugScope, message: string, meta?: unknown): void {
  if (!isKeywordDebugEnabled()) {
    return;
  }
  const prefix = `[KeywordDebug:${scope}]`;
  if (meta === undefined) {
    console.warn(prefix, message);
    return;
  }
  console.warn(prefix, message, meta);
}
