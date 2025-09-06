import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'

const LOG_FILE = `${process.cwd()}/onboarding-logs`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const timestamp = new Date().toISOString()
    const line = `[${timestamp.replace('T',' ').replace('Z','')}] [${body?.step ?? 'UNKNOWN'}] [${body?.action ?? 'UNKNOWN'}] - ${body?.description ?? ''}`
    await fs.appendFile(LOG_FILE, line + '\n', 'utf8')
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to write log' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const linesParam = Number(searchParams.get('lines') || 50)
    const content = await fs.readFile(LOG_FILE, 'utf8').catch(() => '')
    const lines = content ? content.trim().split('\n') : []
    return NextResponse.json({ lines: lines.slice(-linesParam) })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to read log' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await fs.writeFile(LOG_FILE, '', 'utf8')
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to clear log' }, { status: 500 })
  }
}

