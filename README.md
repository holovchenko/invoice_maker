# Invoice Maker

Генератор PDF-інвойсів для name (from config/supplier.json). Веб-інтерфейс з формою — заповнюєш 3 поля, отримуєш готовий PDF.

## Встановлення

### Вимоги

- Node.js 20+
- npm

### Кроки

```bash
git clone https://github.com/holovchenko/invoice_maker.git
cd invoice_maker
npm install
```

## Використання

```bash
npm start
```

Відкрий `http://localhost:3000` у браузері. Заповни форму:

| Поле | Опис | За замовчуванням |
|------|------|-----------------|
| Invoice date | Дата інвойсу | Сьогодні |
| Hours | Кількість годин | 168 |
| Hourly rate (EUR) | Вартість години | 29 |

Натисни **Generate PDF** — файл завантажиться у браузер та збережеться в папці `output/`.

### Ім'я файлу

Формат: `{Surname}_Invoice_{Mon}_{CustomerShort}_{Year}.pdf`

Приклад: `Doe_Invoice_Jan_Client_2026.pdf`

Якщо файл з таким ім'ям вже існує, додається інкремент: `_1`, `_2`, ...

## Що обчислюється автоматично

- **Номер інвойсу** — `YYYY-MM` з дати інвойсу
- **Загальна сума** — години x ціна, з пробілом як роздільником тисяч (`5 162`)
- **Сума прописом** — англійською та українською
- **Дата оплати** — +20 робочих днів від дати інвойсу (пропускає суботи та неділі)

## Структура проєкту

```
src/
├── server.ts          # Express сервер, API endpoint
├── template.ts        # HTML-шаблон інвойсу (двомовний EN/UA)
├── pdf-generator.ts   # Puppeteer HTML → PDF
├── number-to-words.ts # Число прописом (EN + UA)
├── business-days.ts   # Розрахунок робочих днів
├── format.ts          # Форматування дат, сум, імен файлів
└── public/
    └── index.html     # Веб-форма
```

## Тестування

```bash
npm test            # запуск тестів
npm run test:watch  # запуск у watch-режимі
```

46 тестів покривають:
- Розрахунок робочих днів (пропуск вихідних, edge cases)
- Конвертація чисел у текст (EN + UA)
- Форматування дат, сум, номерів інвойсів, імен файлів
- HTML-шаблон (структура, змінні, статичний контент)

## Реквізити в інвойсі

Всі реквізити зашиті в шаблон (`src/template.ts`):

- **Supplier:** name (from config/supplier.json), Київ
- **Customer:** EXAMPLE COMPANY SRL, Bucharest
- **Банк supplier:** SEPA GB00XXXX00000000000000, BIC XXXXGB00
- **Банк customer:** RO00XXXX0000000000000000, Example Bank

Для зміни реквізитів — редагуй `src/template.ts`.
