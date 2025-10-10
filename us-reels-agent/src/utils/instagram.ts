export function normalizeReelUrl(raw?: string | null): string | null {
    if (!raw) return null;
    try {
        const u = new URL(raw);
        if (!u.hostname.includes('instagram.com')) return null;
        const parts = u.pathname.split('/').filter(Boolean);
        const idx = parts.indexOf('reel');
        if (idx >= 0 && parts[idx + 1]) {
            const code = parts[idx + 1].replace(/[^A-Za-z0-9_-]/g, '');
            return `https://www.instagram.com/reel/${code}`;
        }
        return null;
    } catch {
        return null;
    }
}

export function uniq<T>(arr: T[]) {
    return Array.from(new Set(arr));
}
