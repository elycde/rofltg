import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем переменные окружения из корневой папки
config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001; // Изменен порт для разработки

// BOT token should come from environment for safety
const BOT_TOKEN = process.env.BOT_TOKEN || 'REPLACE_ME';
const CHAT_ID = "@fromoldnuke7";

// Serve static files from React build
app.use(express.static(path.join(__dirname, "../dist")));

// === Хранилище истории подписчиков ===
const HISTORY_FILE = path.join(__dirname, "subs-history.json");

// Simple cache for YouTube videos
const videosCache = new Map();

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

  let base = null;
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.ts <= cutoff) {
      base = item.count;
      break;
    }
  }

  if (base === null) base = history[0].count;
  return typeof latest === "number" && typeof base === "number" ? latest - base : null;
}

// API для канала
app.get("/api/channel", async (req, res) => {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${CHAT_ID}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok) {
      // Возвращаем демо данные для показа
      return res.json({
        title: 'fromoldnuke7',
        username: 'fromoldnuke7',
        subscribers: 15234,
        delta24h: 127,
        delta7d: 892,
        photo: 'https://t.me/i/userpic/320/fromoldnuke7.jpg',
        demo: true,
        error: 'Демо режим: токен бота недействителен'
      });
    }

    const chat = data.result;

    // Получаем количество подписчиков
    let subscribers = null;
    try {
      const countRes = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getChatMemberCount?chat_id=${CHAT_ID}`
      );
      const countData = await countRes.json();
      if (countData.ok) subscribers = countData.result;
    } catch (e) {
      // Игнорируем ошибку
    }

    // Записываем в историю и считаем метрики
    if (typeof subscribers === "number") {
      await recordCount(subscribers);
    }
    const history = await readHistory();
    const delta24h = computeDelta(history, 24);
    const delta7d = computeDelta(history, 24 * 7);

    // Используем прямую ссылку на аватарку Telegram
    const photo = chat.username ? `https://t.me/i/userpic/320/${chat.username}.jpg` : null;

    res.json({
      title: chat.title,
      username: chat.username,
      subscribers,
      delta24h,
      delta7d,
      photo
    });
  } catch (err) {
    // Возвращаем демо данные
    res.json({
      title: 'fromoldnuke7',
      username: 'fromoldnuke7',
      subscribers: 15234,
      delta24h: 127,
      delta7d: 892,
      photo: 'https://t.me/i/userpic/320/fromoldnuke7.jpg',
      demo: true,
      error: err.message
    });
  }
});

// SSE поток подписчиков
app.get("/api/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders?.();

  let lastCount = null;

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

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

  // Немедленный первый запрос
  fetchCount();

  // Периодический опрос
  const intervalId = setInterval(fetchCount, 15000);

  req.on("close", () => {
    clearInterval(intervalId);
    res.end();
  });
});

// Очистка кэша (временный endpoint для отладки)
app.get('/api/clear-cache', (req, res) => {
  videosCache.clear();
  res.json({ message: 'Кэш очищен' });
});

// YouTube Shorts API (отдельный endpoint)
app.get('/api/shorts', async (req, res) => {
  const handle = (req.query.handle || '').replace(/^@/, '').trim();
  const maxResults = Math.min(100, parseInt(req.query.maxResults || '50', 10) || 50);

  if (!handle) return res.status(400).json({ error: 'Missing handle query parameter' });

  if (!/^[A-Za-z0-9_\-]{2,100}$/.test(handle)) {
    return res.status(400).json({ error: 'Invalid handle format' });
  }

  const cacheKey = `shorts:${handle}:${maxResults}`;
  const TTL = 120 * 1000; // 2 minutes
  const cached = videosCache.get(cacheKey);

  if (cached && (Date.now() - cached.ts) < TTL) {
    return res.json({ items: cached.items, cached: true });
  }

  try {
    const url = `https://www.youtube.com/@${encodeURIComponent(handle)}/shorts`;
    
    const resp = await fetch(url);
    if (!resp.ok) {
      return res.json({ items: [] });
    }
    
    const html = await resp.text();
    
    // Парсим ytInitialData
    const idx = html.indexOf('ytInitialData');
    if (idx === -1) {
      return res.json({ items: [] });
    }

    const start = html.indexOf('{', idx);
    if (start === -1) return res.json({ items: [] });

    let i = start, depth = 0, end = -1;
    const L = html.length;

    for (; i < L; i++) {
      const ch = html[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end === -1) return res.json({ items: [] });

    const jsonStr = html.slice(start, end + 1);
    let data = null;

    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      return res.json({ items: [] });
    }

    const found = [];
    const walk = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      // Ищем reelItemRenderer для Shorts
      if (obj.reelItemRenderer && obj.reelItemRenderer.videoId) {
        found.push(obj.reelItemRenderer);
        return;
      }
      
      // Также ищем videoRenderer (на случай если Shorts представлены как обычные видео)
      if (obj.videoRenderer && obj.videoRenderer.videoId) {
        found.push(obj.videoRenderer);
        return;
      }
      
      for (const k of Object.keys(obj)) {
        try {
          walk(obj[k]);
        } catch (_) { }
      }
    };

    walk(data);

    const items = found.slice(0, maxResults).map(vr => {
      const vid = vr.videoId;
      
      // Для reelItemRenderer
      if (vr.headline) {
        const title = vr.headline.simpleText || 'Short видео';
        const thumbs = vr.thumbnail && vr.thumbnail.thumbnails ? vr.thumbnail.thumbnails : null;
        const thumb = Array.isArray(thumbs) && thumbs.length ? thumbs[thumbs.length - 1].url : null;
        
        let viewCount = 0;
        if (vr.viewCountText) {
          const viewText = vr.viewCountText.simpleText || '';
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
          publishedAt: 'Недавно',
          viewCount,
          url: vid ? `https://www.youtube.com/shorts/${vid}` : null,
          durationSeconds: 30,
          isShort: true,
          source: 'shorts'
        };
      }
      
      // Для videoRenderer
      const title = vr.title && vr.title.runs && vr.title.runs[0] && vr.title.runs[0].text ?
        vr.title.runs[0].text : (vr.title && vr.title.simpleText) || 'Short видео';
      const thumbs = vr.thumbnail && vr.thumbnail.thumbnails ? vr.thumbnail.thumbnails : null;
      const thumb = Array.isArray(thumbs) && thumbs.length ? thumbs[thumbs.length - 1].url : null;
      const published = vr.publishedTimeText && (vr.publishedTimeText.simpleText ||
        (vr.publishedTimeText.runs && vr.publishedTimeText.runs[0] && vr.publishedTimeText.runs[0].text)) || 'Недавно';

      let viewCount = 0;
      if (vr.viewCountText) {
        const viewText = vr.viewCountText.simpleText ||
          (vr.viewCountText.runs && vr.viewCountText.runs[0] && vr.viewCountText.runs[0].text) || '';
        const viewMatch = viewText.match(/([0-9,.\s]+)/);
        if (viewMatch) {
          const numStr = viewMatch[1].replace(/[,\s]/g, '');
          const num = parseInt(numStr, 10);
          if (!isNaN(num)) viewCount = num;
        }
      }

      let durationSeconds = 30;
      if (vr.lengthText && vr.lengthText.simpleText) {
        const duration = vr.lengthText.simpleText;
        const match = duration.match(/^(?:(\d+):)?(\d+):(\d+)$/);
        if (match) {
          const hours = parseInt(match[1] || 0);
          const minutes = parseInt(match[2]);
          const seconds = parseInt(match[3]);
          durationSeconds = hours * 3600 + minutes * 60 + seconds;
        }
      }

      return {
        id: vid,
        title,
        description: null,
        thumbnail: thumb,
        publishedAt: published,
        viewCount,
        url: vid ? `https://www.youtube.com/shorts/${vid}` : null,
        durationSeconds,
        isShort: true,
        source: 'shorts'
      };
    });

    videosCache.set(cacheKey, { ts: Date.now(), items });
    return res.json({ items });

  } catch (err) {
    return res.json({ items: [] });
  }
});

// YouTube videos API
app.get('/api/videos', async (req, res) => {
  const apiKey = process.env.YT_API_KEY;
  const handle = (req.query.handle || '').replace(/^@/, '').trim();
  const maxResults = Math.min(100, parseInt(req.query.maxResults || '50', 10) || 50);

  if (!handle) return res.status(400).json({ error: 'Missing handle query parameter' });

  if (!/^[A-Za-z0-9_\-]{2,100}$/.test(handle)) {
    return res.status(400).json({ error: 'Invalid handle format' });
  }

  const cacheKey = `${handle}:${maxResults}`;
  const TTL = 120 * 1000; // 2 minutes
  const cached = videosCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.ts) < TTL) {
    return res.json({ items: cached.items, cached: true });
  }

  try {
    // Используем парсинг главной страницы канала - она содержит ВСЕ видео включая Shorts!
    // Фильтрация Shorts происходит на клиенте по желанию пользователя

    // Функция для парсинга видео с любой страницы
    const parseVideosFromHTML = (html) => {
      const idx = html.indexOf('ytInitialData');
      if (idx === -1) {
        return null;
      }

      const start = html.indexOf('{', idx);
      if (start === -1) return null;

      let i = start, depth = 0, end = -1;
      const L = html.length;

      for (; i < L; i++) {
        const ch = html[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }

      if (end === -1) return null;

      const jsonStr = html.slice(start, end + 1);
      let data = null;

      try {
        data = JSON.parse(jsonStr);
      } catch (e) {
        return null;
      }

      const found = [];
      const walk = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj.videoRenderer && obj.videoRenderer.videoId) {
          found.push(obj.videoRenderer);
          return;
        }
        // Также ищем reelItemRenderer для Shorts
        if (obj.reelItemRenderer && obj.reelItemRenderer.videoId) {
          // Преобразуем reelItemRenderer в формат videoRenderer
          const reelData = obj.reelItemRenderer;
          const videoRenderer = {
            videoId: reelData.videoId,
            title: reelData.headline || { simpleText: 'Short видео' },
            thumbnail: reelData.thumbnail,
            publishedTimeText: { simpleText: 'Недавно' },
            viewCountText: reelData.viewCountText || { simpleText: '0 просмотров' },
            lengthText: { simpleText: '0:30' }, // Shorts обычно до 60 сек
            isShort: true // Помечаем как Short
          };
          found.push(videoRenderer);
          return;
        }
        for (const k of Object.keys(obj)) {
          try {
            walk(obj[k]);
          } catch (_) { }
        }
      };

      walk(data);
      return found;
    };

    // Парсинг главной страницы канала
    const getVideosFromMainPage = async (h) => {
      try {
        const url = `https://www.youtube.com/@${encodeURIComponent(h)}`;
        const resp = await fetch(url);
        if (!resp.ok) {
          return null;
        }
        const html = await resp.text();
        const result = parseVideosFromHTML(html);
        return result;
      } catch (e) {
        return null;
      }
    };

    // Парсинг страницы Shorts
    const getShortsFromPage = async (h) => {
      try {
        const url = `https://www.youtube.com/@${encodeURIComponent(h)}/shorts`;
        const resp = await fetch(url);
        if (!resp.ok) {
          return null;
        }
        const html = await resp.text();
        const shorts = parseVideosFromHTML(html);
        // Помечаем все как Shorts
        if (shorts) {
          shorts.forEach(short => {
            short.isShort = true;
            if (!short.lengthText || !short.lengthText.simpleText) {
              short.lengthText = { simpleText: '0:30' };
            }
          });
        }
        return shorts;
      } catch (e) {
        return null;
      }
    };

    // Парсинг страницы обычных видео
    const getRegularVideosFromPage = async (h) => {
      try {
        const url = `https://www.youtube.com/@${encodeURIComponent(h)}/videos`;
        const resp = await fetch(url);
        if (!resp.ok) {
          return null;
        }
        const html = await resp.text();
        const result = parseVideosFromHTML(html);
        return result;
      } catch (e) {
        return null;
      }
    };

    // Объединяем видео из разных источников
    const getAllVideos = async (h) => {
      const [mainPageVideos, shortsVideos, regularVideos] = await Promise.all([
        getVideosFromMainPage(h),
        getShortsFromPage(h),
        getRegularVideosFromPage(h)
      ]);

      const allVideos = [];
      const seenIds = new Set();

      // Добавляем видео из всех источников, избегая дубликатов
      const addVideos = (videos, source) => {
        if (!videos) return;
        videos.forEach(video => {
          if (!seenIds.has(video.videoId)) {
            seenIds.add(video.videoId);
            allVideos.push({ ...video, source });
          }
        });
      };

      addVideos(mainPageVideos, 'main');
      addVideos(shortsVideos, 'shorts');
      addVideos(regularVideos, 'videos');

      if (!allVideos.length) return null;

      const itemsFromPage = allVideos
          .map(vr => {
            const vid = vr.videoId;
            const title = vr.title && vr.title.runs && vr.title.runs[0] && vr.title.runs[0].text ?
              vr.title.runs[0].text : (vr.title && vr.title.simpleText) || 'Видео';
            const thumbs = vr.thumbnail && vr.thumbnail.thumbnails ? vr.thumbnail.thumbnails : null;
            const thumb = Array.isArray(thumbs) && thumbs.length ? thumbs[thumbs.length - 1].url : null;
            const published = vr.publishedTimeText && (vr.publishedTimeText.simpleText ||
              (vr.publishedTimeText.runs && vr.publishedTimeText.runs[0] && vr.publishedTimeText.runs[0].text)) || null;

            let viewCount = 0;
            if (vr.viewCountText) {
              const viewText = vr.viewCountText.simpleText ||
                (vr.viewCountText.runs && vr.viewCountText.runs[0] && vr.viewCountText.runs[0].text) || '';
              const viewMatch = viewText.match(/([0-9,.\s]+)/);
              if (viewMatch) {
                const numStr = viewMatch[1].replace(/[,\s]/g, '');
                const num = parseInt(numStr, 10);
                if (!isNaN(num)) viewCount = num;
              }
            }

            // Определяем длительность видео
            let durationSeconds = 0;
            let isShort = vr.isShort || false;

            // Проверяем длительность из lengthText
            if (vr.lengthText && vr.lengthText.simpleText) {
              const duration = vr.lengthText.simpleText;
              // Парсим длительность в формате M:SS или H:MM:SS
              const match = duration.match(/^(?:(\d+):)?(\d+):(\d+)$/);
              if (match) {
                const hours = parseInt(match[1] || 0);
                const minutes = parseInt(match[2]);
                const seconds = parseInt(match[3]);
                durationSeconds = hours * 3600 + minutes * 60 + seconds;
                
                // Если длительность <= 60 секунд, считаем это Short
                if (durationSeconds <= 60) {
                  isShort = true;
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
            };
          });

      return itemsFromPage;
    };

    const pageItems = await getAllVideos(handle);
    if (pageItems && pageItems.length) {
      const items = pageItems.slice(0, maxResults);
      videosCache.set(cacheKey, { ts: Date.now(), items });
      return res.json({ items });
    }

    return res.status(404).json({
      error: 'Не удалось загрузить видео с канала'
    });

  } catch (err) {
    // Возвращаем кэшированные данные при ошибке
    const cached = videosCache.get(cacheKey);
    if (cached && Array.isArray(cached.items) && cached.items.length) {
      return res.json({
        items: cached.items,
        cached: true,
        note: 'Returned cached data due to network error'
      });
    }

    const isDnsError = err && (err.code === 'ENOTFOUND' ||
      (err.message && err.message.includes('ENOTFOUND')));
    const status = isDnsError ? 502 : 500;
    const message = isDnsError ?
      `DNS resolution failed when contacting YouTube (${err.hostname || 'youtube.com'})` :
      (err && err.message) || String(err);

    res.status(status).json({ error: message });
  }
});

// Serve React app for all other routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
  if (!process.env.BOT_TOKEN || process.env.BOT_TOKEN === 'REPLACE_ME') {
    console.warn('Warning: BOT_TOKEN is not set. Telegram features will be limited.');
  }
  if (!process.env.YT_API_KEY) {
    console.warn('Warning: YT_API_KEY is not set. YouTube videos will use fallback parsing.');
  }
});