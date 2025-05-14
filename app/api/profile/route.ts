import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const { name, company_name, industry, user_id } = await request.json();

    // Verificar si ya existe un perfil
    const { data: existingUser } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (existingUser) {
      return NextResponse.json({ 
        error: 'Ya existe un perfil para este usuario' 
      }, { status: 400 });
    }

    // Crear el perfil
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        user_id,
        name,
        company_name,
        industry,
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error creando perfil:', profileError);
      return NextResponse.json({ 
        error: `Error al crear el perfil: ${profileError.message}` 
      }, { status: 400 });
    }

    return NextResponse.json(profile);
  } catch (error: any) {
    console.error('Error en la creación del perfil:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
} 