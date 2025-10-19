# 🚀 RoflTG - Telegram Channel Website

## ✨ Особенности

- 🎨 **Современный дизайн** с glass-эффектами и анимациями
- 📱 **Адаптивная верстка** для всех устройств
- 🎥 **YouTube слайдер** с последними видео канала
- 📊 **Live статистика** подписчиков через SSE
- ❄️ **Анимированный снег** для атмосферы
- 🌙 **Темная тема** с градиентами
- 🇷🇺 **Русская локализация** дат и интерфейса

## 🛠 Технологии

- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript + CSS3
- **API**: Telegram Bot API + YouTube Data API v3
- **Стили**: CSS Grid/Flexbox + Backdrop Filter

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка переменных окружения
Создай файл `.env`:
```env
BOT_TOKEN=твой_telegram_bot_token
YT_API_KEY=твой_youtube_api_ключ
PORT=3000
```

### 3. Запуск
```bash
npm start
```

Сайт будет доступен на `http://localhost:3000`

## 📋 Получение API ключей

### Telegram Bot Token
1. Напиши [@BotFather](https://t.me/BotFather) в Telegram
2. Создай бота: `/newbot`
3. Скопируй токен

### YouTube API Key
1. Перейди в [Google Cloud Console](https://console.cloud.google.com)
2. Создай проект и включи YouTube Data API v3
3. Создай API ключ в разделе "Credentials"

## 🎯 API Endpoints

- `GET /` - Главная страница
- `GET /api/channel` - Данные Telegram канала
- `GET /api/videos` - Последние видео с YouTube
- `GET /api/stream` - SSE поток для live обновлений

## 🎨 Кастомизация

### Изменение канала
В `server.js` измени:
```javascript
const CHAT_ID = "@твой_канал";
const CHANNEL_HANDLE = 'ТвойYouTubeКанал';
```

### Стили и цвета
Основные переменные в `public/index.html`:
```css
:root {
  --bg-0: #06070a;
  --bg-1: #0b0f14;
  --text: #dfe9f8;
  --muted: #8aa0b2;
}
```

## 📦 Деплой

### VPS с Nginx
```bash
# Установи зависимости
sudo apt install nodejs npm nginx

# Настрой Nginx прокси на порт 3000
# Получи SSL сертификат через Certbot
```

### Cloudflare + Workers
Используй Cloudflare Workers для проксирования на нестандартные порты.

## 📄 Лицензия

MIT License - используй свободно для своих проектов!

## 🎉 Благодарности

- Дизайн вдохновлен современными glass-эффектами
- Анимации созданы с использованием CSS3 transitions
- Иконки и эффекты - собственная разработка

## 👨‍💻 Автор

Создано [@kakakflpw](https://t.me/kakakflpw)
