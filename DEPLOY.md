# Автоматический деплой на VPS

## Настройка GitHub Actions

### 1. Создай SSH ключ на сервере (если нет)

```bash
# На сервере
ssh-keygen -t rsa -b 4096 -C "github-actions"
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/id_rsa  # Скопируй приватный ключ
```

### 2. Добавь секреты в GitHub

Открой: https://github.com/elycde/rofltg/settings/secrets/actions

Добавь 3 секрета:

- **VPS_HOST**: IP адрес сервера (например `123.45.67.89`)
- **VPS_USER**: пользователь SSH (например `root` или `ubuntu`)
- **VPS_SSH_KEY**: приватный SSH ключ (весь текст из `~/.ssh/id_rsa`)

### 3. Готово!

Теперь при каждом `git push` в ветки `main` или `dev`:
1. GitHub Actions подключится к серверу
2. Обновит код из GitHub
3. Установит зависимости
4. Соберет проект
5. Перезапустит PM2

## Ручное обновление (если нужно)

```bash
# На сервере
cd /var/www/rofltg
git pull origin main  # или dev
npm install
npm run build
pm2 restart rofltg
```

## Проверка деплоя

После push проверь:
- GitHub: Actions → Workflows → Deploy
- Сервер: `pm2 logs rofltg`

## Откат на предыдущую версию

```bash
cd /var/www/rofltg
git log --oneline  # Найди нужный коммит
git checkout <commit-hash>
npm install
npm run build
pm2 restart rofltg
```
