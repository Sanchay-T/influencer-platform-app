'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
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
import EmailScheduleDisplay from '@/components/trial/email-schedule-display';

export default function ProfileSettingsPage() {
  const { user, isLoaded } = useUser();
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your account information, trial status, and email preferences
          </p>
        </div>

        {/* Trial Status Section - Full Width */}
        {userProfile.trialData && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Trial Status</h2>
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
          </div>
        )}

        {/* Show placeholder if no trial data */}
        {!userProfile.trialData && (
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">No Trial Active</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>You haven't started your free trial yet. Complete onboarding or contact support if you've already completed it.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Personal Information Section */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Account Information</h2>

          <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Your account and company details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <div className="text-sm text-red-500 p-4 bg-red-50 rounded-md">
                {error}
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="flex items-center space-x-4">
                  <User className="text-gray-500" size={20} />
                  <div className="space-y-0.5">
                    <Label>Name</Label>
                    <p className="text-sm text-muted-foreground">
                      {userProfile.name || 'Not available'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <Mail className="text-gray-500" size={20} />
                  <div className="space-y-0.5">
                    <Label>Email</Label>
                    <p className="text-sm text-muted-foreground">
                      {userProfile.email || 'Not available'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <Building2 className="text-gray-500" size={20} />
                  <div className="space-y-0.5">
                    <Label>Company</Label>
                    <p className="text-sm text-muted-foreground">
                      {userProfile.companyName || 'Not set'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <Factory className="text-gray-500" size={20} />
                  <div className="space-y-0.5">
                    <Label>Industry</Label>
                    <p className="text-sm text-muted-foreground">
                      {userProfile.industry || 'Not set'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Management</CardTitle>
            <CardDescription>
              Manage your email, password, and security settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Account Settings</Label>
                <p className="text-sm text-muted-foreground">
                  Update your email, password, and security preferences
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={handleManageAccount}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Manage Account
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Debug Section - Only visible in development */}
        {process.env.NODE_ENV === 'development' && userProfile.trialData && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-800">Debug Information</CardTitle>
              <CardDescription className="text-orange-600">
                Development only - Trial system debugging data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm text-orange-800 mb-2">Trial Data:</h4>
                  <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-40">
                    {JSON.stringify(userProfile.trialData, null, 2) || 'No trial data'}
                  </pre>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-orange-800 mb-2">Email Schedule Status:</h4>
                  <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-32">
                    {JSON.stringify(userProfile.emailScheduleStatus, null, 2) || 'No email schedule data'}
                  </pre>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-orange-800 mb-2">Actions:</h4>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        console.log('🔄 [DEBUG] Manual profile refresh triggered');
                        getUserProfile();
                      }}
                    >
                      Refresh Profile Data
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        console.log('📊 [DEBUG] Current profile state:', userProfile);
                        console.log('👤 [DEBUG] Clerk user data:', user);
                      }}
                    >
                      Log Current State
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
} 