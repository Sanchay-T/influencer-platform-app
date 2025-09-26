import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const { email, password, name, company_name, industry } = await request.json();

    // Validate that all required fields are present
    if (!email || !password || !name || !company_name || !industry) {
      return NextResponse.json({ 
        error: 'All fields are required' 
      }, { status: 400 });
    }

    // Ensure we have a valid redirect URL
    const site_url = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000';
    const redirectTo = `${site_url}/auth/confirm-email`;

    console.log('Attempting registration with:', {
      email,
      name,
      company_name,
      industry,
      redirectTo
    });

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
      console.error('SignUp error details:', {
        message: signUpError.message,
        status: signUpError.status,
        name: signUpError.name
      });
      return NextResponse.json({ 
        error: signUpError.message 
      }, { status: 400 });
    }

    if (!auth.user) {
      return NextResponse.json({ 
        error: 'Could not create user' 
      }, { status: 400 });
    }

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
      console.error('Profile creation error:', profileError);
      // If profile creation fails, delete the user
      await supabaseAdmin.auth.admin.deleteUser(auth.user.id);
      
      return NextResponse.json({ 
        error: 'Error creating user profile' 
      }, { status: 400 });
    }

    console.log('Registration successful:', {
      userId: auth.user.id,
      email: auth.user.email
    });

    return NextResponse.json({
      message: 'Registration successful. Please verify your email.',
      user: auth.user,
    });

  } catch (err: any) {
    console.error('Registration error:', err);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 