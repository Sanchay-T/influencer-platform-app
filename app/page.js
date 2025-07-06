'use client'

import DashboardLayout from "./components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import CampaignList from "./components/campaigns/CampaignList";
import { PlusCircle } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs';

export default function Home() {
  return (
    <>
      <SignedOut>
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="w-full max-w-md space-y-8 text-center">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                Influencer Platform
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
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Your campaigns</h1>
            <Link href="/campaigns/new">
              <Button>
                <PlusCircle className="mr-2" /> Create campaign
              </Button>
            </Link>
          </div>
          <CampaignList />
        </DashboardLayout>
      </SignedIn>
    </>
  );
}
