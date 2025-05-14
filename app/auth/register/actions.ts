'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

const getURL = () => {
  console.log('🔗 [SERVER-ACTION] Generating URL for email redirect');
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production env.
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel.
    'http://localhost:3000/'
  // Make sure to include `https://` when not localhost.
  url = url.includes('http') ? url : `https://${url}`
  // Make sure to include trailing `/`.
  url = url.charAt(url.length - 1) === '/' ? url : `${url}/`
  console.log('🔗 [SERVER-ACTION] Generated URL:', url);
  return url
}

export async function signUp(formData: FormData) {
  console.log('🔐 [SERVER-ACTION] Signup action triggered');
  
  console.log('🔄 [SERVER-ACTION] Creating Supabase client');
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    name: formData.get('name') as string,
    company_name: formData.get('company_name') as string,
    industry: formData.get('industry') as string,
  }

  console.log('📥 [SERVER-ACTION] Received form data:', {
    email: data.email ? `${data.email.substring(0, 3)}...` : undefined,
    hasPassword: !!data.password,
    name: data.name ? `${data.name.substring(0, 3)}...` : undefined,
    hasCompanyName: !!data.company_name,
    hasIndustry: !!data.industry,
  });

  // Validate required fields
  if (!data.email || !data.password || !data.name || !data.company_name || !data.industry) {
    console.error('❌ [SERVER-ACTION] Validation failed: Missing required fields', {
      hasEmail: !!data.email,
      hasPassword: !!data.password,
      hasName: !!data.name,
      hasCompanyName: !!data.company_name,
      hasIndustry: !!data.industry
    });
    return redirect('/auth/register?error=All fields are required')
  }
  console.log('✅ [SERVER-ACTION] Form validation passed');

  console.log('🔄 [SERVER-ACTION] Calling Supabase Auth signUp');
  const redirectUrl = `${getURL()}auth/callback`;
  console.log('🔗 [SERVER-ACTION] Redirect URL for auth:', redirectUrl);
  
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: redirectUrl,
      data: {
        name: data.name,
        company_name: data.company_name,
        industry: data.industry,
      },
    },
  })

  if (signUpError) {
    console.error('❌ [SERVER-ACTION] Supabase signUp error:', {
      message: signUpError.message,
      status: signUpError.status,
      name: signUpError.name
    });
    return redirect('/auth/register?error=' + encodeURIComponent(signUpError.message))
  }

  if (!signUpData.user) {
    console.error('❌ [SERVER-ACTION] No user returned from Supabase signUp');
    return redirect('/auth/register?error=Failed to create account')
  }
  
  console.log('✅ [SERVER-ACTION] Supabase Auth signup successful', {
    userId: signUpData.user.id,
    email: signUpData.user.email ? `${signUpData.user.email.substring(0, 3)}...` : undefined,
  });

  console.log('🔄 [SERVER-ACTION] Creating user profile in database');
  // Create user profile
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      user_id: signUpData.user.id,
      name: data.name,
      company_name: data.company_name,
      industry: data.industry,
    })

  if (profileError) {
    console.error('❌ [SERVER-ACTION] Profile creation error:', {
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
      code: profileError.code
    });
    return redirect('/auth/register?error=Failed to create user profile')
  }

  console.log('🎉 [SERVER-ACTION] Registration successful, redirecting to verify-email page');
  return redirect('/auth/verify-email')
} 