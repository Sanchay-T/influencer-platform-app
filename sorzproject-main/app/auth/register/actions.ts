'use server'

import { createClient } from '@/utils/supabase/server'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import { db } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema'
import { redirect } from 'next/navigation'

const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production env.
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel.
    'http://localhost:3000/'
  // Make sure to include `https://` when not localhost.
  url = url.includes('http') ? url : `https://${url}`
  // Make sure to include trailing `/`.
  url = url.charAt(url.length - 1) === '/' ? url : `${url}/`
  return url
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    name: formData.get('name') as string,
    company_name: formData.get('company_name') as string,
    industry: formData.get('industry') as string,
  }

  // Validate required fields
  if (!data.email || !data.password || !data.name || !data.company_name || !data.industry) {
    return redirect('/auth/register?error=All fields are required')
  }

  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${getURL()}auth/callback`,
        data: {
          name: data.name,
          company_name: data.company_name,
          industry: data.industry,
        },
      },
    })

    if (signUpError) {
      console.error('SignUp error:', signUpError)
      return redirect('/auth/register?error=' + signUpError.message)
    }

    if (!signUpData.user) {
      return redirect('/auth/register?error=Failed to create account')
    }

    console.log('Usuario creado exitosamente:', signUpData.user.id)

    // Create user profile using Drizzle
    try {
      const [profile] = await db.insert(userProfiles).values({
        userId: signUpData.user.id,
        name: data.name,
        company_name: data.company_name,
        industry: data.industry,
        email: data.email.toLowerCase()
      }).returning()

      console.log('Perfil creado exitosamente:', profile.id)
      return redirect('/auth/verify-email')

    } catch (profileError) {
      console.error('Error creating profile with Drizzle:', profileError)
      
      // Si falla el perfil, intentar eliminar el usuario de Auth
      try {
        await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id)
        console.log('Usuario eliminado después de fallo en perfil')
      } catch (deleteError) {
        console.error('Error eliminando usuario:', deleteError)
      }
      
      return redirect('/auth/register?error=Failed to create user profile')
    }

  } catch (error) {
    console.error('Error general en registro:', error)
    return redirect('/auth/register?error=Registration failed. Please try again.')
  }
} 