# RoflTG v2

Современная визитка Telegram канала с YouTube интеграцией и продвинутыми фильтрами.

## ✨ Особенности

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
```bash
cp .env.example .env
nano .env
```

Заполни `.env`:
```env
BOT_TOKEN=твой_telegram_bot_token
YT_API_KEY=твой_youtube_api_ключ
PORT=3000
```

### 3. Разработка

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

Серверы автоматически перезагружаются при изменении файлов.

### 4. Продакшн

```bash
npm start
```

Сайт будет доступен на `http://localhost:3000`

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
В `server/server.js`:
```javascript
const CHAT_ID = "@твой_канал";
```

В `src/components/VideoSlider/VideoSlider.jsx`:
```javascript
const CHANNEL_HANDLE = 'ТвойYouTubeКанал';
```

### Стили и цвета
В `src/styles/index.css`:
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
rofltg/
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

## 🚀 Деплой на VPS

### Быстрая установка

```bash
# Клонируй репозиторий
git clone https://github.com/elycde/rofltg.git
cd rofltg

# Установи зависимости
npm install

# Настрой переменные окружения
cp .env.example .env
nano .env

# Запусти
npm start
```

Сайт доступен на `http://localhost:3000`

---

### Cloudflare Tunnel (рекомендуется для x-ui серверов)

Идеально подходит если у тебя заняты порты 443/8080 (например x-ui). Не требует открытия портов!

**1. Установи cloudflared:**
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

**2. Авторизуйся в Cloudflare:**
```bash
cloudflared tunnel login
```
Откроется браузер - выбери свой домен и разреши доступ.

**3. Создай туннель:**
```bash
cloudflared tunnel create rofltg
```
Запомни `Tunnel ID` из вывода.

**4. Создай конфиг:**
```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Вставь (замени `<TUNNEL-ID>` на свой):
```yaml
tunnel: <TUNNEL-ID>
credentials-file: /root/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: rofltg.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

**5. Привяжи домен:**
```bash
cloudflared tunnel route dns rofltg rofltg.yourdomain.com
```

**6. Запусти сайт:**
```bash
cd ~/rofltg
npm run build
pm2 start npm --name "rofltg" -- run server
pm2 save
```

**7. Запусти туннель как сервис:**
```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

**8. Проверь статус:**
```bash
sudo systemctl status cloudflared
pm2 status
```

Готово! Сайт доступен на `https://rofltg.yourdomain.com` (автоматический SSL)

**Управление:**
```bash
# Логи туннеля
sudo journalctl -u cloudflared -f

# Перезапуск туннеля
sudo systemctl restart cloudflared

# Остановка туннеля
sudo systemctl stop cloudflared

# Список туннелей
cloudflared tunnel list

# Удалить туннель
cloudflared tunnel delete rofltg
```

**Преимущества:**
- ✅ Не нужно открывать порты
- ✅ Автоматический SSL сертификат
- ✅ Защита от DDoS через Cloudflare
- ✅ Работает параллельно с x-ui без конфликтов
- ✅ Бесплатно

---

### Продакшн с PM2 (рекомендуется)

**1. Установи PM2:**
```bash
npm install -g pm2
```

**2. Собери и запусти:**
```bash
npm run build
pm2 start npm --name "rofltg" -- run server
pm2 save
pm2 startup
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

### Nginx + SSL

**1. Установи зависимости:**
```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
```

**2. Настрой Nginx:**
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

**3. Активируй конфиг:**
```bash
sudo ln -s /etc/nginx/sites-available/rofltg /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**4. Получи SSL сертификат:**
```bash
sudo certbot --nginx -d your-domain.com
```

---

### Docker

**Dockerfile:**
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

**Запуск:**
```bash
docker build -t rofltg .
docker run -d -p 3000:3000 --env-file .env --name rofltg rofltg
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  rofltg:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: unless-stopped
```

```bash
docker-compose up -d
```

---

### Systemd Service

Создай `/etc/systemd/system/rofltg.service`:
```ini
[Unit]
Description=RoflTG Telegram Channel Website
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/rofltg
ExecStart=/usr/bin/npm run server
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Запусти:
```bash
sudo systemctl daemon-reload
sudo systemctl enable rofltg
sudo systemctl start rofltg
sudo systemctl status rofltg
```

## 🔒 Безопасность

- ✅ `.env` добавлен в `.gitignore`
- ✅ Используй `.env.example` как шаблон
- ✅ Никогда не коммить токены и API ключи
- ✅ `subs-history.json` исключен из git
- ✅ Настрой firewall: `sudo ufw allow 3000/tcp`
- ✅ Используй SSL сертификат для продакшна

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
4. Проверь логи: `pm2 logs rofltg` или `journalctl -u rofltg -f`

## 🔄 Обновление

```bash
cd rofltg
git pull origin main
npm install
npm run build
pm2 restart rofltg
```
