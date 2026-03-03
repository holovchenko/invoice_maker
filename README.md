# Invoice Maker

Генератор двомовних (EN/UA) PDF-інвойсів з веб-інтерфейсом. Заповнюєш форму — отримуєш готовий PDF. Підтримує розрахунок пені за прострочені платежі. Працює локально або як Vercel-деплоймент з багатокористувацьким режимом.

## Деплоймент (Vercel)

Продакшн-версія деплоїться на Vercel автоматично з гілки `main`. Для роботи потрібні:

- **Upstash Redis** — зберігає конфіги користувачів, сесії, лічильники
- Змінні оточення: `KV_REST_API_URL`, `KV_REST_API_TOKEN`

### Serverless API

| Ендпоінт | Метод | Опис |
|----------|-------|------|
| `/api/auth/register` | POST | Реєстрація (email + пароль) |
| `/api/auth/login` | POST | Вхід, встановлює session cookie |
| `/api/auth/logout` | POST | Вихід, видаляє сесію |
| `/api/auth/me` | GET | Поточний користувач |
| `/api/settings` | GET/POST | Налаштування постачальника (per-user) |
| `/api/customer` | GET | Конфіг замовника (спільний) |
| `/api/counter` | GET | Поточний номер інвойсу |
| `/api/generate` | POST | Генерація PDF |
| `/api/calculate-penalties` | POST | Попередній розрахунок пеней |

Дані зберігаються в Redis: `supplier:{email}`, `counter:{email}`, `customer`, `user:{email}`, `session:{token}`.

## Локальний запуск

### 1. Встановити Node.js 20+

```bash
# macOS
brew install node@20

# Windows
winget install OpenJS.NodeJS.LTS

# Linux (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Клонувати та встановити залежності

```bash
git clone https://github.com/holovchenko/invoice_maker.git
cd invoice_maker
npm install
```

`npm install` автоматично завантажить Chromium (~170 МБ) для генерації PDF через Puppeteer.

### 3. Налаштувати реквізити

```bash
cp config/supplier.example.json config/supplier.json
cp config/customer.example.json config/customer.json
```

Редагуй `config/supplier.json` (дані постачальника) та `config/customer.json` (дані замовника).

### 4. Налаштувати Redis (для Vercel dev)

```bash
cp .env.example .env
```

Заповни `KV_REST_API_URL` та `KV_REST_API_TOKEN` даними Upstash Redis.

## Використання

```bash
npm start       # локальний Express сервер → http://localhost:3000
npm run dev     # Vercel dev (serverless локально)
```

| Поле | Опис | За замовчуванням |
|------|------|-----------------|
| Invoice Number | Номер інвойсу | Автоінкремент |
| Invoice date | Дата інвойсу | Сьогодні |
| Hours | Кількість годин | 168 |
| Hourly rate (EUR) | Вартість години | 20 |
| Penalties | Пені за прострочені інвойси (опціонально) | — |

Кожний рядок пені містить: номер інвойсу, дату інвойсу, суму, дату отримання платежу. Попередній перегляд (due date, delay days, penalty amount) оновлюється автоматично.

Натисни **Generate PDF** — файл завантажиться у браузер.

### Інвойс тільки з пенею

Якщо Hours = 0 і Rate = 0, рядок з консультаційними послугами не включається.

### Ім'я файлу

Формат: `{Surname}_Invoice_{Mon}_{CustomerShort}_{Year}.pdf`

Приклад: `Doe_Invoice_Jan_Client_2026.pdf`

## Що обчислюється автоматично

- **Загальна сума** — години x ціна + сума пеней, з пробілом як роздільником тисяч (`5 162`)
- **Сума прописом** — англійською та українською (з підтримкою центів для дробових сум)
- **Дата оплати** — +20 робочих днів від дати інвойсу (пропускає вихідні та державні свята Румунії)
- **Пеня** — 0.1% за кожний день прострочення, з SEPA-коригуванням (-1 робочий день від дати отримання платежу), обмежена сумою інвойсу

### Державні свята Румунії

Дата оплати враховує офіційні вихідні дні Румунії. Список свят завантажується з [Nager.Date API](https://date.nager.at/) при генерації інвойсу та кешується:

- **Локально**: у файлах `config/holidays/romania-{year}.json`
- **Vercel**: в пам'яті serverless-інстансу (файлова система read-only)

Якщо API недоступний, використовується кеш. Якщо кешу немає — розрахунок працює лише з урахуванням вихідних (субота/неділя).

## Структура проєкту

```
src/
├── server.ts          # Express сервер (локальний запуск)
├── auth.ts            # Автентифікація (bcrypt + session cookies)
├── api-helpers.ts     # Спільні хелпери для API (auth check)
├── kv.ts              # Обгортка @vercel/kv (get/set/del/incr)
├── config.ts          # Завантаження JSON-конфігів (локальний режим)
├── holidays.ts        # Свята Румунії (API + файловий + in-memory кеш)
├── template.ts        # HTML-шаблон інвойсу (двомовний EN/UA)
├── pdf-generator.ts   # Puppeteer / @sparticuz/chromium → PDF
├── penalty.ts         # Розрахунок пені (0.1%/день, SEPA, cap)
├── number-to-words.ts # Число прописом (EN + UA, з центами)
├── business-days.ts   # Робочі дні: add/subtract (з урахуванням свят)
├── format.ts          # Форматування дат, сум, імен файлів
├── counter.ts         # Лічильник інвойсів (файловий, для локального режиму)
└── public/
    └── index.html     # Веб-форма з автентифікацією та динамічними пенями
api/
├── auth/
│   ├── register.ts    # POST /api/auth/register
│   ├── login.ts       # POST /api/auth/login
│   ├── logout.ts      # POST /api/auth/logout
│   └── me.ts          # GET /api/auth/me
├── generate.ts        # POST /api/generate (PDF)
├── calculate-penalties.ts  # POST /api/calculate-penalties
├── settings.ts        # GET/POST /api/settings
├── customer.ts        # GET /api/customer
└── counter.ts         # GET /api/counter
config/
├── supplier.example.json  # Приклад конфігу постачальника
├── customer.example.json  # Приклад конфігу замовника
└── holidays/              # Кеш свят (створюється автоматично)
```

## Тестування

```bash
npm test            # запуск тестів
npm run test:watch  # запуск у watch-режимі
```

103 тести у 9 файлах покривають:

- Розрахунок робочих днів: додавання та віднімання (пропуск вихідних, свят, edge cases)
- Завантаження та кешування свят (API, in-memory fallback, помилки)
- Конвертація чисел у текст (EN + UA, з підтримкою центів)
- Форматування дат, сум (цілих та дробових), номерів інвойсів, імен файлів
- HTML-шаблон (структура, пені, penalty-only, XSS-захист)
- Розрахунок пені (SEPA-коригування, cap, edge cases)
- Redis KV обгортка (get/set/del/incr)
- Лічильник інвойсів

## Залежності

### Runtime

| Пакет | Призначення |
|-------|-------------|
| [express](https://expressjs.com/) | HTTP-сервер (локальний режим) |
| [puppeteer](https://pptr.dev/) | Генерація PDF локально (включає Chromium) |
| [@sparticuz/chromium](https://github.com/nicolo-ribaudo/puppeteer-core-chromium) | Headless Chromium для Vercel serverless |
| [puppeteer-core](https://pptr.dev/) | Puppeteer без вбудованого Chromium (Vercel) |
| [@vercel/kv](https://vercel.com/docs/storage/vercel-kv) | Redis KV для зберігання даних |
| [bcryptjs](https://www.npmjs.com/package/bcryptjs) | Хешування паролів |
| [number-to-words](https://www.npmjs.com/package/number-to-words) | Конвертація чисел у слова (EN) |

### Зовнішні сервіси

| Сервіс | Призначення |
|--------|-------------|
| [Nager.Date API](https://date.nager.at/) | Список державних свят Румунії (безкоштовний, без ключа) |
| [Upstash Redis](https://upstash.com/) | Key-value сховище для Vercel деплойменту |

### Dev

| Пакет | Призначення |
|-------|-------------|
| [typescript](https://www.typescriptlang.org/) | Типізація |
| [tsx](https://tsx.is/) | Запуск TypeScript без компіляції |
| [vitest](https://vitest.dev/) | Тестовий фреймворк |
| [vercel](https://vercel.com/docs/cli) | Vercel CLI для локальної розробки |
