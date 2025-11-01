import { NextResponse } from 'next/server'

const videosCache = new Map()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const handle = (searchParams.get('handle') || '').replace(/^@/, '').trim()
  const maxResults = Math.min(100, parseInt(searchParams.get('maxResults') || '50', 10) || 50)

  if (!handle) {
    return NextResponse.json({ error: 'Missing handle query parameter' }, { status: 400 })
  }

  if (!/^[A-Za-z0-9_\-]{2,100}$/.test(handle)) {
    return NextResponse.json({ error: 'Invalid handle format' }, { status: 400 })
  }

  const cacheKey = `${handle}:${maxResults}`
  const TTL = 120 * 1000
  const cached = videosCache.get(cacheKey)

  if (cached && (Date.now() - cached.ts) < TTL) {
    return NextResponse.json({ items: cached.items, cached: true })
  }

  try {
    const parseVideosFromHTML = (html: string) => {
      const idx = html.indexOf('ytInitialData')
      if (idx === -1) return null

      const start = html.indexOf('{', idx)
      if (start === -1) return null

      let i = start, depth = 0, end = -1
      const L = html.length

      for (; i < L; i++) {
        const ch = html[i]
        if (ch === '{') depth++
        else if (ch === '}') {
          depth--
          if (depth === 0) {
            end = i
            break
          }
        }
      }

      if (end === -1) return null

      const jsonStr = html.slice(start, end + 1)
      let data = null

      try {
        data = JSON.parse(jsonStr)
      } catch (e) {
        return null
      }

      const found: any[] = []
      const walk = (obj: any) => {
        if (!obj || typeof obj !== 'object') return
        if (obj.videoRenderer && obj.videoRenderer.videoId) {
          found.push(obj.videoRenderer)
          return
        }
        if (obj.reelItemRenderer && obj.reelItemRenderer.videoId) {
          const reelData = obj.reelItemRenderer
          const videoRenderer = {
            videoId: reelData.videoId,
            title: reelData.headline || { simpleText: 'Short видео' },
            thumbnail: reelData.thumbnail,
            publishedTimeText: { simpleText: 'Недавно' },
            viewCountText: reelData.viewCountText || { simpleText: '0 просмотров' },
            lengthText: { simpleText: '0:30' },
            isShort: true
          }
          found.push(videoRenderer)
          return
        }
        for (const k of Object.keys(obj)) {
          try {
            walk(obj[k])
          } catch (_) {}
        }
      }

      walk(data)
      return found
    }

    const getVideosFromPage = async (url: string) => {
      try {
        const resp = await fetch(url)
        if (!resp.ok) return null
        const html = await resp.text()
        return parseVideosFromHTML(html)
      } catch (e) {
        return null
      }
    }

    const [mainPageVideos, shortsVideos, regularVideos] = await Promise.all([
      getVideosFromPage(`https://www.youtube.com/@${encodeURIComponent(handle)}`),
      getVideosFromPage(`https://www.youtube.com/@${encodeURIComponent(handle)}/shorts`),
      getVideosFromPage(`https://www.youtube.com/@${encodeURIComponent(handle)}/videos`)
    ])

    const allVideos: any[] = []
    const seenIds = new Set()

    const addVideos = (videos: any[] | null, source: string) => {
      if (!videos) return
      videos.forEach(video => {
        if (!seenIds.has(video.videoId)) {
          seenIds.add(video.videoId)
          allVideos.push({ ...video, source })
        }
      })
    }

    addVideos(mainPageVideos, 'main')
    addVideos(shortsVideos, 'shorts')
    addVideos(regularVideos, 'videos')

    if (!allVideos.length) {
      return NextResponse.json({ items: [] })
    }

    const items = allVideos.slice(0, maxResults).map(vr => {
      const vid = vr.videoId
      const title = vr.title?.runs?.[0]?.text || vr.title?.simpleText || 'Видео'
      const thumbs = vr.thumbnail?.thumbnails
      const thumb = Array.isArray(thumbs) && thumbs.length ? thumbs[thumbs.length - 1].url : null
      const published = vr.publishedTimeText?.simpleText || vr.publishedTimeText?.runs?.[0]?.text || null

      let viewCount = 0
      if (vr.viewCountText) {
        const viewText = vr.viewCountText.simpleText || vr.viewCountText.runs?.[0]?.text || ''
        const viewMatch = viewText.match(/([0-9,.\s]+)/)
        if (viewMatch) {
          const numStr = viewMatch[1].replace(/[,\s]/g, '')
          const num = parseInt(numStr, 10)
          if (!isNaN(num)) viewCount = num
        }
      }

      let durationSeconds = 0
      let isShort = vr.isShort || false

      if (vr.lengthText?.simpleText) {
        const duration = vr.lengthText.simpleText
        const match = duration.match(/^(?:(\d+):)?(\d+):(\d+)$/)
        if (match) {
          const hours = parseInt(match[1] || '0')
          const minutes = parseInt(match[2])
          const seconds = parseInt(match[3])
          durationSeconds = hours * 3600 + minutes * 60 + seconds

          if (durationSeconds <= 60) {
            isShort = true
          }
        }
      }

      return {
        id: vid,
        title,
        description: null,
        thumbnail: thumb,
        publishedAt: published,
        viewCount,
        url: vid ? `https://www.youtube.com/watch?v=${vid}` : null,
        durationSeconds,
        isShort,
        source: vr.source || 'unknown'
      }
    })

    videosCache.set(cacheKey, { ts: Date.now(), items })
    return NextResponse.json({ items })

  } catch (err: any) {
    const cached = videosCache.get(cacheKey)
    if (cached && Array.isArray(cached.items) && cached.items.length) {
      return NextResponse.json({
        items: cached.items,
        cached: true,
        note: 'Returned cached data due to network error'
      })
    }

    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
