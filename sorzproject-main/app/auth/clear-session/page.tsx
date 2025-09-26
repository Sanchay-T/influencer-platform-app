'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function ClearSessionPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function clearSession() {
      try {
        // Cerrar sesión en Supabase
        await supabase.auth.signOut()
        
        // Limpiar cookies manualmente
        const cookiesToClear = [
          'sb-access-token',
          'sb-refresh-token',
          'supabase-auth-token',
          'supabase.auth.token'
        ]
        
        cookiesToClear.forEach(cookieName => {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
        })
        
        // Redirigir después de limpiar
        setTimeout(() => {
          router.push('/auth/login')
        }, 2000)
        
      } catch (error) {
        console.error('Error clearing session:', error)
        // Redirigir de todas formas
        setTimeout(() => {
          router.push('/auth/login')
        }, 2000)
      }
    }

    clearSession()
  }, [router, supabase.auth])

  return (
    <div className="max-w-md mx-auto p-6 mt-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Limpiando sesión...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            Se están limpiando las cookies de sesión. Serás redirigido al login en unos segundos.
          </p>
        </CardContent>
      </Card>
    </div>
  )
} 