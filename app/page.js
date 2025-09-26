'use client'

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import DashboardLayout from "./components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import CampaignList from "./components/campaigns/CampaignList";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs';
import OnboardingModal from "./components/onboarding/onboarding-modal";
import CampaignCounter from "./components/shared/campaign-counter";

export default function Home() {
  const { userId } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [existingData, setExistingData] = useState({});
  const [onboardingStatusLoaded, setOnboardingStatusLoaded] = useState(false);

  useEffect(() => {
    console.log(`🚨🚨🚨 [PAGE-LOAD] useEffect triggered. userId: ${userId}`);
    if (userId) {
      console.log(`🚨🚨🚨 [PAGE-LOAD] User authenticated, calling checkOnboardingStatus`);
      checkOnboardingStatus();
    } else {
      console.log(`🚨🚨🚨 [PAGE-LOAD] No userId yet, waiting for authentication`);
    }
  }, [userId]);

  const checkOnboardingStatus = async () => {
    try {
      const onboardingTestId = `ONBOARDING_CHECK_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      console.log(`🚨🚨🚨 [ONBOARDING-CHECK] ${onboardingTestId} - STARTING ONBOARDING STATUS CHECK`);
      console.log(`🚨🚨🚨 [ONBOARDING-CHECK] ${onboardingTestId} - This should determine if modal shows`);
      
      const response = await fetch('/api/onboarding/status');
      const data = await response.json();
      
      console.log(`🚨🚨🚨 [ONBOARDING-CHECK] ${onboardingTestId} - API Response:`, {
        ok: response.ok,
        status: response.status,
        data: data
      });
      
      if (!response.ok) {
        // User profile doesn't exist - this is a NEW USER
        console.log(`🚨🚨🚨 [ONBOARDING-CHECK] ${onboardingTestId} - NEW USER DETECTED - SHOWING MODAL`);
        setShowOnboarding(true);
        setOnboardingStep(1);
        setOnboardingStatusLoaded(true); // ✅ Mark as loaded
        return;
      }
      
      // Check onboarding completion status
      const step = data.onboardingStep;
      
      console.log(`🔍 [ONBOARDING-TEST] ${onboardingTestId} - User onboarding step: ${step}`);
      
      if (step === 'pending') {
        // User exists but hasn't started onboarding
        console.log(`🚨🚨🚨 [ONBOARDING-CHECK] ${onboardingTestId} - PENDING ONBOARDING DETECTED - SHOWING MODAL`);
        setShowOnboarding(true);
        setOnboardingStep(1);
        setExistingData(data);
      } else if (step === 'info_captured') {
        // User completed step 1, needs to do step 2
        setShowOnboarding(true);
        setOnboardingStep(2);
        setExistingData(data);
      } else if (step === 'intent_captured') {
        // User completed step 2, needs to do step 3 (trial setup)
        setShowOnboarding(true);
        setOnboardingStep(3);
        setExistingData(data);
      } else if (step === 'completed') {
        // User completed full onboarding - show dashboard
        console.log('✅ [ONBOARDING] User completed onboarding, showing dashboard');
        setShowOnboarding(false);
      }
      
      console.log('🔄 [ONBOARDING] Showing modal for step:', step);
      setOnboardingStatusLoaded(true); // ✅ Mark as loaded after determining status
      
    } catch (error) {
      console.error('❌ [ONBOARDING] Error checking status:', error);
      // On error, assume new user and show onboarding
      setShowOnboarding(true);
      setOnboardingStep(1);
      setOnboardingStatusLoaded(true); // ✅ Mark as loaded even on error
    }
  };

  const handleOnboardingComplete = () => {
    console.log('✅ [ONBOARDING] Modal completed, showing dashboard');
    setShowOnboarding(false);
  };
  return (
    <>
      <SignedOut>
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="w-full max-w-md space-y-8 text-center">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                Gemz
              </h1>
              <p className="mt-4 text-lg text-gray-600">
                Manage your influencer campaigns across multiple platforms
              </p>
            </div>
            <div className="space-y-4">
              <SignInButton mode="modal">
                <Button className="w-full" size="lg">
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button variant="outline" className="w-full" size="lg">
                  Create Account
                </Button>
              </SignUpButton>
            </div>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <DashboardLayout 
          onboardingStatusLoaded={onboardingStatusLoaded}
          showOnboarding={showOnboarding}
        >
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Your campaigns</h1>
            <div className="flex items-center gap-3">
              <CampaignCounter />
            </div>
          </div>
          <CampaignList />
          
          {/* Onboarding Modal Overlay */}
          <OnboardingModal 
            isOpen={showOnboarding}
            onComplete={handleOnboardingComplete}
            initialStep={onboardingStep}
            existingData={existingData}
          />
        </DashboardLayout>
      </SignedIn>
    </>
  );
}
