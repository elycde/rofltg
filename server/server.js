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

// Кеш для постов
let postsCache = null;
let postsCacheTime = 0;
const POSTS_CACHE_TTL = 5 * 60 * 1000; // 5 минут

// TGStat API Token
const TGSTAT_TOKEN = process.env.TGSTAT_TOKEN;

// API для получения постов из канала
app.get("/api/posts", async (req, res) => {
  try {
    // Проверяем кеш
    if (postsCache && Date.now() - postsCacheTime < POSTS_CACHE_TTL) {
      return res.json(postsCache);
    }

    const channelUsername = CHAT_ID.replace('@', '');
    
    // Сначала пробуем прочитать из JSON файла (Python парсер)
    const POSTS_FILE = path.join(__dirname, 'telegram-posts.json');
    try {
      const fileData = await fs.readFile(POSTS_FILE, 'utf8');
      const jsonData = JSON.parse(fileData);
      console.log(`✓ Loaded ${jsonData.posts.length} posts from Python parser`);
      
      postsCache = jsonData;
      postsCacheTime = Date.now();
      
      return res.json(jsonData);
    } catch (fileError) {
      console.log('JSON file not found, trying TGStat API...');
    }
    
    // Fallback на TGStat API
    if (TGSTAT_TOKEN) {
      try {
        console.log('Fetching posts from TGStat API...');
        console.log('Channel:', channelUsername);
        
        const allPosts = [];
        let offset = 0;
        const limit = 50;
        const maxRequests = 3; // Максимум 3 запроса = 150 постов
        
        // Делаем несколько запросов с пагинацией
        for (let i = 0; i < maxRequests; i++) {
          const tgstatUrl = `https://api.tgstat.ru/channels/posts?token=${TGSTAT_TOKEN}&channelId=${channelUsername}&limit=${limit}&offset=${offset}&extended=1`;
          const tgstatResponse = await fetch(tgstatUrl);
          const tgstatData = await tgstatResponse.json();
          
          if (tgstatData.status === 'error') {
            console.error('TGStat API error:', tgstatData.error || 'Unknown error');
            break;
          }
          
          if (tgstatData.status === 'ok' && tgstatData.response && tgstatData.response.items) {
            allPosts.push(...tgstatData.response.items);
            console.log(`Fetched ${tgstatData.response.items.length} posts (offset: ${offset})`);
            
            // Если получили меньше чем limit - больше постов нет
            if (tgstatData.response.items.length < limit) break;
            
            offset += limit;
          } else {
            break;
          }
        }
        
        console.log(`Total fetched: ${allPosts.length} posts from TGStat API`);
        
        if (allPosts.length > 0) {
          const posts = [];
          
          for (const item of allPosts) {
            // Пропускаем удаленные посты
            if (item.is_deleted === 1) continue;
            
            const text = item.text || '';
            let photo = null;
            
            // Извлекаем медиа
            if (item.media) {
              // Фото
              if (item.media.media_type === 'mediaPhoto' && item.media.file_url) {
                photo = item.media.file_url;
              }
              // Видео превью
              else if (item.media.media_type === 'mediaDocument' && item.media.file_thumbnail_url) {
                photo = item.media.file_thumbnail_url;
              }
              // Стикеры (webp)
              else if (item.media.mime_type === 'image/webp' && item.media.file_url) {
                photo = item.media.file_url;
              }
            }
            
            // Извлекаем YouTube превью из текста
            if (text && !photo) {
              const youtubeMatch = text.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
              if (youtubeMatch) {
                const videoId = youtubeMatch[1];
                photo = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
              }
            }
            
            // Очищаем HTML из текста
            let cleanText = text
              .replace(/<a[^>]*>(.*?)<\/a>/g, '$1')  // Убираем теги <a>
              .replace(/<[^>]+>/g, '')  // Убираем все HTML теги
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .trim();
            
            // Минимальная проверка - хоть что-то должно быть
            if (!cleanText && !photo) continue;
            
            posts.push({
              id: item.id,
              text: cleanText.substring(0, 300),
              date: item.date * 1000,
              views: item.views || 0,
              reactions: 0, // TGStat не предоставляет реакции в базовом API
              photo
            });
          }
          
          console.log(`✓ Parsed ${posts.length} posts from ${allPosts.length} items`);
          
          // Сортируем по просмотрам
          posts.sort((a, b) => b.views - a.views);
          
          const result = {
            posts,
            channel: {
              username: channelUsername,
              title: channelUsername,
              photo: `https://t.me/i/userpic/320/${channelUsername}.jpg`
            }
          };
          
          // Не возвращаем сразу - продолжим парсить HTML для большего количества
          console.log('Continuing to HTML parsing to get more posts...');
        }
      } catch (tgstatError) {
        console.error('TGStat API error:', tgstatError.message);
        console.log('Falling back to HTML parsing');
      }
    }

    // Fallback на HTML парсинг
    // Пробуем несколько URL для получения большего количества постов
    const urls = [
      `https://t.me/s/${channelUsername}`,
      `https://t.me/s/${channelUsername}?embed=1`,
      `https://t.me/s/${channelUsername}?before=9999999999`
    ];

    let allHtml = '';

    for (const url of urls) {
      try {
        const response = await fetch(url);
        const html = await response.text();
        allHtml += html;
        console.log(`Fetched from ${url}, length: ${html.length}`);
      } catch (e) {
        console.error(`Error fetching ${url}:`, e.message);
      }
    }

    console.log(`Total HTML length: ${allHtml.length}`);

    const posts = [];

    // Простой подход - ищем все блоки сообщений
    const messages = allHtml.split('class="tgme_widget_message ');
    console.log(`Found ${messages.length - 1} message blocks total`);

    // Используем Set для уникальности постов по тексту
    const uniquePosts = new Map();
    let skippedNoText = 0;
    let skippedNoContent = 0;

    for (let i = 1; i < messages.length; i++) {
      const messageBlock = messages[i];

      // Извлекаем текст
      const textMatch = messageBlock.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)<\/div>/s);
      if (!textMatch) {
        skippedNoText++;
        // Может быть пост без текста но с медиа - продолжаем
      }

      let text = textMatch ? textMatch[1]
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#\d+;/g, '')
        .trim() : '';

      // Извлекаем фото/видео превью
      let photo = null;

      // Ищем любое изображение (фото или видео превью)
      const photoMatch = messageBlock.match(/background-image:url\('([^']+)'\)/);
      if (photoMatch) {
        const photoUrl = photoMatch[1];
        if (!photoUrl.includes('/emoji/')) {
          photo = photoUrl.startsWith('//') ? 'https:' + photoUrl : photoUrl;
        }
      }

      // Если в тексте есть YouTube ссылка - извлекаем превью
      if (text && !photo) {
        const youtubeMatch = text.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (youtubeMatch) {
          const videoId = youtubeMatch[1];
          photo = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        }
      }

      // Минимальная проверка - хоть что-то должно быть
      if (!text && !photo) {
        skippedNoContent++;
        continue;
      }

      // Извлекаем дату
      const dateMatch = messageBlock.match(/<time[^>]*datetime="([^"]+)"/);
      const date = dateMatch ? new Date(dateMatch[1]).getTime() : Date.now();

      // Извлекаем просмотры
      let views = 0;
      const viewsMatch = messageBlock.match(/<span class="tgme_widget_message_views">([^<]+)</);
      if (viewsMatch) {
        const viewsText = viewsMatch[1].trim();
        if (viewsText.includes('K')) {
          views = parseFloat(viewsText) * 1000;
        } else if (viewsText.includes('M')) {
          views = parseFloat(viewsText) * 1000000;
        } else {
          views = parseInt(viewsText.replace(/\s/g, '')) || 0;
        }
      }

      // Извлекаем реакции
      let reactions = 0;
      const reactionsMatch = messageBlock.match(/<span class="tgme_widget_message_reactions_count">([^<]+)</);
      if (reactionsMatch) {
        reactions = parseInt(reactionsMatch[1].replace(/\s/g, '')) || 0;
      }

      const postData = {
        text: text ? text.substring(0, 300) : '',
        date,
        views,
        reactions,
        photo
      };

      // Используем текст+дату как ключ для уникальности
      const key = `${text}_${date}`;
      if (!uniquePosts.has(key)) {
        uniquePosts.set(key, postData);
      }
    }

    // Конвертируем Map в массив
    let postId = 1;
    for (const postData of uniquePosts.values()) {
      posts.push({
        id: postId++,
        ...postData
      });
      if (posts.length >= 50) break;
    }

    console.log(`Skipped: ${skippedNoText} without text block, ${skippedNoContent} without any content`);
    console.log(`Successfully parsed ${posts.length} unique posts (with text or media)`);

    // Сортируем по просмотрам
    posts.sort((a, b) => b.views - a.views);

    // Если не удалось спарсить, возвращаем демо посты
    if (posts.length === 0) {
      posts.push(
        {
          id: 1,
          text: "🎮 Новое видео на канале! Смотрите прямо сейчас",
          date: Date.now() - 3600000,
          photo: null
        },
        {
          id: 2,
          text: "🔥 Сегодня разбираем самые горячие новости игровой индустрии. Не пропустите!",
          date: Date.now() - 7200000,
          photo: null
        },
        {
          id: 3,
          text: "💎 Эксклюзивный контент только для подписчиков",
          date: Date.now() - 10800000,
          photo: null
        },
        {
          id: 4,
          text: "⚡ Молниеносные обновления каждый день!",
          date: Date.now() - 14400000,
          photo: null
        },
        {
          id: 5,
          text: "🎯 Подписывайся и будь в курсе всех событий! Только у нас самая актуальная информация",
          date: Date.now() - 18000000,
          photo: null
        }
      );
    }

    const result = {
      posts: posts,
      channel: {
        username: channelUsername,
        title: channelUsername,
        photo: `https://t.me/i/userpic/320/${channelUsername}.jpg`
      }
    };

    // Сохраняем в кеш
    postsCache = result;
    postsCacheTime = Date.now();

    res.json(result);
  } catch (err) {
    console.error('Error fetching posts:', err);

    // Возвращаем демо посты при ошибке
    res.json({
      posts: [
        {
          id: 1,
          text: "🎮 Новое видео на канале! Смотрите прямо сейчас",
          date: Date.now() - 3600000,
          photo: null
        },
        {
          id: 2,
          text: "🔥 Сегодня разбираем самые горячие новости. Не пропустите!",
          date: Date.now() - 7200000,
          photo: null
        },
        {
          id: 3,
          text: "💎 Эксклюзивный контент только для подписчиков",
          date: Date.now() - 10800000,
          photo: null
        }
      ],
      channel: {
        username: "fromoldnuke7",
        title: "fromoldnuke7",
        photo: "https://t.me/i/userpic/320/fromoldnuke7.jpg"
      }
    });
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