'use client'

import React, { useState, FormEvent, useEffect, Suspense } from 'react'
import { createClient } from '@/app/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Loader2 } from "lucide-react"

// Componente interno que utiliza useSearchParams
function UpdatePasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Configurar la página y escuchar eventos de autenticación
  useEffect(() => {
    const setupPage = async () => {
      try {
        // Verificar si estamos en el navegador
        if (typeof window === 'undefined') return

        console.log('URL completa:', window.location.href)
        
        const supabase = createClient()
        
        // Verificar si hay una sesión activa
        const { data: sessionData } = await supabase.auth.getSession()
        
        if (sessionData.session) {
          console.log('Sesión existente encontrada')
          setIsReady(true)
          return
        }
        
        // Si no hay sesión, configurar un listener para eventos de autenticación
        // Esto es especialmente útil para el flujo de recuperación de contraseña
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('Evento de autenticación detectado:', event)
          
          if (event === 'PASSWORD_RECOVERY') {
            console.log('Evento de recuperación de contraseña detectado')
            setIsReady(true)
          } else if (session) {
            console.log('Sesión establecida')
            setIsReady(true)
          }
        })
        
        // Si llegamos aquí sin una sesión, verificar si hay un hash en la URL
        // que podría contener tokens de acceso
        const hash = window.location.hash
        if (hash && hash.length > 1) {
          console.log('Hash detectado en la URL')
          setIsReady(true)
        } else {
          // Si no hay hash ni sesión, verificar si hay un token en los parámetros
          const token = searchParams?.get('token')
          if (token) {
            console.log('Token detectado en los parámetros de búsqueda')
            setIsReady(true)
          } else {
            console.error('No se encontró token ni sesión activa')
            setError('No se pudo establecer la sesión. Por favor, solicita un nuevo enlace de recuperación.')
          }
        }
        
        // Limpiar el listener cuando el componente se desmonte
        return () => {
          authListener.subscription.unsubscribe()
        }
      } catch (err: any) {
        console.error('Error al configurar la página:', err)
        setError('Error al configurar la página: ' + (err.message || 'Error desconocido'))
      }
    }

    setupPage()
  }, [searchParams])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    // Validación básica
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    try {
      // Intentar actualizar la contraseña directamente con Supabase
      console.log('Actualizando contraseña con sesión activa')
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        console.error('Error al actualizar contraseña con Supabase:', error)
        
        // Si falla la actualización directa, intentar con nuestra API
        console.log('Intentando actualizar con API personalizada')
        const token = searchParams?.get('token') || ''
        
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: token,
            password: password
          }),
        })

        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error || 'Error al actualizar la contraseña')
        }
      }

      // Mostrar mensaje de éxito
      setSuccess('Password successfully updated. Redirecting to login...')
      
      // Esperar un momento antes de redirigir
      setTimeout(async () => {
        // Cerrar sesión después de actualizar la contraseña
        await supabase.auth.signOut()
        
        // Redirigir al login con mensaje de éxito
        router.push('/auth/login?message=Password successfully updated')
      }, 2000)
    } catch (err: any) {
      console.error('Error al actualizar contraseña:', err)
      setError(err.message || 'Error al actualizar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  // Si aún no estamos listos, mostrar un indicador de carga
  if (!isReady && !error) {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Loading...</CardTitle>
            <CardDescription>
              Preparing the password recovery form
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Update Password</CardTitle>
          <CardDescription>
            Enter your new password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-500">
                {error}
              </div>
            )}

            {success && (
              <div className="text-sm text-green-500">
                {success}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full"
              disabled={loading || !isReady}
            >
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente principal que envuelve el formulario en un límite de Suspense
export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Loading...</CardTitle>
            <CardDescription>
              Preparing the password recovery form
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    }>
      <UpdatePasswordForm />
    </Suspense>
  )
} 