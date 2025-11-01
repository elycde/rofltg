# RoflTG - Next.js Edition

Современная визитка Telegram канала на **Next.js 14** с TypeScript.

## ✨ Фичи

- ⚛️ **Next.js 14** + React 18 + TypeScript
- 🎥 **YouTube слайдер** с автопарсингом Shorts
- 📱 **Всплывающие посты** из Telegram (TGStat API)
- 📊 **Live статистика** подписчиков
- ❄️ **Анимированный снег**
- 🚀 **Автодеплой** через GitHub Actions

## 🚀 Быстрый старт

```bash
# Установка
npm install

# Настройка .env
cp .env.example .env
# Заполни BOT_TOKEN и TGSTAT_TOKEN

# Запуск
npm run dev
```

Открой http://localhost:3000

## 📋 API ключи

### Telegram Bot Token
1. [@BotFather](https://t.me/BotFather) → `/newbot`
2. Скопируй токен в `.env`

### TGStat Token
1. https://tgstat.ru → регистрация
2. Получи API токен → добавь в `.env`

## 🎯 Продакшн

### Вариант 1: VPS

```bash
# Сборка
npm run build

# Запуск через PM2
npm install -g pm2
pm2 start npm --name "rofltg" -- start
pm2 save
pm2 startup

# Управление
pm2 status
pm2 logs rofltg
pm2 restart rofltg
```

**Nginx конфиг:**
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

**SSL:**
```bash
sudo certbot --nginx -d your-domain.com
```

---

### Вариант 2: Vercel (проще)

1. Push в GitHub
2. Импортируй на https://vercel.com
3. Добавь env переменные
4. Deploy!

**Преимущества:**
- ✅ Бесплатно
- ✅ Автоматический HTTPS
- ✅ CDN по всему миру
- ✅ Автодеплой из GitHub

---

### Вариант 3: Cloudflare Tunnel (для x-ui серверов)

Не требует открытия портов!

```bash
# Установка
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Авторизация
cloudflared tunnel login

# Создание туннеля
cloudflared tunnel create rofltg

# Конфиг ~/.cloudflared/config.yml
tunnel: <TUNNEL-ID>
credentials-file: /root/.cloudflared/<TUNNEL-ID>.json
ingress:
  - hostname: rofltg.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404

# Привязка домена
cloudflared tunnel route dns rofltg rofltg.yourdomain.com

# Запуск как сервис
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

**Преимущества:**
- ✅ Не нужно открывать порты
- ✅ Автоматический SSL
- ✅ Защита от DDoS
- ✅ Работает с x-ui без конфликтов
- ✅ Бесплатно

---

## 🔄 Автодеплой (GitHub Actions)

При push в `main` или `dev` автоматически:
1. Подключается к серверу
2. Делает `git pull`
3. Запускает `npm install`
4. Собирает `npm run build`
5. Перезапускает `pm2 restart rofltg`

**Настройка:**
Добавь в GitHub Secrets:
- `VPS_HOST` - IP сервера
- `VPS_USER` - пользователь (root)
- `VPS_SSH_KEY` - приватный SSH ключ

## 📦 Структура

```
app/
  ├── layout.tsx          # Главный layout
  ├── page.tsx            # Главная страница
  └── api/                # API routes
      ├── channel/        # Данные канала
      ├── posts/          # Посты из Telegram
      └── videos/         # YouTube видео

src/
  ├── components/         # React компоненты
  ├── hooks/              # Custom hooks
  └── styles/             # CSS стили
```

## 🛠 Команды

```bash
npm run dev      # Разработка (localhost:3000)
npm run build    # Продакшн билд
npm start        # Запуск продакшн
npm run lint     # Проверка кода
```

## 🔒 Безопасность

- ✅ `.env` в `.gitignore`
- ✅ Никогда не коммить токены
- ✅ Используй SSL для продакшна

## 🔄 Обновление

```bash
git pull
npm install
npm run build
pm2 restart rofltg
```

---

Made with ❤️ by [@kakakflpw](https://t.me/kakakflpw)
