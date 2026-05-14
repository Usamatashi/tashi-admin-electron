import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "./lib/firebase.js";
import websiteOrdersRouter from "./routes/website-orders.js";
import wholesaleOrdersRouter from "./routes/wholesale-orders.js";
import adminAuthRouter from "./routes/admin-auth.js";
import productsRouter from "./routes/products.js";
import usersRouter from "./routes/users.js";
import qrcodesRouter from "./routes/qrcodes.js";
import claimsRouter from "./routes/claims.js";
import paymentsRouter from "./routes/payments.js";
import commissionRouter from "./routes/commission.js";
import adsRouter from "./routes/ads.js";
import tickerRouter from "./routes/ticker.js";
import regionsRouter from "./routes/regions.js";
import adminSettingsRouter from "./routes/admin-settings.js";
import adminUserSettingsRouter from "./routes/admin-user-settings.js";
import whatsappContactsRouter from "./routes/whatsapp-contacts.js";
import teamRouter from "./routes/team.js";
import posRouter from "./routes/pos.js";
import stockRouter from "./routes/stock.js";
import posCustomersRouter from "./routes/pos-customers.js";
import posReturnsRouter from "./routes/pos-returns.js";
import websiteReturnsRouter from "./routes/website-returns.js";
import wholesaleReturnsRouter from "./routes/wholesale-returns.js";
import salesAnalyticsRouter from "./routes/sales-analytics.js";
import careersRouter from "./routes/careers.js";
import suppliersRouter from "./routes/suppliers.js";
import expensesRouter from "./routes/expenses.js";
import purchasesRouter from "./routes/purchases.js";
import accountsRouter from "./routes/accounts.js";
import journalsRouter from "./routes/journals.js";
import cashBookRouter from "./routes/cash-book.js";
import financialReportsRouter from "./routes/financial-reports.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const ALLOWED_ORIGINS = [
  "https://tashibrakes.com",
  "https://www.tashibrakes.com",
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",").map(o => o.trim()) : []),
];

function isReplitOrigin(origin) {
  if (!origin) return false;
  return origin.endsWith(".replit.dev") || origin.endsWith(".replit.app") || origin.endsWith(".repl.co");
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || isReplitOrigin(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "60mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Public + website-side
app.use("/api/products", productsRouter);
app.use("/api", websiteOrdersRouter);
app.use("/api", wholesaleOrdersRouter);

// Admin auth
app.use("/api/admin", adminAuthRouter);


// Admin resource routers
app.use("/api/admin/users", usersRouter);
app.use("/api/admin/qr-codes", qrcodesRouter);
app.use("/api/admin/claims", claimsRouter);
app.use("/api/admin/payments", paymentsRouter);
app.use("/api/admin/commission", commissionRouter);
app.use("/api/admin/ads", adsRouter);
app.use("/api/admin/ticker", tickerRouter);
app.use("/api/admin/regions", regionsRouter);
app.use("/api/admin/admin-settings", adminSettingsRouter);
app.use("/api/admin/admin-user-settings", adminUserSettingsRouter);
app.use("/api/admin/whatsapp-contacts", whatsappContactsRouter);
app.use("/api/admin/team", teamRouter);
app.use("/api/admin/pos/sales", posRouter);
app.use("/api/admin/pos/stock", stockRouter);
app.use("/api/admin/pos/customers", posCustomersRouter);
app.use("/api/admin/pos/returns", posReturnsRouter);
app.use("/api/admin/website-returns", websiteReturnsRouter);
app.use("/api/admin/wholesale-returns", wholesaleReturnsRouter);
app.use("/api/admin/sales-analytics", salesAnalyticsRouter);
app.use("/api/careers", careersRouter);
app.use("/api/admin/suppliers", suppliersRouter);
app.use("/api/admin/expenses", expensesRouter);
app.use("/api/admin/purchases", purchasesRouter);
app.use("/api/admin/accounts", accountsRouter);
app.use("/api/admin/journals", journalsRouter);
app.use("/api/admin/cash-book", cashBookRouter);
app.use("/api/admin/financial-reports", financialReportsRouter);

const isProd = process.env.NODE_ENV === "production";
const isElectron = process.env.IS_ELECTRON === "1";

if (isProd || isElectron) {
  const distDir = path.resolve(__dirname, "..", "dist");
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
}

const port = Number(process.env.PORT ?? (isProd ? 5000 : 3001));
const host = "0.0.0.0";

app.listen(port, host, () => {
  console.log(`API server listening on http://${host}:${port}`);
});
