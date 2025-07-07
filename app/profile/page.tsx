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

export default function ProfileSettingsPage() {
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userProfile, setUserProfile] = useState({
    name: '',
    companyName: '',
    industry: '',
    email: ''
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
            email: user.emailAddresses?.[0]?.emailAddress || ''
          });
        } else {
          // Profile doesn't exist yet, set default values from Clerk
          console.log('ℹ️ [PROFILE-PAGE] No profile found, using Clerk user data');
          setUserProfile({
            name: user.fullName || '',
            companyName: '',
            industry: '',
            email: user.emailAddresses?.[0]?.emailAddress || ''
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
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Profile</h2>
          <p className="text-muted-foreground">
            Manage your personal information and account settings
          </p>
        </div>
        
        <Separator />

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
    </DashboardLayout>
  );
} 