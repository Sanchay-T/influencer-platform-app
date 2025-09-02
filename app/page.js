'use client'

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import DashboardLayout from "./components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import CampaignList from "./components/campaigns/CampaignList";
import { PlusCircle } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs';
import OnboardingModal from "./components/onboarding/onboarding-modal";

export default function Home() {
  const { userId } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [existingData, setExistingData] = useState({});

  useEffect(() => {
    if (userId) {
      checkOnboardingStatus();
    }
  }, [userId]);

  const checkOnboardingStatus = async () => {
    try {
      const response = await fetch('/api/onboarding/status');
      const data = await response.json();
      
      if (!response.ok) {
        // User profile doesn't exist - this is a NEW USER
        console.log('👋 [ONBOARDING] New user detected, showing onboarding modal');
        setShowOnboarding(true);
        setOnboardingStep(1);
        return;
      }
      
      // Check onboarding completion status
      const step = data.onboardingStep;
      
      if (step === 'pending') {
        // User exists but hasn't started onboarding
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
        return;
      }
      
      console.log('🔄 [ONBOARDING] Showing modal for step:', step);
      
    } catch (error) {
      console.error('❌ [ONBOARDING] Error checking status:', error);
      // On error, assume new user and show onboarding
      setShowOnboarding(true);
      setOnboardingStep(1);
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
        <DashboardLayout>
          <div className="flex justify-between items-center mb-4 mt-4">
            <h1 className="text-2xl font-bold">Your campaigns</h1>
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
