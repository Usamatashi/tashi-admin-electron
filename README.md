# Tashi Admin — Desktop Application

Windows Electron desktop app for the Tashi Brakes admin panel.

## Features

- **Sales**: Orders, Products, Claims, Payments, Commission, Sales History
- **Marketing**: QR Codes, Ads, Ticker
- **Point of Sale**: POS Terminal, POS Customers
- **Accounting**: Suppliers, Expenses, Purchases, Sales Returns, Inventory, Chart of Accounts, Journal Entries, Cash Book, Financial Reports
- **HR**: Careers
- **Admin**: Users, Regions, Team, WhatsApp, Super Config

## Requirements

- Node.js 20+
- npm 10+
- Your Firebase Service Account JSON (from Firebase Console)

## Development

```bash
npm install
npm run dev
```

On first launch (production mode), the app will prompt for your Firebase Service Account JSON.

## Build Windows Installer

```bash
npm install
npm run dist
```

This produces:
- `release/TashiAdmin Setup <version>.exe` — NSIS installer
- `release/TashiAdmin-Portable-<version>.exe` — Portable executable

## First Run (Production)

1. Launch `Tashi Admin`
2. A setup screen appears — paste your Firebase Service Account JSON
3. Click **Save & Launch** — the admin panel opens automatically
4. Your credentials are saved locally for future launches

## Environment

The app starts a local Express API server (using your Firebase credentials) and loads the React admin panel in an Electron window. All data is fetched from your Firebase Firestore database.

## Tech Stack

- **Electron** — Desktop wrapper
- **React 19 + Vite** — Frontend
- **Express 5** — Local API server
- **Firebase Admin** — Firestore database
- **Tailwind CSS 4** — Styling
