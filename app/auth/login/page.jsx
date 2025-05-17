'use client'

import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { createClient } from "@/app/lib/supabase"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Move all initial logging into useEffect to prevent hydration errors
  useEffect(() => {
    // This will only run on the client after hydration is complete
    console.log('🖥️ [CLIENT] Login page mounted');
    
    // Prefetch dashboard to speed up redirect after login
    router.prefetch('/');
    
    return () => {
      console.log('🖥️ [CLIENT] Login page unmounted');
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // These logs are fine since they only run after user interaction (post-hydration)
    console.log('🔐 [CLIENT] Login form submitted', { email: email ? `${email.substring(0, 3)}...` : 'empty' });
    
    setLoading(true)
    setError(null)
    
    console.log('🔄 [CLIENT] Creating Supabase client');
    const supabase = createClient()
    
    try {
      console.log('🔄 [CLIENT] Attempting sign in with Supabase');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('❌ [CLIENT] Supabase login error:', error.message);
        throw error;
      }

      console.log('✅ [CLIENT] Login successful!', {
        userId: data?.user?.id,
        email: data?.user?.email ? `${data.user.email.substring(0, 3)}...` : 'none'
      });
      
      console.log('🔄 [CLIENT] Redirecting to homepage');
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('🚫 [CLIENT] Login failed:', error.message);
      setError(error.message)
      console.log('❌ [CLIENT] Login attempt completed');
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-muted-foreground hover:underline underline-offset-4"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            {error && (
              <div className="text-sm text-red-500">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full flex items-center justify-center"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Sign in'
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link 
                href="/auth/register" 
                className="text-primary hover:underline underline-offset-4"
              >
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 