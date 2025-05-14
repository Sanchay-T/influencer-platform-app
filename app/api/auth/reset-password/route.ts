import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token not provided' },
        { status: 400 }
      )
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'The password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    console.log('Recibida solicitud para actualizar contraseña con token')
    
    // Crear un cliente de Supabase para el usuario
    const supabase = await createClient()
    
    try {
      // Intentar actualizar la contraseña directamente
      // Esto funcionará si el usuario ya tiene una sesión válida establecida
      console.log('Intentando actualizar contraseña directamente')
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })
      
      if (!updateError) {
        console.log('Contraseña actualizada correctamente')
        return NextResponse.json({ success: true })
      }
      
      console.log('No se pudo actualizar la contraseña directamente:', updateError)
      
      // Si no se pudo actualizar directamente, intentar con el admin client
      // Esto requiere conocer el ID del usuario
      const { data: userData } = await supabase.auth.getUser()
      
      if (userData && userData.user) {
        console.log('Usuario encontrado, actualizando contraseña con admin client:', userData.user.id)
        
        const { error: adminUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          userData.user.id,
          { password }
        )
        
        if (adminUpdateError) {
          console.error('Error updating password with admin client:', adminUpdateError)
          return NextResponse.json(
            { error: 'Error updating password: ' + adminUpdateError.message },
            { status: 500 }
          )
        }
        
        console.log('Contraseña actualizada correctamente con admin client')
        return NextResponse.json({ success: true })
      }
      
      // Si no se pudo obtener el usuario, devolver un error
      return NextResponse.json(
        { error: 'Could not establish the session. Please request a new recovery link.' },
        { status: 400 }
      )
    } catch (innerError) {
      console.error('Error updating password:', innerError)
      return NextResponse.json(
        { error: 'Error updating the password. Please request a new recovery link.' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
} 