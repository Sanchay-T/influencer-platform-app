import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

export async function POST(request: Request) {
  console.log('🔐 [REGISTER] POST request received');
  
  try {
    const requestData = await request.json();
    console.log('📥 [REGISTER] Request data received:', {
      email: requestData.email ? `${requestData.email.substring(0, 3)}...` : undefined, // Partially mask email for privacy in logs
      name: requestData.name ? `${requestData.name.substring(0, 3)}...` : undefined, // Partially mask name
      hasPassword: !!requestData.password,
      hasCompanyName: !!requestData.company_name,
      hasIndustry: !!requestData.industry
    });
    
    const { email, password, name, company_name, industry } = requestData;

    // Validate that all required fields are present
    if (!email || !password || !name || !company_name || !industry) {
      console.error('❌ [REGISTER] Validation failed: Missing required fields', {
        hasEmail: !!email,
        hasPassword: !!password,
        hasName: !!name,
        hasCompanyName: !!company_name,
        hasIndustry: !!industry
      });
      return NextResponse.json({ 
        error: 'All fields are required' 
      }, { status: 400 });
    }
    console.log('✅ [REGISTER] Input validation successful');

    // Ensure we have a valid redirect URL
    const site_url = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'; // Prioritize NEXT_PUBLIC_SITE_URL
    const redirectTo = `${site_url}/auth/confirm-email`;
    console.log('🔗 [REGISTER] Redirect URL constructed:', redirectTo);

    console.log('🔄 [REGISTER] Attempting registration with Supabase');
    // Register user using signUp
    const { data: auth, error: signUpError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          name,
          company_name,
          industry,
        },
      },
    });

    if (signUpError) {
      console.error('❌ [REGISTER] Supabase SignUp error:', {
        message: signUpError.message,
        status: signUpError.status,
        name: signUpError.name,
        stack: signUpError.stack
      });
      // Default user-friendly message
      let userMessage = 'An unexpected error occurred during registration. Please try again.';
      
      // Check for specific Supabase Auth error messages to provide more context
      if (signUpError.message.toLowerCase().includes('rate limit') || signUpError.message.toLowerCase().includes('for security purposes')) {
        console.log('ℹ️ [REGISTER] Rate limit error detected');
        userMessage = 'Too many registration attempts. Please wait a few minutes and try again. If you previously attempted to register, please check your email for a verification link.';
      } else if (signUpError.message.toLowerCase().includes('user already registered')) {
        console.log('ℹ️ [REGISTER] User already registered error detected');
        userMessage = 'This email address is already registered. Please try logging in or use the password recovery option.';
      } else if (signUpError.message.toLowerCase().includes('check your email for the confirmation link')) {
        console.log('ℹ️ [REGISTER] Confirmation email sent message detected');
        userMessage = 'Registration initiated. Please check your email for a confirmation link to complete the process.';
      }
      console.log('🚫 [REGISTER] Returning error response to client:', userMessage);

      return NextResponse.json({ 
        error: userMessage 
      }, { status: signUpError.status || 400 });
    }

    if (!auth.user) {
      console.error('❌ [REGISTER] No user data returned from Supabase after successful signup');
      return NextResponse.json({ 
        error: 'Could not create user' 
      }, { status: 400 });
    }
    
    console.log('✅ [REGISTER] Supabase Auth signup successful', {
      userId: auth.user.id,
      email: auth.user.email ? `${auth.user.email.substring(0, 3)}...` : undefined,
    });

    console.log('🔄 [REGISTER] Creating user profile in database');
    // Create user profile
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        user_id: auth.user.id,
        name,
        company_name,
        industry,
        email: email.toLowerCase(), // Store email in lowercase
      });

    if (profileError) {
      console.error('❌ [REGISTER] Profile creation error:', {
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint,
        code: profileError.code
      });
      
      console.log('🔄 [REGISTER] Attempting to delete the user after profile creation failure');
      // If profile creation fails, delete the user
      try {
        await supabaseAdmin.auth.admin.deleteUser(auth.user.id);
        console.log('✅ [REGISTER] User deleted successfully after profile creation failure');
      } catch (deleteError) {
        console.error('❌ [REGISTER] Failed to delete user after profile creation error:', deleteError);
      }
      
      return NextResponse.json({ 
        error: 'Error creating user profile' 
      }, { status: 400 });
    }

    console.log('🎉 [REGISTER] Registration completely successful!', {
      userId: auth.user.id,
      email: auth.user.email ? `${auth.user.email.substring(0, 3)}...` : undefined,
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({
      message: 'Registration successful. Please verify your email.',
      user: auth.user,
    });

  } catch (err: any) {
    console.error('💥 [REGISTER] Unexpected error during registration:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 