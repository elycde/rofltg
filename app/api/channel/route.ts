import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const BOT_TOKEN = process.env.BOT_TOKEN || 'REPLACE_ME'
const CHAT_ID = '@fromoldnuke7'
const HISTORY_FILE = path.join(process.cwd(), 'server', 'subs-history.json')

async function readHistory() {
  try {
    const raw = await fs.readFile(HISTORY_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch (_) {}
  return []
}

async function writeHistory(history: any[]) {
  try {
    await fs.writeFile(HISTORY_FILE, JSON.stringify(history), 'utf8')
  } catch (e: any) {
    console.error('Failed to write history file', e.message)
  }
}

function trimHistory(history: any[], maxDays = 14) {
  const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000
  return history.filter((item) => item.ts >= cutoff)
}

async function recordCount(count: number) {
  if (typeof count !== 'number') return
  let history = await readHistory()
  history = trimHistory(history)
  const last = history[history.length - 1]
  if (!last || last.count !== count) {
    history.push({ ts: Date.now(), count })
    await writeHistory(history)
  }
}

function computeDelta(history: any[], hours: number) {
  if (!Array.isArray(history) || history.length === 0) return null
  const now = Date.now()
  const cutoff = now - hours * 60 * 60 * 1000
  const latest = history[history.length - 1]?.count

  let base = null
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i]
    if (item.ts <= cutoff) {
      base = item.count
      break
    }
  }

  if (base === null) base = history[0].count
  return typeof latest === 'number' && typeof base === 'number' ? latest - base : null
}

export async function GET() {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${CHAT_ID}`
    const response = await fetch(url)
    const data = await response.json()

    if (!data.ok) {
      return NextResponse.json({
        title: 'fromoldnuke7',
        username: 'fromoldnuke7',
        subscribers: 15234,
        delta24h: 127,
        delta7d: 892,
        photo: 'https://t.me/i/userpic/320/fromoldnuke7.jpg',
        demo: true,
        error: 'Демо режим: токен бота недействителен'
      })
    }

    const chat = data.result
    let subscribers = null

    try {
      const countRes = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getChatMemberCount?chat_id=${CHAT_ID}`
      )
      const countData = await countRes.json()
      if (countData.ok) subscribers = countData.result
    } catch (e) {}

    if (typeof subscribers === 'number') {
      await recordCount(subscribers)
    }
    const history = await readHistory()
    const delta24h = computeDelta(history, 24)
    const delta7d = computeDelta(history, 24 * 7)

    const photo = chat.username ? `https://t.me/i/userpic/320/${chat.username}.jpg` : null

    return NextResponse.json({
      title: chat.title,
      username: chat.username,
      subscribers,
      delta24h,
      delta7d,
      photo
    })
  } catch (err: any) {
    return NextResponse.json({
      title: 'fromoldnuke7',
      username: 'fromoldnuke7',
      subscribers: 15234,
      delta24h: 127,
      delta7d: 892,
      photo: 'https://t.me/i/userpic/320/fromoldnuke7.jpg',
      demo: true,
      error: err.message
    })
  }
}
