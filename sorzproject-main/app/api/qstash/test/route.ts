import { NextResponse } from 'next/server'
import { Receiver } from "@upstash/qstash"

// Inicializar el receptor de QStash
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

export async function POST(req: Request) {
  console.log('🚀 Test endpoint called')
  
  // Log de todas las variables de entorno relevantes (sin mostrar valores sensibles)
  console.log('🔧 Variables de entorno:', {
    QSTASH_CURRENT_SIGNING_KEY: !!process.env.QSTASH_CURRENT_SIGNING_KEY,
    QSTASH_NEXT_SIGNING_KEY: !!process.env.QSTASH_NEXT_SIGNING_KEY
  })
  
  const signature = req.headers.get('Upstash-Signature')
  console.log('🔑 Signature:', signature)
  
  const body = await req.text()
  console.log('📦 Body:', body)
  
  // Log de todos los headers
  console.log('📝 Headers:', Object.fromEntries(req.headers.entries()))

  try {
    // Primero respondemos con éxito para verificar la conexión básica
    return NextResponse.json({ 
      message: 'Test endpoint reached successfully',
      receivedBody: body,
      receivedSignature: !!signature,
      headers: Object.fromEntries(req.headers.entries())
    })
  } catch (error) {
    console.error('❌ Error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}