import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Para rutas de QStash y scraping, permitir todos los headers necesarios
  if (request.nextUrl.pathname.startsWith('/api/qstash/') || request.nextUrl.pathname.startsWith('/api/scraping/')) {
    // Permitir CORS para las rutas
    const response = NextResponse.next()
    
    // Permitir los headers necesarios
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', '*')
    
    // Si es una solicitud OPTIONS, responder inmediatamente
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: response.headers,
      })
    }
    
    return response
  }

  // Para todas las demás rutas, manejar la autenticación
  try {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return request.cookies.get(name)?.value
          },
          set(name, value, options) {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name, options) {
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    // Verificar si el usuario está autenticado
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.error('Error al obtener el usuario:', error)
      
      // Si el error es que el usuario no existe, limpiar las cookies
      if (error.status === 403 && error.code === 'user_not_found') {
        console.log('Usuario no encontrado, limpiando cookies de sesión')
        // Limpiar todas las cookies de Supabase
        const cookiesToClear = [
          'sb-access-token',
          'sb-refresh-token', 
          'supabase-auth-token',
          'supabase.auth.token'
        ]
        
        cookiesToClear.forEach(cookieName => {
          response.cookies.set({
            name: cookieName,
            value: '',
            expires: new Date(0),
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production'
          })
        })
        
        // Si no es una ruta pública, redirigir a login
        const publicRoutes = [
          '/auth/login',
          '/auth/register',
          '/auth/verify-email',
          '/auth/callback',
          '/auth/forgot-password',
          '/auth/update-password',
          '/auth/verify',
          '/api/test' // Agregado para pruebas solamente
        ]
        
        const isPublicRoute = publicRoutes.some(route => 
          request.nextUrl.pathname === route || 
          request.nextUrl.pathname.startsWith(route + '/')
        )
        
        if (!isPublicRoute) {
          const redirectUrl = new URL('/auth/login', request.url)
          return NextResponse.redirect(redirectUrl)
        }
        
        // Si es una ruta pública, continuar sin usuario
        return response
      }
    }

    // Rutas públicas que no requieren autenticación
    const publicRoutes = [
      '/auth/login',
      '/auth/register',
      '/auth/verify-email',
      '/auth/callback',
      '/auth/forgot-password',
      '/auth/update-password',
      '/auth/verify',
      '/api/test' // Agregado para pruebas solamente
    ]
    
    // Verificar si la ruta actual es pública
    const isPublicRoute = publicRoutes.some(route => 
      request.nextUrl.pathname === route || 
      request.nextUrl.pathname.startsWith(route + '/')
    )

    // Si el usuario no está autenticado y trata de acceder a rutas protegidas
    if (!user && !isPublicRoute) {
      console.log('Usuario no autenticado intentando acceder a ruta protegida:', request.nextUrl.pathname)
      const redirectUrl = new URL('/auth/login', request.url)
      return NextResponse.redirect(redirectUrl)
    }

    // Si el usuario está autenticado y trata de acceder a páginas de auth (excepto update-password)
    if (user && isPublicRoute && request.nextUrl.pathname !== '/auth/update-password') {
      console.log('Usuario autenticado intentando acceder a ruta pública:', request.nextUrl.pathname)
      const redirectUrl = new URL('/', request.url)
      return NextResponse.redirect(redirectUrl)
    }

    return response
  } catch (error) {
    // Si hay algún error, redirigimos a login por seguridad
    console.error('Middleware error:', error)
    const redirectUrl = new URL('/auth/login', request.url)
    return NextResponse.redirect(redirectUrl)
  }
}

export const config = {
  matcher: [
    // Proteger todas las rutas excepto las estáticas y públicas
    '/((?!_next/static|_next/image|favicon.ico|public|assets).*)',
    // Proteger las rutas de API
    '/api/:path*'
  ]
} 