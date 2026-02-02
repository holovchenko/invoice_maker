# Invoice Maker

Генератор PDF-інвойсів для name (from config/supplier.json). Веб-інтерфейс з формою — заповнюєш 3 поля, отримуєш готовий PDF.

## Встановлення

### 1. Встановити Node.js 20+

**macOS** (через [Homebrew](https://brew.sh/)):

```bash
brew install node@20
```

**Windows** (через [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/)):

```bash
winget install OpenJS.NodeJS.LTS
```

Або завантаж інсталятор з [nodejs.org](https://nodejs.org/).

**Linux (Ubuntu/Debian):**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Linux (Fedora/RHEL):**

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
```

Перевір версію:

```bash
node -v  # v20.x.x або вище
npm -v
```

### 2. Клонувати та встановити залежності

```bash
git clone https://github.com/holovchenko/invoice_maker.git
cd invoice_maker
npm install
```

`npm install` автоматично завантажить Chromium (~170 МБ), який потрібен для генерації PDF через Puppeteer.

### 3. Налаштувати реквізити

Скопіюй приклади конфігів та заповни своїми даними:

```bash
cp config/supplier.example.json config/supplier.json
cp config/customer.example.json config/customer.json
```

Редагуй `config/supplier.json` (дані постачальника) та `config/customer.json` (дані замовника).

## Використання

```bash
npm start
```

Відкрий `http://localhost:3000` у браузері. Заповни форму:

| Поле | Опис | За замовчуванням |
|------|------|-----------------|
| Invoice date | Дата інвойсу | Сьогодні |
| Hours | Кількість годин | 168 |
| Hourly rate (EUR) | Вартість години | 20 |

Натисни **Generate PDF** — файл завантажиться у браузер та збережеться в папці `output/`.

### Ім'я файлу

Формат: `{Surname}_Invoice_{Mon}_{CustomerShort}_{Year}.pdf`

Приклад: `Doe_Invoice_Jan_Client_2026.pdf`

Якщо файл з таким ім'ям вже існує, додається інкремент: `_1`, `_2`, ...

## Що обчислюється автоматично

- **Номер інвойсу** — `YYYY-MM` з дати інвойсу
- **Загальна сума** — години x ціна, з пробілом як роздільником тисяч (`5 162`)
- **Сума прописом** — англійською та українською
- **Дата оплати** — +20 робочих днів від дати інвойсу (пропускає вихідні та державні свята Румунії)

### Державні свята Румунії

Дата оплати враховує офіційні вихідні дні Румунії. Список свят завантажується з [Nager.Date API](https://date.nager.at/) при генерації інвойсу та кешується локально в `config/holidays/romania-{year}.json`.

Якщо API недоступний (немає інтернету), використовується закешована версія. Якщо кешу немає — розрахунок працює лише з урахуванням вихідних (субота/неділя).

## Структура проєкту

```
src/
├── server.ts          # Express сервер, API endpoint
├── config.ts          # Завантаження JSON-конфігів
├── holidays.ts        # Завантаження свят Румунії (API + кеш)
├── template.ts        # HTML-шаблон інвойсу (двомовний EN/UA)
├── pdf-generator.ts   # Puppeteer HTML → PDF
├── number-to-words.ts # Число прописом (EN + UA)
├── business-days.ts   # Розрахунок робочих днів (з урахуванням свят)
├── format.ts          # Форматування дат, сум, імен файлів
└── public/
    └── index.html     # Веб-форма
config/
├── supplier.json          # Дані постачальника
├── customer.json          # Дані замовника
├── supplier.example.json  # Приклад конфігу постачальника
├── customer.example.json  # Приклад конфігу замовника
└── holidays/              # Кеш свят (створюється автоматично)
    └── romania-2026.json
```

## Тестування

```bash
npm test            # запуск тестів
npm run test:watch  # запуск у watch-режимі
```

63 тести покривають:

- Розрахунок робочих днів (пропуск вихідних, свят, edge cases)
- Завантаження та кешування свят (API, fallback, помилки)
- Конвертація чисел у текст (EN + UA)
- Форматування дат, сум, номерів інвойсів, імен файлів
- HTML-шаблон (структура, змінні, статичний контент)

## Залежності

### Runtime

| Пакет | Призначення |
|-------|-------------|
| [express](https://expressjs.com/) | HTTP-сервер та API |
| [puppeteer](https://pptr.dev/) | Генерація PDF (включає Chromium) |
| [number-to-words](https://www.npmjs.com/package/number-to-words) | Конвертація чисел у слова (EN) |

### Зовнішні сервіси

| Сервіс | Призначення |
|--------|-------------|
| [Nager.Date API](https://date.nager.at/) | Список державних свят Румунії (безкоштовний, без ключа) |

### Dev

| Пакет | Призначення |
|-------|-------------|
| [typescript](https://www.typescriptlang.org/) | Типізація |
| [tsx](https://tsx.is/) | Запуск TypeScript без компіляції |
| [vitest](https://vitest.dev/) | Тестовий фреймворк |
