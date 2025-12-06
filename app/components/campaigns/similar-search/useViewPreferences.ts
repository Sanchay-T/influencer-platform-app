import { structuredConsole } from '@/lib/logging/console-proxy';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'similarSearch.viewPreferences';

type Preferences = {
  viewMode: 'table' | 'gallery';
  emailOnly: boolean;
};

const DEFAULT_PREFERENCES: Preferences = {
  viewMode: 'table',
  emailOnly: false,
};

export function useViewPreferences(jobId?: string) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const stableKey = jobId ? `${STORAGE_KEY}:${jobId}` : STORAGE_KEY;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(stableKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      setPreferences({
        viewMode: parsed.viewMode === 'gallery' ? 'gallery' : 'table',
        emailOnly: Boolean(parsed.emailOnly),
      });
    } catch (error) {
      structuredConsole.warn('[SIMILAR-VIEW] Failed to load preferences', error);
    }
  }, [stableKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(stableKey, JSON.stringify(preferences));
    } catch (error) {
      structuredConsole.warn('[SIMILAR-VIEW] Failed to persist preferences', error);
    }
  }, [preferences, stableKey]);

  return {
    preferences,
    setPreferences,
  };
}
