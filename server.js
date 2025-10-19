import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// BOT token should come from environment for safety. If not set, 'REPLACE_ME' will be used.
const BOT_TOKEN = process.env.BOT_TOKEN || 'REPLACE_ME';
const CHAT_ID = "@fromoldnuke7";

// отдаём статику (фронтенд)
app.use(express.static(path.join(__dirname, "public")));

// === Хранилище истории подписчиков (файл) ===
const HISTORY_FILE = path.join(__dirname, "subs-history.json");

// Simple in-memory cache for YouTube video lists to reduce external requests
const videosCache = new Map(); // key -> { ts, items }

async function readHistory() {
  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) { }
  return [];
}

async function writeHistory(history) {
  try {
    await fs.writeFile(HISTORY_FILE, JSON.stringify(history), "utf8");
  } catch (e) {
    console.error("Failed to write history file", e.message);
  }
}

function trimHistory(history, maxDays = 14) {
  const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000;
  return history.filter((item) => item.ts >= cutoff);
}

async function recordCount(count) {
  if (typeof count !== "number") return;
  let history = await readHistory();
  history = trimHistory(history);
  const last = history[history.length - 1];
  if (!last || last.count !== count) {
    history.push({ ts: Date.now(), count });
    await writeHistory(history);
  }
}

function computeDelta(history, hours) {
  if (!Array.isArray(history) || history.length === 0) return null;
  const now = Date.now();
  const cutoff = now - hours * 60 * 60 * 1000;
  const latest = history[history.length - 1]?.count;
  // находим ближайшую точку к cutoff (но не позже cutoff)
  let base = null;
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.ts <= cutoff) { base = item.count; break; }
  }
  // если нет точки до cutoff — берём самую раннюю
  if (base === null) base = history[0].count;
  return typeof latest === "number" && typeof base === "number" ? latest - base : null;
}

// API для канала
app.get("/api/channel", async (req, res) => {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${CHAT_ID}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok) return res.status(500).json({ error: data });

    const chat = data.result;
    // получаем количество подписчиков
    let subscribers = null;
    try {
      const countRes = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getChatMemberCount?chat_id=${CHAT_ID}`
      );
      const countData = await countRes.json();
      if (countData.ok) subscribers = countData.result;
    } catch (e) {
      // игнорируем, вернём null, чтобы фронт справился
    }

    // записываем в историю и считаем метрики
    if (typeof subscribers === "number") {
      await recordCount(subscribers);
    }
    const history = await readHistory();
    const delta24h = computeDelta(history, 24);
    const delta7d = computeDelta(history, 24 * 7);

    res.json({
      title: chat.title,
      username: chat.username,
      subscribers,
      delta24h,
      delta7d,
      photo: chat.photo
        ? `https://api.telegram.org/file/bot${BOT_TOKEN}/${(
          await (
            await fetch(
              `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${chat.photo.big_file_id}`
            )
          ).json()
        ).result.file_path}`
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SSE поток подписчиков
app.get("/api/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let isClosed = false;
  let lastCount = null;

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // функция запроса количества подписчиков
  const fetchCount = async () => {
    try {
      const countRes = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getChatMemberCount?chat_id=${CHAT_ID}`
      );
      const countData = await countRes.json();
      if (countData.ok) {
        const current = countData.result;
        if (typeof current === "number") {
          await recordCount(current);
          const history = await readHistory();
          const delta24h = computeDelta(history, 24);
          const delta7d = computeDelta(history, 24 * 7);
          if (current !== lastCount) {
            lastCount = current;
            send("subscribers", { subscribers: current, delta24h, delta7d });
          }
        }
      } else {
        send("error", { message: "Telegram API error", payload: countData });
      }
    } catch (e) {
      send("error", { message: e.message });
    }
  };

  // немедленный первый запрос
  fetchCount();
  // периодический опрос
  const intervalId = setInterval(fetchCount, 15000);

  req.on("close", () => {
    isClosed = true;
    clearInterval(intervalId);
    res.end();
  });
});

// === YouTube videos (simple server-side proxy) ===
// Returns latest videos for a given channel handle (strip leading @ if present).
// Use environment variable YT_API_KEY to authenticate. Do NOT commit the API key.
app.get('/api/videos', async (req, res) => {
  const apiKey = process.env.YT_API_KEY;
  const handle = (req.query.handle || '').replace(/^@/, '').trim();
  const maxResults = Math.min(50, parseInt(req.query.maxResults || '8', 10) || 8);

  if (!handle) return res.status(400).json({ error: 'Missing handle query parameter' });

  // basic validation to avoid abuse
  if (!/^[A-Za-z0-9_\-]{2,100}$/.test(handle)) return res.status(400).json({ error: 'Invalid handle format' });

  const cacheKey = `${handle}:${maxResults}`;
  const TTL = 120 * 1000; // 2 minutes
  const cached = videosCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < TTL) {
    return res.json({ items: cached.items, cached: true });
  }

  try {
    // If API key is provided, prefer Data API v3 (more reliable)
    if (apiKey) {
      const q = encodeURIComponent(handle);
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${q}&key=${apiKey}&maxResults=1`;
      const searchRes = await fetch(searchUrl);
      const searchJson = await searchRes.json();
      if (!searchJson.items || !searchJson.items.length) return res.status(404).json({ error: 'Channel not found' });

      const channelId = searchJson.items[0].snippet.channelId;
      const videosUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=${maxResults}&key=${apiKey}`;
      const videosRes = await fetch(videosUrl);
      const videosJson = await videosRes.json();

      // Получаем статистику для видео (просмотры)
      const videoIds = videosJson.items.map(it => it.id.videoId).filter(Boolean);
      let statsMap = {};

      if (videoIds.length > 0) {
        try {
          const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds.join(',')}&key=${apiKey}`;
          const statsRes = await fetch(statsUrl);
          const statsJson = await statsRes.json();

          if (statsJson.items) {
            statsJson.items.forEach(item => {
              if (item.statistics && item.statistics.viewCount) {
                statsMap[item.id] = parseInt(item.statistics.viewCount, 10);
              }
            });
          }
        } catch (e) {
          console.warn('Failed to fetch video statistics:', e.message);
        }
      }

      const items = (videosJson.items || []).map(it => ({
        id: it.id.videoId,
        title: it.snippet.title,
        description: it.snippet.description,
        thumbnail: (it.snippet.thumbnails && (it.snippet.thumbnails.medium || it.snippet.thumbnails.default || it.snippet.thumbnails.high)) ? (it.snippet.thumbnails.medium || it.snippet.thumbnails.default || it.snippet.thumbnails.high).url : null,
        publishedAt: it.snippet.publishedAt,
        viewCount: statsMap[it.id.videoId] || 0,
        url: it.id.videoId ? `https://www.youtube.com/watch?v=${it.id.videoId}` : null
      }));

      videosCache.set(cacheKey, { ts: Date.now(), items });
      return res.json({ items });
    }

    // Fallback when no API key: try public RSS feeds (user or channel)
    // 1) Try user-based feed
    const tryUserFeed = async (user) => {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(user)}`;
      const r = await fetch(feedUrl);
      if (!r.ok) return null;
      return await r.text();
    };

    // 2) Try channel feed by resolving channelId from channel page
    const tryChannelFeedByHandle = async (h) => {
      // fetch channel page and search for "channelId":"UC..."
      const pageRes = await fetch(`https://www.youtube.com/@${encodeURIComponent(h)}`);
      if (!pageRes.ok) return null;
      const html = await pageRes.text();
      const m = html.match(/"channelId":"(UC[0-9A-Za-z_-]{20,})"/);
      if (!m) return null;
      const channelId = m[1];
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      const r = await fetch(feedUrl);
      if (!r.ok) return null;
      return await r.text();
    };

    // 3) Try videos page and parse ytInitialData JSON to extract videoRenderer entries
    const tryVideosPage = async (h) => {
      try {
        const url = `https://www.youtube.com/@${encodeURIComponent(h)}/videos`;
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const html = await resp.text();

        // find the ytInitialData JSON blob
        const idx = html.indexOf('ytInitialData');
        if (idx === -1) return null;
        // find first '{' after the token
        const start = html.indexOf('{', idx);
        if (start === -1) return null;
        // extract balanced JSON object
        let i = start; let depth = 0; let end = -1; const L = html.length;
        for (; i < L; i++) {
          const ch = html[i];
          if (ch === '{') depth++;
          else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end === -1) return null;
        const jsonStr = html.slice(start, end + 1);
        let data = null;
        try { data = JSON.parse(jsonStr); } catch (e) {
          // parsing failed
          return null;
        }

        // recursively search for videoRenderer objects
        const found = [];
        const walk = (obj) => {
          if (!obj || typeof obj !== 'object') return;
          if (obj.videoRenderer && obj.videoRenderer.videoId) {
            found.push(obj.videoRenderer);
            return;
          }
          for (const k of Object.keys(obj)) {
            try { walk(obj[k]); } catch (_) { }
          }
        };
        walk(data);
        if (!found.length) return null;

        const itemsFromPage = found.map(vr => {
          const vid = vr.videoId;
          const title = vr.title && vr.title.runs && vr.title.runs[0] && vr.title.runs[0].text ? vr.title.runs[0].text : (vr.title && vr.title.simpleText) || 'Видео';
          const thumbs = vr.thumbnail && vr.thumbnail.thumbnails ? vr.thumbnail.thumbnails : null;
          const thumb = Array.isArray(thumbs) && thumbs.length ? thumbs[thumbs.length - 1].url : null;
          const published = vr.publishedTimeText && (vr.publishedTimeText.simpleText || (vr.publishedTimeText.runs && vr.publishedTimeText.runs[0] && vr.publishedTimeText.runs[0].text)) || null;

          // Попытка извлечь количество просмотров
          let viewCount = 0;
          if (vr.viewCountText) {
            const viewText = vr.viewCountText.simpleText || (vr.viewCountText.runs && vr.viewCountText.runs[0] && vr.viewCountText.runs[0].text) || '';
            const viewMatch = viewText.match(/([0-9,.\s]+)/);
            if (viewMatch) {
              const numStr = viewMatch[1].replace(/[,\s]/g, '');
              const num = parseInt(numStr, 10);
              if (!isNaN(num)) viewCount = num;
            }
          }

          return {
            id: vid,
            title,
            description: null,
            thumbnail: thumb,
            publishedAt: published,
            viewCount,
            url: vid ? `https://www.youtube.com/watch?v=${vid}` : null
          };
        });

        return itemsFromPage;
      } catch (e) {
        return null;
      }
    };

    let xml = await tryUserFeed(handle);
    let items = [];
    if (xml) {
      // Parse minimal RSS XML to extract entries (no external XML parser dependency)
      const entryRegex = /<entry[\s\S]*?<\/entry>/g;
      const entries = xml.match(entryRegex) || [];
      for (let i = 0; i < Math.min(entries.length, maxResults); i++) {
        const e = entries[i];
        const idMatch = e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || e.match(/<id>.*?:video:(.*?)<\/id>/);
        const titleMatch = e.match(/<title>([\s\S]*?)<\/title>/);
        const pubMatch = e.match(/<published>([^<]+)<\/published>/);
        const thumbMatch = e.match(/<media:thumbnail[^>]*?url=["']([^"']+)["'][^>]*\/?>/) || e.match(/<media:content[^>]*?url=["']([^"']+)["'][^>]*\/?>/);
        const vid = idMatch ? idMatch[1] : null;
        items.push({
          id: vid,
          title: titleMatch ? titleMatch[1] : 'Видео',
          description: null,
          thumbnail: thumbMatch ? thumbMatch[1] : null,
          publishedAt: pubMatch ? pubMatch[1] : null,
          viewCount: 0, // RSS не содержит информацию о просмотрах
          url: vid ? `https://www.youtube.com/watch?v=${vid}` : null
        });
      }
    }

    if (items.length) { videosCache.set(cacheKey, { ts: Date.now(), items }); return res.json({ items }); }

    // If RSS didn't yield results, try parsing the /videos page for initial data
    const pageItems = await tryVideosPage(handle);
    if (pageItems && pageItems.length) { videosCache.set(cacheKey, { ts: Date.now(), items: pageItems.slice(0, maxResults) }); return res.json({ items: pageItems.slice(0, maxResults) }); }

    return res.status(404).json({ error: 'Channel feed not found (no API key and RSS/HTML fallback failed)' });
  } catch (err) {
    // Improve error handling: if we have cached results, return them instead of failing.
    console.error('YT proxy error', err && (err.message || err.code));
    const cached = videosCache.get(cacheKey);
    if (cached && Array.isArray(cached.items) && cached.items.length) {
      console.warn('Returning cached YouTube results due to fetch error');
      return res.json({ items: cached.items, cached: true, note: 'Returned cached data due to network error' });
    }

    // If DNS resolution failed, return 502 with a helpful message
    const isDnsError = err && (err.code === 'ENOTFOUND' || (err.message && err.message.includes('ENOTFOUND')));
    const status = isDnsError ? 502 : 500;
    const message = isDnsError ? `DNS resolution failed when contacting YouTube (${err.hostname || 'youtube.com'})` : (err && err.message) || String(err);
    res.status(status).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
  if (!process.env.BOT_TOKEN || process.env.BOT_TOKEN === 'REPLACE_ME') {
    console.warn('Warning: BOT_TOKEN is not set. Telegram features will be limited. Set BOT_TOKEN in environment.');
  }
});
