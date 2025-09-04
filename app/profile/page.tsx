'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useAdmin } from '@/lib/hooks/use-admin';
import DashboardLayout from '../components/layout/dashboard-layout';
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card";
import {
  User,
  Building2,
  Factory,
  Mail,
  ExternalLink,
  Settings
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import TrialStatusCard from '@/components/trial/trial-status-card';
import TrialStatusCardUser from '@/components/trial/trial-status-card-user';
import EmailScheduleDisplay from '@/components/trial/email-schedule-display';
import { PlanBadge } from '@/app/components/billing/protect';
import { useBillingCached } from '@/lib/hooks/use-billing-cached';
import Link from 'next/link';

export default function ProfileSettingsPage() {
  const { user, isLoaded } = useUser();
  const { isAdmin } = useAdmin();
  const { currentPlan, needsUpgrade } = useBillingCached();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userProfile, setUserProfile] = useState({
    name: '',
    companyName: '',
    industry: '',
    email: '',
    trialData: null,
    emailScheduleStatus: {}
  });

  useEffect(() => {
    async function getUserProfile() {
      if (!isLoaded || !user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('🔍 [PROFILE-PAGE] Fetching user profile for:', user.id);

        // Try to fetch user profile data from our API
        const response = await fetch('/api/profile', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const profileData = await response.json();
          console.log('✅ [PROFILE-PAGE] Profile data fetched:', profileData);
          
          setUserProfile({
            name: profileData.name || user.fullName || '',
            companyName: profileData.companyName || '',
            industry: profileData.industry || '',
            email: user.emailAddresses?.[0]?.emailAddress || '',
            trialData: profileData.trialData || null,
            emailScheduleStatus: profileData.emailScheduleStatus || {}
          });

          // Log trial information for debugging
          if (profileData.trialData) {
            console.log('🎯 [PROFILE-PAGE] Trial data found:', {
              status: profileData.trialData.status,
              daysRemaining: profileData.trialData.daysRemaining,
              progressPercentage: profileData.trialData.progressPercentage,
              endDate: profileData.trialData.endDate
            });
          } else {
            console.log('ℹ️ [PROFILE-PAGE] No trial data found');
          }
        } else {
          // Profile doesn't exist yet, set default values from Clerk
          console.log('ℹ️ [PROFILE-PAGE] No profile found, using Clerk user data');
          setUserProfile({
            name: user.fullName || '',
            companyName: '',
            industry: '',
            email: user.emailAddresses?.[0]?.emailAddress || '',
            trialData: null,
            emailScheduleStatus: {}
          });
        }
      } catch (fetchError) {
        console.error('💥 [PROFILE-PAGE] Error fetching profile:', fetchError);
        setError('Error loading profile data');
      } finally {
        setLoading(false);
      }
    }

    getUserProfile();
  }, [isLoaded, user]);

  const handleManageAccount = () => {
    // Redirect to Clerk's user management interface
    if (user) {
      // You can customize this URL based on your Clerk setup
      window.open(`${window.location.origin}/sign-in#/user`, '_blank');
    }
  };

  if (!isLoaded || loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-8">
            {/* Header skeleton */}
            <div>
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
            
            {/* Cards skeleton */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-64 bg-gray-200 rounded-lg"></div>
              <div className="h-64 bg-gray-200 rounded-lg"></div>
            </div>
            
            {/* Content skeleton */}
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded-lg"></div>
              <div className="h-32 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="py-6 space-y-8">
        {/* Page Header */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-zinc-100">Profile Settings</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Manage your account information{isAdmin ? ', trial status, and email preferences' : ' and trial status'}
          </p>
        </div>

        {/* Main Content Area */}
        <div className="space-y-8">
          {/* Trial Status Section */}
          {userProfile.trialData ? (
            <section>
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">Trial Status</h2>
              {isAdmin ? (
                // Admin view: 2-column grid
                <div className="grid gap-6 lg:grid-cols-2">
                  <TrialStatusCard 
                    trialData={userProfile.trialData} 
                    className="w-full"
                  />
                  <EmailScheduleDisplay 
                    emailScheduleStatus={userProfile.emailScheduleStatus}
                    className="w-full"
                  />
                </div>
              ) : (
                // Regular user view: Centered single card
                <div className="flex justify-center">
                  <TrialStatusCardUser 
                    trialData={userProfile.trialData} 
                    className="w-full max-w-xl"
                  />
                </div>
              )}
            </section>
          ) : (
            // No trial data placeholder
            <section className="flex justify-center">
              <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-6 max-w-2xl w-full text-zinc-200">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-zinc-100">No Trial Active</h3>
                    <div className="mt-2 text-sm text-zinc-300">
                      <p>You haven't started your free trial yet. Complete onboarding or contact support if you've already completed it.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Account Information Section */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">Account Information</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Personal Information Card */}
              <Card className="h-fit bg-zinc-900/80 border border-zinc-700/50">
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>
                    Your account and company details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {error ? (
                    <div className="text-sm text-red-400 p-4 bg-red-900/20 border border-red-800 rounded-md">
                      {error}
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      <div className="flex items-center space-x-4">
                        <User className="text-zinc-400 flex-shrink-0" size={20} />
                        <div className="space-y-0.5 min-w-0">
                          <Label className="text-sm font-medium">Name</Label>
                          <p className="text-sm text-zinc-400 truncate">
                            {userProfile.name || 'Not available'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <Mail className="text-zinc-400 flex-shrink-0" size={20} />
                        <div className="space-y-0.5 min-w-0">
                          <Label className="text-sm font-medium">Email</Label>
                          <p className="text-sm text-zinc-400 truncate">
                            {userProfile.email || 'Not available'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <Building2 className="text-zinc-400 flex-shrink-0" size={20} />
                        <div className="space-y-0.5 min-w-0">
                          <Label className="text-sm font-medium">Company</Label>
                          <p className="text-sm text-zinc-400 truncate">
                            {userProfile.companyName || 'Not set'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <Factory className="text-zinc-400 flex-shrink-0" size={20} />
                        <div className="space-y-0.5 min-w-0">
                          <Label className="text-sm font-medium">Industry</Label>
                          <p className="text-sm text-zinc-400 truncate">
                            {userProfile.industry || 'Not set'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Subscription Plan Card */}
              <Card className="h-fit bg-zinc-900/80 border border-zinc-700/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Subscription Plan
                    <PlanBadge />
                  </CardTitle>
                  <CardDescription>
                    Manage your subscription and billing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Current Plan</Label>
                      <p className="text-sm text-zinc-400">
                        You are currently on the {currentPlan?.charAt(0).toUpperCase() + currentPlan?.slice(1)} plan
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link href="/pricing" className="flex-1">
                        <Button 
                          variant={needsUpgrade ? "default" : "outline"}
                          className="w-full"
                        >
                          {needsUpgrade ? "Upgrade Plan" : "View Plans"}
                        </Button>
                      </Link>
                      {!needsUpgrade && (
                        <Button 
                          variant="outline" 
                          onClick={() => window.open('/api/billing/portal', '_blank')}
                          className="flex items-center gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Billing
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Account Management Card */}
              <Card className="h-fit bg-zinc-900/80 border border-zinc-700/50">
                <CardHeader>
                  <CardTitle>Account Management</CardTitle>
                  <CardDescription>
                    Manage your email, password, and security settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Account Settings</Label>
                      <p className="text-sm text-zinc-400">
                        Update your email, password, and security preferences
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={handleManageAccount}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Manage Account
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

        </div>
      </div>
    </DashboardLayout>
  );
}
