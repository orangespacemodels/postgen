# Post Generator MiniApp

Telegram MiniApp для генерации постов с помощью AI.

**URL:** https://post.orangespace.io

## Функционал

### 1. Content Analysis (Анализ контента)
Анализ постов из Instagram и TikTok для использования в качестве контекста генерации.

**Поддерживаемые платформы:**
- Instagram (посты, reels)
- TikTok (видео)

**API:** ScrapeCreators
- Endpoint: `https://api.scrapecreators.com/v1/`
- Ключ: `7rNQRXLDaMhDUnnl3br4HZdFA6J3`

**n8n Webhook:** `https://n8n.orangespace.io/webhook/post-content-analyze`

**Возвращаемые данные:**
```json
{
  "success": true,
  "content_type": "video",
  "has_image": true,
  "has_video": true,
  "post_text": "caption text",
  "image_url": "https://...",
  "video_url": "https://...",
  "video_duration_minutes": 0.5,
  "likes": 258531,
  "author": "username"
}
```

### 2. Text Generation (Генерация текста)
Генерация текста поста на основе промпта и контекста.

**n8n Webhook:** `https://n8n.orangespace.io/webhook/post-generate-text`

### 3. Image Generation (Генерация изображений)
Генерация изображений с помощью AI.

**n8n Webhook:** `https://n8n.orangespace.io/webhook/post-generate-image`
**Модель:** `models/gemini-2.5-flash-image` (Google Gemini)

### 4. Improve Prompt (Улучшение промпта)
Magic Wand - улучшение промпта с помощью AI.

**n8n Webhook:** `https://n8n.orangespace.io/webhook/carousel-magic-e77bf041700b` (reuse from carousel)

### 5. Voice Input (Голосовой ввод)
Транскрипция голоса в текст через Web Speech API.

## Тарифы (PRICING)

| Услуга | Цена |
|--------|------|
| Анализ поста (URL) | $0.10 |
| Анализ фото | $0.05 |
| Анализ видео | $0.30/мин |
| Генерация текста | $0.10/1000 слов |
| Генерация изображения | $0.10 |

## Технический стек

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **UI:** shadcn/ui components
- **Backend:** n8n workflows
- **Database:** Supabase (user_data table)
- **Scraping:** ScrapeCreators API

## Переменные окружения

```env
VITE_SUPABASE_URL=https://ilnlknddxxvynxitwlzk.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
VITE_N8N_WEBHOOK_URL=https://n8n.orangespace.io/webhook
```

## API Endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/post-content-analyze` | POST | Анализ URL (Instagram/TikTok) |
| `/post-generate-text` | POST | Генерация текста |
| `/post-generate-image` | POST | Генерация изображения |
| `/carousel-magic-*` | POST | Улучшение промпта |
| `/carousel-voice-*` | POST | Транскрипция голоса |

## Структура проекта

```
src/
├── App.tsx                     # Главный компонент
├── main.tsx                    # Entry point
├── types/index.ts              # TypeScript типы
├── lib/
│   ├── api.ts                  # API вызовы к n8n
│   └── utils.ts                # Утилиты
├── hooks/
│   ├── useUser.ts              # Загрузка пользователя из Supabase
│   ├── useGeneration.ts        # Генерация текста/изображений
│   ├── useContentAnalysis.ts   # Анализ контента
│   └── useVoiceInput.ts        # Голосовой ввод
├── components/
│   ├── ContentAnalyzer.tsx     # Компонент анализа URL/файлов
│   ├── AnalysisModal.tsx       # Модалка выбора опций
│   └── ui/                     # shadcn/ui компоненты
└── integrations/
    └── supabase/client.ts      # Supabase клиент
```

## Использование

Открыть через URL с параметрами:
```
https://post.orangespace.io?user_id=65&tg_chat_id=65
```

**Параметры:**
- `user_id` (required) - ID пользователя в Supabase
- `tg_chat_id` (optional) - Telegram chat ID для отправки результата

## n8n Workflows

| Workflow | ID | Описание |
|----------|-----|----------|
| Content Analysis Webhook | `5lwYQL5rf2fgwKUo` | Анализ Instagram/TikTok URL |
| transactions: spend | (webhook UUID) | Списание баланса |

## Deployment

**Method:** Git push → Coolify auto-deploy
**Repository:** https://github.com/orangespacemodels/postgen
**Domain:** post.orangespace.io
**SSL:** Let's Encrypt (managed by Coolify)

### Deploy Process

1. **Commit and push changes to GitHub:**
   ```bash
   git add .
   git commit -m "feat: description"
   git push origin main
   ```

2. **Coolify automatically:**
   - Detects new commits
   - Builds Docker image
   - Deploys to production
   - No manual action needed

### SSH Key

SSH key for both GitHub and server access is located at:
```
/Users/maksimbozhko/Development/content-factory/ssh-key/content-factory
```

**Usage:**
```bash
# GitHub operations
GIT_SSH_COMMAND='ssh -i /Users/maksimbozhko/Development/content-factory/ssh-key/content-factory' git push

# Server access (if needed)
ssh -i /Users/maksimbozhko/Development/content-factory/ssh-key/content-factory user@server
```

### Local Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## TODO

- [ ] Добавить поддержку YouTube
- [ ] Добавить поддержку LinkedIn
- [ ] Добавить анализ загруженных файлов через AI Vision
- [ ] Интеграция с Telegram Bot для отправки результатов
