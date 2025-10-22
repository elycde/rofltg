# RoflTG v2

Современная визитка Telegram канала с YouTube интеграцией и продвинутыми фильтрами.

## ✨ Особенности v2

- 🎨 **Современный дизайн** с glass-эффектами и анимациями
- ⚛️ **React 18** с хуками и современной архитектурой
- 🎥 **YouTube слайдер** с последними видео канала
- 🔍 **Продвинутые фильтры** - сортировка по дате, просмотрам, названию
- 📊 **Live статистика** подписчиков через SSE
- ❄️ **Анимированный снег** для зимней атмосферы
- 🌙 **Темная тема** с градиентами
- 🇷🇺 **Русская локализация** дат и интерфейса
- 📱 **Полная адаптивность** под все устройства

## 🛠 Технологии

- **Frontend**: React 18 + Vite
- **Backend**: Node.js + Express
- **API**: Telegram Bot API + YouTube Data API v3
- **Стили**: CSS3 с кастомными свойствами

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка переменных окружения
Скопируй `.env.example` в `.env` и заполни своими данными:
```bash
# Linux/Mac
cp .env.example .env

# Windows
copy .env.example .env
```

Отредактируй `.env`:
```env
BOT_TOKEN=твой_telegram_bot_token
YT_API_KEY=твой_youtube_api_ключ
PORT=3000
```

### 3. Разработка

#### Windows
Автоматический запуск обоих серверов:
```bash
dev.bat
```

Или вручную в двух терминалах:
```bash
# Терминал 1 - Backend
npm run server:watch

# Терминал 2 - Frontend
npm run dev
```

#### Linux/Mac
Открой два терминала:

**Терминал 1 - Backend:**
```bash
npm run server:watch
```

**Терминал 2 - Frontend:**
```bash
npm run dev
```

После запуска:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

**Важно:** Серверы автоматически перезагружаются при изменении файлов! 🎉
- Frontend (Vite) - hot reload для `.jsx`, `.css`
- Backend (Node --watch) - автоперезапуск для `.js`

### 4. Продакшн

#### Сборка и запуск
```bash
npm start
```

Сайт будет доступен на `http://localhost:3000`

#### Только сборка
```bash
npm run build
```

## 📋 Получение API ключей

### Telegram Bot Token
1. Напиши [@BotFather](https://t.me/BotFather) в Telegram
2. Создай бота: `/newbot`
3. Скопируй токен и добавь в `.env`

### YouTube API Key
1. Перейди в [Google Cloud Console](https://console.cloud.google.com)
2. Создай проект и включи YouTube Data API v3
3. Создай API ключ в разделе "Credentials"
4. Добавь ключ в `.env`

## 🎯 API Endpoints

- `GET /` - React приложение
- `GET /api/channel` - Данные Telegram канала
- `GET /api/videos` - Последние видео с YouTube
- `GET /api/stream` - SSE поток для live обновлений

## 🎨 Кастомизация

### Изменение канала
В `server/server.js` измени:
```javascript
const CHAT_ID = "@твой_канал";
```

В `src/components/VideoSlider/VideoSlider.jsx` измени:
```javascript
const CHANNEL_HANDLE = 'ТвойYouTubeКанал';
```

### Стили и цвета
Основные переменные в `src/styles/index.css`:
```css
:root {
  --bg-0: #06070a;
  --bg-1: #0b0f14;
  --text: #dfe9f8;
  --muted: #8aa0b2;
}
```

## 📦 Структура проекта

```
rofltg-react/
├── src/
│   ├── components/
│   │   ├── Header/           # Хедер с информацией о канале
│   │   ├── VideoSlider/      # Слайдер YouTube видео с фильтрами
│   │   ├── LoadingScreen/    # Экран загрузки
│   │   └── SnowEffect/       # Анимация снега
│   ├── hooks/
│   │   ├── useChannelData.js # Хук для данных канала
│   │   ├── useSSE.js         # Хук для SSE соединения
│   │   └── useTitleAnimation.js # Анимация заголовка
│   ├── styles/
│   │   └── index.css         # Основные стили
│   ├── App.jsx               # Главный компонент
│   └── main.jsx              # Точка входа
├── server/
│   └── server.js             # Express сервер
├── dist/                     # Собранное приложение
├── .env.example              # Пример конфигурации
├── package.json
├── vite.config.js
└── index.html
```

## 🚀 Деплой

### Быстрый деплой (любой хостинг)

**1. Клонируй репозиторий:**
```bash
git clone https://github.com/elycde/rofltg.git
cd rofltg
```

**2. Установи зависимости:**
```bash
npm install
```

**3. Настрой переменные окружения:**
```bash
# Linux/Mac
cp .env.example .env
nano .env

# Windows
copy .env.example .env
notepad .env
```

**4. Запусти:**
```bash
npm start
```

Готово! Сайт доступен на `http://localhost:3000`

---

### Продакшн с PM2 (рекомендуется)

**Установка PM2:**
```bash
npm install -g pm2
```

**Запуск:**
```bash
# Собери проект
npm run build

# Запусти с PM2
pm2 start npm --name "rofltg" -- run server

# Сохрани конфигурацию
pm2 save

# Автозапуск при перезагрузке
pm2 startup
# Выполни команду, которую покажет PM2
```

**Управление:**
```bash
pm2 status          # Статус
pm2 logs rofltg     # Логи
pm2 restart rofltg  # Перезапуск
pm2 stop rofltg     # Остановка
pm2 delete rofltg   # Удалить
```

---

### VPS с Nginx (Linux)

**1. Установи зависимости:**
```bash
sudo apt update
sudo apt install nodejs npm nginx certbot python3-certbot-nginx
```

**2. Настрой проект (см. выше)**

**3. Настрой Nginx:**
```bash
sudo nano /etc/nginx/sites-available/rofltg
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**4. Активируй конфиг:**
```bash
sudo ln -s /etc/nginx/sites-available/rofltg /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**5. Получи SSL сертификат:**
```bash
sudo certbot --nginx -d your-domain.com
```

---

### Windows Server

**1. Установи Node.js:**
- Скачай с [nodejs.org](https://nodejs.org)

**2. Клонируй и настрой проект:**
```bash
git clone https://github.com/elycde/rofltg.git
cd rofltg
npm install
copy .env.example .env
notepad .env
npm run build
```

**3. Запусти как Windows Service:**
```bash
npm install -g node-windows
```

Создай `service.js`:
```javascript
const Service = require('node-windows').Service;

const svc = new Service({
  name: 'RoflTG',
  description: 'RoflTG Telegram Channel Website',
  script: 'C:\\path\\to\\rofltg\\server\\server.js'
});

svc.on('install', () => svc.start());
svc.install();
```

Запусти:
```bash
node service.js
```

---

### Docker (опционально)

Создай `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "server"]
```

Запусти:
```bash
docker build -t rofltg .
docker run -d -p 3000:3000 --env-file .env --name rofltg rofltg
```

## 🔒 Безопасность

- ✅ `.env` добавлен в `.gitignore`
- ✅ Используй `.env.example` как шаблон
- ✅ Никогда не коммить токены и API ключи
- ✅ `subs-history.json` исключен из git

## 📝 Changelog v2

### Новое
- 🔍 Продвинутые фильтры видео (сортировка, поиск)
- 🎨 Улучшенный UI выпадающего меню фильтров
- 📐 Исправлено позиционирование элементов
- 🎯 Кнопка воспроизведения с отступом
- 🧹 Очистка кода и удаление лишних файлов

### Исправлено
- Позиционирование выпадающего меню фильтров
- Отступы между элементами фильтров
- Выравнивание кнопки фильтров

## 📄 Лицензия

MIT License - используй свободно для своих проектов!

## 👨‍💻 Автор

Создано [@kakakflpw](https://t.me/kakakflpw)

## 🆘 Поддержка

Если возникли проблемы:
1. Проверь `.env` файл
2. Убедись что порты 3000 и 5173 свободны
3. Запусти `npm install` заново
4. Проверь логи в консоли

## 🔄 Обновление с v1

1. Сохрани `subs-history.json` (если есть)
2. Перенеси переменные из старого `.env`
3. Запусти `npm install`
4. Запусти проект
