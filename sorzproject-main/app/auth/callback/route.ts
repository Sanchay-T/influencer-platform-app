import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const next = requestUrl.searchParams.get('next') || '/'
    const type = requestUrl.searchParams.get('type')
    
    // Registrar información para depuración
    console.log('Callback recibido con código:', code ? 'presente' : 'ausente')
    console.log('Tipo de autenticación:', type || 'no especificado')
    console.log('Redirigiendo a:', next)
    
    if (!code) {
      console.error('No se proporcionó código de verificación')
      return NextResponse.redirect(
        new URL('/auth/login?error=No se proporcionó código de verificación', request.url)
      )
    }

    const supabase = await createClient()
    
    // Intercambiar el código por una sesión
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Error al intercambiar código por sesión:', error)
      return NextResponse.redirect(
        new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, request.url)
      )
    }

    // Si es una recuperación de contraseña, redirigir a la página de actualización de contraseña
    if (type === 'recovery' || next.includes('/auth/update-password')) {
      console.log('Detectado flujo de recuperación de contraseña')
      
      // Verificar que la sesión se haya establecido correctamente
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        console.error('No se pudo establecer la sesión después del intercambio de código')
        return NextResponse.redirect(
          new URL('/auth/login?error=No se pudo establecer la sesión. Por favor, solicita un nuevo enlace de recuperación.', request.url)
        )
      }
      
      console.log('Sesión establecida correctamente, redirigiendo a actualización de contraseña')
      
      // Incluir los tokens en la URL para que la página de actualización de contraseña pueda usarlos
      const redirectUrl = new URL('/auth/update-password', request.url)
      redirectUrl.hash = `access_token=${session.access_token}&refresh_token=${session.refresh_token}`
      
      return NextResponse.redirect(redirectUrl)
    }

    // Para otros flujos, redirigir a la página especificada
    return NextResponse.redirect(new URL(next, request.url))
  } catch (error) {
    console.error('Error inesperado en callback:', error)
    return NextResponse.redirect(
      new URL('/auth/login?error=Ocurrió un error inesperado', request.url)
    )
  }
} 