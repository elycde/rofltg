# 🚀 Полная автоматизация на хостинге

## Шаг 1: Подготовка VPS

```bash
# Подключись к серверу
ssh root@твой_ip

# Обнови систему
apt update && apt upgrade -y

# Установи Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Установи PM2 глобально
npm install -g pm2

# Установи Git (если нет)
apt install -y git
```

---

## Шаг 2: Клонирование проекта

```bash
# Создай папку для проектов
mkdir -p /var/www
cd /var/www

# Клонируй репозиторий
git clone https://github.com/elycde/rofltg.git
cd rofltg

# Переключись на main ветку
git checkout main
```

---

## Шаг 3: Настройка переменных окружения

```bash
# Создай .env файл
nano .env
```

Вставь:
```env
BOT_TOKEN=твой_telegram_bot_token
TGSTAT_TOKEN=твой_tgstat_token
PORT=3000
```

Сохрани: `Ctrl+X` → `Y` → `Enter`

---

## Шаг 4: Установка и запуск

```bash
# Установи зависимости
npm install

# Собери проект
npm run build

# Запусти через PM2
pm2 start npm --name "rofltg" -- start

# Сохрани конфигурацию PM2
pm2 save

# Автозапуск при перезагрузке сервера
pm2 startup
# Скопируй и выполни команду которую покажет PM2
```

---

## Шаг 5: Настройка SSH для GitHub Actions

```bash
# Создай SSH ключ (если нет)
ssh-keygen -t rsa -b 4096 -C "github-actions"
# Нажми Enter 3 раза (без пароля)

# Добавь публичный ключ в authorized_keys
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys

# Скопируй приватный ключ
cat ~/.ssh/id_rsa
# Выдели весь текст от -----BEGIN до -----END и скопируй
```

---

## Шаг 6: Добавь секреты в GitHub

1. Открой https://github.com/elycde/rofltg
2. Settings → Secrets and variables → Actions
3. Нажми "New repository secret"

Добавь 3 секрета:

**VPS_HOST:**
```
123.45.67.89
```
(твой IP сервера)

**VPS_USER:**
```
root
```
(или другой пользователь)

**VPS_SSH_KEY:**
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
(весь приватный ключ из ~/.ssh/id_rsa)
...
-----END RSA PRIVATE KEY-----
```

---

## Шаг 7: Проверка автодеплоя

```bash
# На локальной машине
echo "test" >> README.md
git add .
git commit -m "test autodeploy"
git push origin main
```

**Что произойдет:**
1. GitHub Actions запустится автоматически
2. Подключится к твоему VPS
3. Выполнит `git pull`
4. Запустит `npm install`
5. Соберет `npm run build`
6. Перезапустит `pm2 restart rofltg`

**Проверь статус:**
- GitHub: Actions → смотри логи
- VPS: `pm2 logs rofltg`

---

## Управление на сервере

```bash
# Статус
pm2 status

# Логи (в реальном времени)
pm2 logs rofltg

# Перезапуск
pm2 restart rofltg

# Остановка
pm2 stop rofltg

# Удаление
pm2 delete rofltg

# Обновление вручную
cd /var/www/rofltg
git pull
npm install
npm run build
pm2 restart rofltg
```

---

## Настройка Nginx (опционально)

Если хочешь домен вместо IP:

```bash
# Установи Nginx
apt install -y nginx

# Создай конфиг
nano /etc/nginx/sites-available/rofltg
```

Вставь:
```nginx
server {
    listen 80;
    server_name твой-домен.ru;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Активируй конфиг
ln -s /etc/nginx/sites-available/rofltg /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Установи SSL (бесплатный)
apt install -y certbot python3-certbot-nginx
certbot --nginx -d твой-домен.ru
```

---

## Firewall (безопасность)

```bash
# Установи UFW
apt install -y ufw

# Разреши SSH, HTTP, HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

# Включи firewall
ufw enable
```

---

## Мониторинг

```bash
# Установи мониторинг PM2
pm2 install pm2-logrotate

# Настрой ротацию логов
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Веб-интерфейс PM2 (опционально)
pm2 web
# Открой http://твой_ip:9615
```

---

## Troubleshooting

**Проблема: GitHub Actions не подключается**
```bash
# На сервере проверь SSH
systemctl status ssh
nano /etc/ssh/sshd_config
# Убедись что PubkeyAuthentication yes
systemctl restart ssh
```

**Проблема: PM2 не запускается**
```bash
pm2 logs rofltg --lines 100
# Смотри ошибки
```

**Проблема: Порт 3000 занят**
```bash
# Найди процесс
lsof -i :3000
# Убей процесс
kill -9 PID

# Или измени порт в .env
echo "PORT=3001" >> .env
pm2 restart rofltg
```

---

## Готово! 🎉

Теперь при каждом `git push origin main` сайт автоматически обновится на сервере!

**Проверь:**
1. Сделай изменение в коде
2. `git push origin main`
3. Через 1-2 минуты зайди на сайт - изменения применились!
