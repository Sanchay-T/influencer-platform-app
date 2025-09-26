'use client';

import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Mail, ArrowRight } from "lucide-react";
import Link from 'next/link';

export default function VerifyEmailPage() {
  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Check your email</CardTitle>
          <CardDescription className="text-center">
            We've sent you a verification link to complete your registration
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <Mail className="h-12 w-12 text-primary" />
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Click the link in your email to verify your account and complete the registration process.
            </p>
            <p className="text-sm text-muted-foreground">
              If you don't see the email, check your spam folder.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground text-center">
            Already verified?{" "}
            <Link 
              href="/auth/login" 
              className="text-primary hover:underline underline-offset-4 inline-flex items-center gap-1"
            >
              Sign in <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
} 