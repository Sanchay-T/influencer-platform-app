import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const token = requestUrl.searchParams.get('token')
    const type = requestUrl.searchParams.get('type')
    const redirectTo = requestUrl.searchParams.get('redirect_to')
    
    // Registrar información para depuración
    console.log('Verify recibido con token:', token ? 'presente' : 'ausente')
    console.log('Tipo de verificación:', type || 'no especificado')
    console.log('Redirección solicitada a:', redirectTo || 'no especificada')
    
    if (!token) {
      console.error('No se proporcionó token de verificación')
      return NextResponse.redirect(
        new URL('/auth/login?error=No se proporcionó token de verificación', request.url)
      )
    }

    // Si es una recuperación de contraseña, intercambiar el token por una sesión
    if (type === 'recovery') {
      console.log('Detectado flujo de recuperación de contraseña')
      
      const supabase = await createClient()
      
      // Verificar el token
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'recovery',
      })
      
      if (error) {
        console.error('Error al verificar el token:', error)
        return NextResponse.redirect(
          new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, request.url)
        )
      }
      
      // Si la verificación fue exitosa, redirigir a la página de actualización de contraseña
      console.log('Token verificado correctamente, redirigiendo a actualización de contraseña')
      
      // Redirigir a la página de actualización de contraseña con el token
      const redirectUrl = new URL('/auth/update-password', request.url)
      
      // Añadir el token como parámetro de búsqueda
      redirectUrl.searchParams.set('token', token)
      redirectUrl.searchParams.set('type', type)
      redirectUrl.searchParams.set('verified', 'true')
      
      console.log('Redirigiendo a:', redirectUrl.toString())
      return NextResponse.redirect(redirectUrl)
    }

    // Para otros tipos de verificación, usar el redirectTo si está disponible
    if (redirectTo) {
      const redirectUrl = new URL(redirectTo)
      
      // Añadir el token y tipo como parámetros de búsqueda
      redirectUrl.searchParams.set('token', token)
      if (type) redirectUrl.searchParams.set('type', type)
      
      console.log('Redirigiendo a URL proporcionada:', redirectUrl.toString())
      return NextResponse.redirect(redirectUrl)
    }

    // Si no hay redirectTo, redirigir a la página principal
    console.log('No se proporcionó URL de redirección, redirigiendo a la página principal')
    return NextResponse.redirect(new URL('/', request.url))
  } catch (error) {
    console.error('Error inesperado en verify:', error)
    return NextResponse.redirect(
      new URL('/auth/login?error=Ocurrió un error inesperado', request.url)
    )
  }
} 