import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const CHAT_ID = '@fromoldnuke7'
const TGSTAT_TOKEN = process.env.TGSTAT_TOKEN

let postsCache: any = null
let postsCacheTime = 0
const POSTS_CACHE_TTL = 5 * 60 * 1000

export async function GET() {
  try {
    if (postsCache && Date.now() - postsCacheTime < POSTS_CACHE_TTL) {
      return NextResponse.json(postsCache)
    }

    const channelUsername = CHAT_ID.replace('@', '')
    
    // Читаем из JSON файла (Python парсер)
    const POSTS_FILE = path.join(process.cwd(), 'server', 'telegram-posts.json')
    try {
      const fileData = await fs.readFile(POSTS_FILE, 'utf8')
      const jsonData = JSON.parse(fileData)
      console.log(`✓ Loaded ${jsonData.posts.length} posts from Python parser`)
      
      postsCache = jsonData
      postsCacheTime = Date.now()
      
      return NextResponse.json(jsonData)
    } catch (fileError) {
      console.log('JSON file not found, trying TGStat API...')
    }
    
    // Fallback на TGStat API
    if (TGSTAT_TOKEN) {
      try {
        const allPosts = []
        let offset = 0
        const limit = 50
        const maxRequests = 3
        
        for (let i = 0; i < maxRequests; i++) {
          const tgstatUrl = `https://api.tgstat.ru/channels/posts?token=${TGSTAT_TOKEN}&channelId=${channelUsername}&limit=${limit}&offset=${offset}&extended=1`
          const tgstatResponse = await fetch(tgstatUrl)
          const tgstatData = await tgstatResponse.json()
          
          if (tgstatData.status === 'error') break
          
          if (tgstatData.status === 'ok' && tgstatData.response?.items) {
            allPosts.push(...tgstatData.response.items)
            if (tgstatData.response.items.length < limit) break
            offset += limit
          } else {
            break
          }
        }
        
        if (allPosts.length > 0) {
          const posts = allPosts
            .filter((item: any) => item.is_deleted !== 1)
            .map((item: any) => {
              const text = item.text || ''
              let photo = null
              
              if (item.media) {
                if (item.media.media_type === 'mediaPhoto' && item.media.file_url) {
                  photo = item.media.file_url
                } else if (item.media.media_type === 'mediaDocument' && item.media.file_thumbnail_url) {
                  photo = item.media.file_thumbnail_url
                } else if (item.media.mime_type === 'image/webp' && item.media.file_url) {
                  photo = item.media.file_url
                }
              }
              
              if (text && !photo) {
                const youtubeMatch = text.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
                if (youtubeMatch) {
                  photo = `https://img.youtube.com/vi/${youtubeMatch[1]}/maxresdefault.jpg`
                }
              }
              
              const cleanText = text
                .replace(/<a[^>]*>(.*?)<\/a>/g, '$1')
                .replace(/<[^>]+>/g, '')
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .trim()
              
              if (!cleanText && !photo) return null
              
              return {
                id: item.id,
                text: cleanText.substring(0, 300),
                date: item.date * 1000,
                views: item.views || 0,
                reactions: 0,
                photo
              }
            })
            .filter(Boolean)
          
          posts.sort((a: any, b: any) => b.views - a.views)
          
          const result = {
            posts,
            channel: {
              username: channelUsername,
              title: channelUsername,
              photo: `https://t.me/i/userpic/320/${channelUsername}.jpg`
            }
          }
          
          postsCache = result
          postsCacheTime = Date.now()
          
          return NextResponse.json(result)
        }
      } catch (tgstatError) {
        console.error('TGStat API error:', tgstatError)
      }
    }

    // Демо посты
    const demoPosts = [
      {
        id: 1,
        text: '🎮 Новое видео на канале! Смотрите прямо сейчас',
        date: Date.now() - 3600000,
        views: 1234,
        reactions: 45,
        photo: null
      },
      {
        id: 2,
        text: '🔥 Сегодня разбираем самые горячие новости игровой индустрии. Не пропустите!',
        date: Date.now() - 7200000,
        views: 2345,
        reactions: 67,
        photo: null
      },
      {
        id: 3,
        text: '💎 Эксклюзивный контент только для подписчиков',
        date: Date.now() - 10800000,
        views: 3456,
        reactions: 89,
        photo: null
      }
    ]

    const result = {
      posts: demoPosts,
      channel: {
        username: channelUsername,
        title: channelUsername,
        photo: `https://t.me/i/userpic/320/${channelUsername}.jpg`
      }
    }

    postsCache = result
    postsCacheTime = Date.now()

    return NextResponse.json(result)
  } catch (err) {
    console.error('Error fetching posts:', err)
    return NextResponse.json({
      posts: [],
      channel: {
        username: 'fromoldnuke7',
        title: 'fromoldnuke7',
        photo: 'https://t.me/i/userpic/320/fromoldnuke7.jpg'
      }
    })
  }
}
