import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut({ scope: 'global' })
    // Redirigir SIEMPRE al login para limpiar el estado del cliente
    return NextResponse.redirect(new URL('/auth/login', request.url))
  } catch (err) {
    console.error('Error inesperado al cerrar sesión:', err)
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
}

// También permitimos GET para mayor compatibilidad
export async function GET(request) {
  return POST(request)
} 