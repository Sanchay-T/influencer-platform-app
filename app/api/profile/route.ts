import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { userProfiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    console.log('🔐 [PROFILE-API] Getting authenticated user from Clerk');
    const { userId } = await auth();

    if (!userId) {
      console.error('❌ [PROFILE-API] Unauthorized - No valid user session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('✅ [PROFILE-API] User authenticated', { userId });

    const { name, companyName, industry } = await request.json();
    console.log('📥 [PROFILE-API] Profile data received', { name, companyName, industry });

    // Verificar si ya existe un perfil
    console.log('🔍 [PROFILE-API] Checking for existing profile');
    const existingUser = await db.query.userProfiles.findFirst({
      where: (userProfiles, { eq }) => eq(userProfiles.userId, userId),
    });

    if (existingUser) {
      console.log('⚠️ [PROFILE-API] Profile already exists for user');
      return NextResponse.json({ 
        error: 'Ya existe un perfil para este usuario' 
      }, { status: 400 });
    }

    // Crear el perfil
    console.log('🔄 [PROFILE-API] Creating new profile');
    const [profile] = await db.insert(userProfiles).values({
      userId,
      name,
      companyName,
      industry,
    }).returning();

    console.log('✅ [PROFILE-API] Profile created successfully', { profileId: profile.id });
    return NextResponse.json(profile);
  } catch (error: any) {
    console.error('💥 [PROFILE-API] Error creating profile:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
} 