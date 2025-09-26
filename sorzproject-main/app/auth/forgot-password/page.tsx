'use client'

import React, { useState, FormEvent } from 'react'
import { createClient } from '@/app/lib/supabase'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import Link from 'next/link'

// Función para obtener la URL base correcta
const getBaseUrl = () => {
  // Intentar obtener la URL del sitio desde las variables de entorno
  let url = process.env.NEXT_PUBLIC_SITE_URL || 
            process.env.NEXT_PUBLIC_VERCEL_URL

  // Si estamos en desarrollo local, usar localhost
  if (!url || url.includes('localhost')) {
    url = 'http://localhost:3000'
  } else if (!url.includes('http')) {
    // Asegurarse de que la URL incluya https para producción
    url = `https://${url}`
  }
  
  // Asegurarse de que la URL no termine con /
  return url.endsWith('/') ? url.slice(0, -1) : url
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const supabase = createClient()
      
      // URL de redirección a la página de actualización de contraseña
      const redirectUrl = `${getBaseUrl()}/auth/update-password`
      
      console.log('Enviando email de recuperación a:', email)
      console.log('URL de redirección:', redirectUrl)

      // Enviar el email de recuperación con la URL correcta
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      })

      if (error) {
        throw error
      }

      setMessage('Recovery email sent. Please check your inbox and also the spam folder.')
    } catch (err: any) {
      console.error('Reset password error:', err)
      setError('Error sending the recovery email: ' + (err.message || 'Please try again later'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Recover Password</CardTitle>
          <CardDescription>
            Enter your email to receive a recovery link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="text-sm text-red-500">
                {error}
              </div>
            )}

            {message && (
              <div className="text-sm text-green-500">
                {message}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Recovery Email"}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Did you remember your password?{" "}
              <Link 
                href="/auth/login" 
                className="text-primary hover:underline underline-offset-4"
              >
                Back to login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 