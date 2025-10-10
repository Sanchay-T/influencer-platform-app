"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./sidebar";
import DashboardHeader from "./dashboard-header";
import AccessGuardOverlay from "../billing/access-guard-overlay";

const DESKTOP_HEADER_HEIGHT = 64;
const SIDEBAR_PIN_STORAGE_KEY = 'dashboard-sidebar-pinned';

export default function DashboardLayout({ 
  children, 
  onboardingStatusLoaded = true, 
  showOnboarding = false 
}) {
  const pathname = usePathname();
  const [isLarge, setIsLarge] = useState(false);
  const [sidebarSheetOpen, setSidebarSheetOpen] = useState(false);
  // Initialize deterministically for SSR; hydrate from localStorage after mount
  // Default to pinned so the navigation is visible on first load; localStorage overrides post-hydration.
  const [sidebarPinned, setSidebarPinned] = useState(true);
  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(SIDEBAR_PIN_STORAGE_KEY) : null;
      if (stored === 'true') setSidebarPinned(true);
      if (stored === 'false') setSidebarPinned(false);
    } catch {
      // ignore
    }
  }, []);
  const [desktopPeekOpen, setDesktopPeekOpen] = useState(false);
  const desktopSidebarStyle = useMemo(() => ({
    top: `${DESKTOP_HEADER_HEIGHT}px`,
    height: `calc(100vh - ${DESKTOP_HEADER_HEIGHT}px)`
  }), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SIDEBAR_PIN_STORAGE_KEY, sidebarPinned ? 'true' : 'false');
    } catch {
      // ignore persistence failures (e.g., private mode)
    }
  }, [sidebarPinned]);

  // Track breakpoint to auto-open on large screens and close on small screens
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)'); // lg breakpoint
    const update = () => {
      const matches = mq.matches;
      setIsLarge(matches);
      if (!matches) {
        setSidebarSheetOpen(false);
        setDesktopPeekOpen(false);
      }
    };
    update();
    try {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    } catch {
      // Safari fallback
      mq.addListener(update);
      return () => mq.removeListener(update);
    }
  }, []);

  // Auto-close sidebar on route change when on mobile
  useEffect(() => {
    if (!isLarge) setSidebarSheetOpen(false);
    setDesktopPeekOpen(false);
  }, [pathname, isLarge]);

  // Close on Escape when open on mobile
  useEffect(() => {
    if (isLarge || !sidebarSheetOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setSidebarSheetOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isLarge, sidebarSheetOpen]);

  const handleToggleSidebar = useCallback(() => {
    if (isLarge) {
      setSidebarPinned((prev) => {
        const next = !prev;
        if (next) {
          setDesktopPeekOpen(false);
        }
        return next;
      });
    } else {
      setSidebarSheetOpen((prev) => !prev);
    }
  }, [isLarge]);

  const handleSidebarNavigate = useCallback(() => {
    if (!isLarge) {
      setSidebarSheetOpen(false);
    }
  }, [isLarge]);

  const openDesktopPeek = useCallback(() => {
    if (!isLarge || sidebarPinned) return;
    setDesktopPeekOpen(true);
  }, [isLarge, sidebarPinned]);

  const closeDesktopPeek = useCallback(() => {
    if (!isLarge || sidebarPinned) return;
    setDesktopPeekOpen(false);
  }, [isLarge, sidebarPinned]);

  const isSidebarVisible = useMemo(() => {
    if (!isLarge) return sidebarSheetOpen;
    return sidebarPinned || desktopPeekOpen;
  }, [isLarge, sidebarPinned, sidebarSheetOpen, desktopPeekOpen]);

  return (
    <div className="flex h-screen bg-zinc-900 text-zinc-100">
      {/* Desktop hover target for auto-hide */}
      <div
        className={`hidden lg:block fixed left-0 z-20 w-3 ${sidebarPinned ? 'pointer-events-none' : ''}`}
        style={desktopSidebarStyle}
        onMouseEnter={openDesktopPeek}
      />

      {/* Mobile sidebar (overlay) */}
      <div
        className={
          `fixed inset-y-0 left-0 z-[80] w-full max-w-xs sm:max-w-sm transform transition-transform duration-200 lg:hidden ` +
          (sidebarSheetOpen ? 'translate-x-0' : '-translate-x-full')
        }
        role="dialog"
        aria-modal="true"
        aria-hidden={!sidebarSheetOpen}
      >
        <Sidebar
          onNavigate={handleSidebarNavigate}
          onTogglePin={handleToggleSidebar}
          isPinned={sidebarPinned}
          showAutoHideHint={false}
        />
      </div>

      {/* Overlay for mobile when sidebar is open */}
      {sidebarSheetOpen && !isLarge && (
        <div
          className="fixed inset-0 z-[70] bg-black/50"
          onClick={() => setSidebarSheetOpen(false)}
        />
      )}

      {/* Desktop sidebar pinned */}
      <div
        className={
          `hidden h-full transition-[width] duration-200 ease-in-out lg:flex ` +
          (sidebarPinned ? 'w-64' : 'w-0')
        }
      >
        {sidebarPinned && (
          <Sidebar
            onNavigate={handleSidebarNavigate}
            onTogglePin={handleToggleSidebar}
            isPinned
            showAutoHideHint={false}
          />
        )}
      </div>

      {/* Desktop sidebar hover peek */}
      {!sidebarPinned && (
        <div
          className={`hidden lg:block fixed left-0 z-30 w-64 transform transition-transform duration-150 ${desktopPeekOpen ? 'translate-x-0' : '-translate-x-full'}`}
          style={desktopSidebarStyle}
          onMouseEnter={openDesktopPeek}
          onMouseLeave={closeDesktopPeek}
        >
          <Sidebar
            onNavigate={handleSidebarNavigate}
            onTogglePin={handleToggleSidebar}
            isPinned={false}
            showAutoHideHint
          />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <DashboardHeader
          onToggleSidebar={handleToggleSidebar}
          isSidebarOpen={isSidebarVisible}
        />
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-4 sm:px-6 md:px-8 py-6">
            {children}
          </div>
        </div>
        {/* Global access overlay to gate unpaid/expired users */}
        <AccessGuardOverlay 
          onboardingStatusLoaded={onboardingStatusLoaded}
          showOnboarding={showOnboarding}
        />
      </main>
    </div>
  );
}
