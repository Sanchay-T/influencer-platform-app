"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./sidebar";
import DashboardHeader from "./dashboard-header";
import AccessGuardOverlay from "../billing/access-guard-overlay";

export default function DashboardLayout({ 
  children, 
  onboardingStatusLoaded = true, 
  showOnboarding = false 
}) {
  const pathname = usePathname();
  const [isLarge, setIsLarge] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Track breakpoint to auto-open on large screens and close on small screens
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)'); // lg breakpoint
    const update = () => {
      setIsLarge(mq.matches);
      setSidebarOpen(mq.matches); // open on lg+, closed on small
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
    if (!isLarge) setSidebarOpen(false);
  }, [pathname, isLarge]);

  // Close on Escape when open on mobile
  useEffect(() => {
    if (isLarge || !sidebarOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isLarge, sidebarOpen]);

  return (
    <div className="flex h-screen bg-zinc-900 text-zinc-100">
      {/* Sidebar container: off-canvas on mobile, static on desktop */}
      <div
        className={
          `fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 lg:static lg:translate-x-0 ` +
          (sidebarOpen ? 'translate-x-0' : '-translate-x-full')
        }
        aria-hidden={!sidebarOpen && !isLarge}
      >
        <Sidebar onNavigate={() => { if (!isLarge) setSidebarOpen(false); }} />
      </div>

      {/* Overlay for mobile when sidebar is open */}
      {sidebarOpen && !isLarge && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <DashboardHeader
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          isSidebarOpen={sidebarOpen}
        />
        <div className="flex-1 overflow-y-auto">
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
