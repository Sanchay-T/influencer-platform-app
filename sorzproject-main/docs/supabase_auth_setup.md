# Configuración de Autenticación con Supabase y Next.js

Este documento describe paso a paso cómo implementar la autenticación con Supabase en una aplicación Next.js, utilizando Server-Side Rendering (SSR) y el manejo de cookies.

## Índice
1. [Requisitos Previos](#requisitos-previos)
2. [Instalación de Dependencias](#instalación-de-dependencias)
3. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
4. [Estructura de Archivos](#estructura-de-archivos)
5. [Implementación Paso a Paso](#implementación-paso-a-paso)
6. [Manejo de Cookies y SSR](#manejo-de-cookies-y-ssr)
7. [Flujo de Autenticación](#flujo-de-autenticación)
8. [Solución de Problemas Comunes](#solución-de-problemas-comunes)



## Instalación de Dependencias

```bash
npm install @supabase/ssr @supabase/supabase-js
```

## Configuración de Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Estructura de Archivos

```
├── app/
│   ├── auth/
│   │   ├── callback/
│   │   │   └── route.ts
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   ├── actions.ts
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   ├── update-password/
│   │   │   └── page.tsx
│   │   ├── verify/
│   │   │   └── route.ts
│   │   └── verify-email/
│   │       └── page.tsx
│   ├── api/
│   │   └── auth/
│   │       └── reset-password/
│   │           └── route.ts
│   └── components/
│       └── auth/
│           └── RegisterForm.tsx
├── utils/
│   └── supabase/
│       ├── client.ts
│       ├── server.ts
│       └── admin.ts
└── middleware.ts
```

## Implementación Paso a Paso

### 1. Configuración del Cliente Supabase (utils/supabase/server.ts)

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = cookieStore.get(name);
          return cookie?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          const cookie: ResponseCookie = {
            name,
            value,
            ...options,
            sameSite: 'lax',
            httpOnly: true,
          };
          cookieStore.set(cookie);
        },
        remove(name: string, options: CookieOptions) {
          const cookie: ResponseCookie = {
            name,
            value: '',
            ...options,
            maxAge: 0,
            sameSite: 'lax',
            httpOnly: true,
          };
          cookieStore.set(cookie);
        },
      },
    }
  );
}
```

### 2. Cliente del Navegador (utils/supabase/client.ts)

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### 3. Middleware para Protección de Rutas (middleware.ts)

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name, options) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Rutas públicas que no requieren autenticación
  const publicRoutes = [
    '/auth/login',
    '/auth/register',
    '/auth/verify-email',
    '/auth/callback',
    '/auth/forgot-password',
    '/auth/update-password',
    '/auth/verify'
  ];
  
  const isPublicRoute = publicRoutes.includes(request.nextUrl.pathname);

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  if (user && isPublicRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### 4. Callback de Autenticación (app/auth/callback/route.ts)

```typescript
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    
    if (!code) {
      return NextResponse.redirect(
        new URL('/auth/login?error=No verification code provided', request.url)
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(
        new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, request.url)
      );
    }

    return NextResponse.redirect(new URL('/auth/login', request.url));
  } catch (error) {
    console.error('Unexpected error in callback:', error);
    return NextResponse.redirect(
      new URL('/auth/login?error=An unexpected error occurred', request.url)
    );
  }
}
```


## Flujo de Autenticación

1. **Registro**:
   - Usuario completa el formulario
   - Se crea la cuenta en Supabase
   - Se envía email de verificación
   - Redirección a página de verificación

2. **Verificación de Email**:
   - Usuario recibe email con link
   - Click en link lleva a `/auth/callback`
   - Callback intercambia código por sesión
   - Redirección a login

3. **Login**:
   - Usuario ingresa credenciales
   - Supabase verifica y crea sesión
   - Cookies se establecen automáticamente
   - Redirección a dashboard



## Manejo de Cookies y SSR

El manejo de cookies es crucial para la autenticación en SSR. Los puntos clave son:

1. **Cookies Seguras**: Configuradas como `httpOnly` y `sameSite: 'lax'`
2. **Persistencia de Sesión**: Manejada automáticamente por Supabase
3. **Middleware**: Intercepta todas las rutas para verificar la autenticación

## Solución de Problemas Comunes

1. **Página en Blanco en Callback**:
   - Asegúrate de que la URL en el email coincida con la configuración
   - Verifica que el código de verificación esté presente
   - Revisa los logs del servidor

2. **Errores de Cookie**:
   - Verifica la configuración de `sameSite` y `httpOnly`
   - Asegúrate de que el dominio coincida
   - Revisa el middleware

3. **Redirecciones Infinitas**:
   - Verifica las rutas públicas en el middleware
   - Asegúrate de que la verificación de usuario funcione
   - Revisa la lógica de redirección

## Configuración en Supabase

1. **Dashboard de Supabase**:
   - Configura URL del sitio
   - Añade URLs de redirección permitidas

2. **URLs Importantes**:
   ```
   Site URL: localhost:3000
   Redirect URLs::3000
   - localhost:3000/auth/callback:3000
   - localhost:3000/auth/login
   - localhost:3000/auth/verify
   ```

## Notas de Seguridad

1. Siempre usa HTTPS en producción
2. Mantén las claves de API seguras
3. Implementa rate limiting en endpoints sensibles
4. Revisa regularmente los logs de autenticación

## Recursos Adicionales

- [Documentación de Supabase Auth](https://supabase.com/docs/guides/auth)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Supabase SSR Helper](https://github.com/supabase/auth-helpers) 