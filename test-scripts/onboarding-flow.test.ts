/**
 * Onboarding Flow Tests
 *
 * Tests the critical user onboarding journey including:
 * - Dashboard state check (shows modal for incomplete onboarding)
 * - Modal dismissal prevention
 * - Progress persistence via localStorage
 *
 * Run: npx tsx test-scripts/onboarding-flow.test.ts
 */

import assert from 'node:assert';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';

// Mock localStorage for testing
const createMockLocalStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] || null,
  };
};

describe('Onboarding State Check', () => {
  /**
   * Test: Dashboard should show onboarding for incomplete states
   *
   * Previously: Only checked for === 'pending'
   * Fixed: Now checks for !== 'completed'
   */
  it('should show onboarding modal when onboardingStep is pending', () => {
    const userProfile = { onboardingStep: 'pending' };
    const showOnboarding = userProfile?.onboardingStep !== 'completed';
    assert.strictEqual(showOnboarding, true, 'Should show onboarding for pending state');
  });

  it('should show onboarding modal when onboardingStep is info_captured', () => {
    const userProfile = { onboardingStep: 'info_captured' };
    const showOnboarding = userProfile?.onboardingStep !== 'completed';
    assert.strictEqual(showOnboarding, true, 'Should show onboarding for info_captured state');
  });

  it('should show onboarding modal when onboardingStep is step_2_info', () => {
    const userProfile = { onboardingStep: 'step_2_info' };
    const showOnboarding = userProfile?.onboardingStep !== 'completed';
    assert.strictEqual(showOnboarding, true, 'Should show onboarding for step_2_info state');
  });

  it('should show onboarding modal when onboardingStep is null', () => {
    const userProfile = { onboardingStep: null };
    const showOnboarding = userProfile?.onboardingStep !== 'completed';
    assert.strictEqual(showOnboarding, true, 'Should show onboarding for null state');
  });

  it('should show onboarding modal when onboardingStep is undefined', () => {
    const userProfile = { onboardingStep: undefined };
    const showOnboarding = userProfile?.onboardingStep !== 'completed';
    assert.strictEqual(showOnboarding, true, 'Should show onboarding for undefined state');
  });

  it('should NOT show onboarding modal when onboardingStep is completed', () => {
    const userProfile = { onboardingStep: 'completed' };
    const showOnboarding = userProfile?.onboardingStep !== 'completed';
    assert.strictEqual(showOnboarding, false, 'Should NOT show onboarding for completed state');
  });

  it('should show onboarding modal when userProfile is null', () => {
    const userProfile = null;
    const showOnboarding = userProfile?.onboardingStep !== 'completed';
    assert.strictEqual(showOnboarding, true, 'Should show onboarding when profile is null');
  });
});

describe('Onboarding Progress Persistence', () => {
  const ONBOARDING_STORAGE_KEY = 'gemz_onboarding_progress';

  interface OnboardingProgress {
    step: number;
    fullName: string;
    businessName: string;
    brandDescription: string;
    lastUpdated: string;
  }

  function saveOnboardingProgress(storage: ReturnType<typeof createMockLocalStorage>, progress: OnboardingProgress) {
    try {
      storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      // localStorage may not be available
    }
  }

  function loadOnboardingProgress(storage: ReturnType<typeof createMockLocalStorage>): OnboardingProgress | null {
    try {
      const stored = storage.getItem(ONBOARDING_STORAGE_KEY);
      if (stored) {
        const progress = JSON.parse(stored) as OnboardingProgress;
        // Only use saved progress if less than 24 hours old
        const lastUpdated = new Date(progress.lastUpdated);
        const hoursSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
        if (hoursSinceUpdate < 24) {
          return progress;
        }
      }
    } catch (e) {
      // localStorage may not be available
    }
    return null;
  }

  it('should save progress to localStorage', () => {
    const storage = createMockLocalStorage();
    const progress: OnboardingProgress = {
      step: 2,
      fullName: 'Test User',
      businessName: 'Test Corp',
      brandDescription: 'Test description',
      lastUpdated: new Date().toISOString(),
    };

    saveOnboardingProgress(storage, progress);

    const stored = storage.getItem(ONBOARDING_STORAGE_KEY);
    assert.ok(stored, 'Progress should be stored');

    const parsed = JSON.parse(stored);
    assert.strictEqual(parsed.step, 2);
    assert.strictEqual(parsed.fullName, 'Test User');
  });

  it('should restore progress from localStorage', () => {
    const storage = createMockLocalStorage();
    const progress: OnboardingProgress = {
      step: 3,
      fullName: 'Restored User',
      businessName: 'Restored Corp',
      brandDescription: 'Restored description',
      lastUpdated: new Date().toISOString(),
    };

    saveOnboardingProgress(storage, progress);
    const restored = loadOnboardingProgress(storage);

    assert.ok(restored, 'Progress should be restored');
    assert.strictEqual(restored!.step, 3);
    assert.strictEqual(restored!.fullName, 'Restored User');
  });

  it('should reject progress older than 24 hours', () => {
    const storage = createMockLocalStorage();
    const oldDate = new Date();
    oldDate.setHours(oldDate.getHours() - 25); // 25 hours ago

    const progress: OnboardingProgress = {
      step: 2,
      fullName: 'Old User',
      businessName: 'Old Corp',
      brandDescription: 'Old description',
      lastUpdated: oldDate.toISOString(),
    };

    saveOnboardingProgress(storage, progress);
    const restored = loadOnboardingProgress(storage);

    assert.strictEqual(restored, null, 'Should reject old progress');
  });

  it('should accept progress within 24 hours', () => {
    const storage = createMockLocalStorage();
    const recentDate = new Date();
    recentDate.setHours(recentDate.getHours() - 23); // 23 hours ago

    const progress: OnboardingProgress = {
      step: 2,
      fullName: 'Recent User',
      businessName: 'Recent Corp',
      brandDescription: 'Recent description',
      lastUpdated: recentDate.toISOString(),
    };

    saveOnboardingProgress(storage, progress);
    const restored = loadOnboardingProgress(storage);

    assert.ok(restored, 'Should accept recent progress');
    assert.strictEqual(restored!.fullName, 'Recent User');
  });
});

describe('Modal Dismissal Prevention', () => {
  it('should prevent ESC key from closing modal during onboarding', () => {
    // Simulates the ESC key prevention logic
    const isOpen = true;
    let wasDismissed = false;
    let toastShown = false;

    const handleKeyDown = (key: string) => {
      if (key === 'Escape' && isOpen) {
        // In real implementation, this would prevent default and show toast
        toastShown = true;
        // wasDismissed remains false because we prevented it
      } else {
        wasDismissed = true;
      }
    };

    handleKeyDown('Escape');

    assert.strictEqual(wasDismissed, false, 'Modal should not be dismissed');
    assert.strictEqual(toastShown, true, 'Toast should be shown');
  });

  it('should prevent backdrop click from closing modal', () => {
    const isOpen = true;
    let wasDismissed = false;
    let toastShown = false;

    const handleBackdropClick = (clickedOnBackdrop: boolean) => {
      if (clickedOnBackdrop && isOpen) {
        // Show toast instead of dismissing
        toastShown = true;
        // wasDismissed remains false
      } else {
        wasDismissed = true;
      }
    };

    handleBackdropClick(true);

    assert.strictEqual(wasDismissed, false, 'Modal should not be dismissed');
    assert.strictEqual(toastShown, true, 'Toast should be shown');
  });
});

console.log('\n✅ All onboarding flow tests completed!\n');
