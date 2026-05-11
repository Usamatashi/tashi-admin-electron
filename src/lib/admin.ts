import { apiFetch } from "./apiFetch";

export type AdminUser = {
  id: string;
  userId?: number | null;
  name: string | null;
  phone: string | null;
  role: string;
};

export type AdminOrderItem = {
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type AdminOrder = {
  id: string;
  status: string;
  createdAt: string | null;
  customer: { name?: string; phone?: string; email?: string | null };
  delivery: { address?: string; city?: string; postalCode?: string | null; notes?: string | null };
  payment: { method?: string };
  items: AdminOrderItem[];
  subtotal: number;
  total: number;
};

export type AdminStats = {
  total: number;
  pending: number;
  confirmed: number;
  dispatched: number;
  cancelled: number;
  revenue: number;
};

export class AdminAuthError extends Error {}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new AdminAuthError("Not authenticated");
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

const j = (init?: RequestInit) => ({ credentials: "include" as const, ...(init || {}) });
const json = (body: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify(body),
});

// ── Auth ─────────────────────────────────────────────────────────────────
export async function adminLogin(phone: string, password: string) {
  const res = await apiFetch("/api/admin/login", json({ phone, password }));
  return handle<{ ok: true; admin: AdminUser }>(res);
}
export async function adminLogout() {
  await apiFetch("/api/admin/logout", { method: "POST", credentials: "include" });
}
export async function adminMe() {
  return handle<{ admin: AdminUser }>(await apiFetch("/api/admin/me", j()));
}

// ── Website orders ───────────────────────────────────────────────────────
export async function adminListOrders(status?: string) {
  const url = status
    ? `/api/admin/orders?status=${encodeURIComponent(status)}`
    : "/api/admin/orders";
  return handle<{ orders: AdminOrder[]; count: number }>(await apiFetch(url, j()));
}
export async function adminGetOrder(id: string) {
  return handle<AdminOrder>(await apiFetch(`/api/admin/orders/${encodeURIComponent(id)}`, j()));
}
export async function adminUpdateOrderStatus(id: string, status: string) {
  return handle<AdminOrder>(await apiFetch(`/api/admin/orders/${encodeURIComponent(id)}`, json({ status }, "PATCH")));
}
export async function adminGetStats() {
  return handle<AdminStats>(await apiFetch("/api/admin/stats", j()));
}
export async function adminGetMonthRevenue() {
  return handle<{ posRevenue: number; wholesaleRevenue: number; websiteRevenue: number; totalMonthRevenue: number }>(
    await apiFetch("/api/admin/month-revenue", j())
  );
}

// ── Wholesale (mobile-app) orders ────────────────────────────────────────
export type WholesaleOrderItem = {
  productId: number; productName: string; quantity: number; unitPrice: number;
  totalPoints: number; bonusPoints: number;
  totalValue: number; discountPercent: number; discountedValue: number;
};
export type WholesaleOrder = {
  id: number | string; docId: string; status: string; createdAt: string | null;
  retailerId: number | null; retailerName: string | null; retailerPhone: string | null;
  salesmanId: number | null; salesmanName: string | null; salesmanPhone: string | null;
  billDiscountPercent: number;
  originalTotal: number; subtotal: number; billDiscountAmount: number; finalAmount: number;
  itemCount: number;
};
export type WholesaleOrderDetail = WholesaleOrder & {
  retailerCity: string | null;
  items: WholesaleOrderItem[];
};
export async function adminListWholesaleOrders(status?: string) {
  const url = status ? `/api/admin/wholesale-orders?status=${encodeURIComponent(status)}` : "/api/admin/wholesale-orders";
  return handle<{ orders: WholesaleOrder[]; count: number }>(await apiFetch(url, j()));
}
export async function adminGetWholesaleOrder(docId: string) {
  return handle<WholesaleOrderDetail>(await apiFetch(`/api/admin/wholesale-orders/${encodeURIComponent(docId)}`, j()));
}
export async function adminUpdateWholesaleOrderStatus(docId: string, status: string) {
  return handle<{ ok: true; status: string }>(
    await apiFetch(`/api/admin/wholesale-orders/${encodeURIComponent(docId)}`, json({ status }, "PATCH")),
  );
}

// ── Settings ─────────────────────────────────────────────────────────────
export type AdminPermissions = {
  tab_dashboard: boolean; tab_products: boolean; tab_users: boolean; tab_payments: boolean;
  card_create_qr: boolean; card_orders: boolean; card_claims: boolean;
  card_create_ads: boolean; card_create_text: boolean;
  card_payments: boolean; card_commission: boolean;
};
export async function adminMyPermissions() {
  return handle<AdminPermissions>(await apiFetch("/api/admin/admin-user-settings/me", j()));
}
export async function adminGlobalSettings() {
  return handle<Record<string, boolean>>(await apiFetch("/api/admin/admin-settings", j()));
}
export async function adminUpdateGlobalSettings(s: Record<string, boolean>) {
  return handle<Record<string, boolean>>(await apiFetch("/api/admin/admin-settings", json(s, "PUT")));
}
export async function adminListAdminSettings() {
  return handle<Array<{ id: number; name: string | null; phone: string; role: string; settings: AdminPermissions }>>(
    await apiFetch("/api/admin/admin-user-settings", j()),
  );
}
export async function adminUpdateAdminSettings(userId: number, s: Partial<AdminPermissions>) {
  return handle<AdminPermissions>(await apiFetch(`/api/admin/admin-user-settings/${userId}`, json(s, "PUT")));
}

// ── Products (admin) ─────────────────────────────────────────────────────
export type AdminProduct = {
  id: number; name: string; points: number; salesPrice: number; websitePrice: number | null;
  category: string; productNumber: string | null; vehicleManufacturer: string | null;
  imageUrl: string | null; diagramUrl: string | null; createdAt: string | null;
};
export async function adminListProducts() {
  return handle<AdminProduct[]>(await apiFetch("/api/products/admin", j()));
}
export async function adminCreateProduct(body: Partial<AdminProduct> & { imageBase64?: string | null; diagramBase64?: string | null }) {
  return handle<AdminProduct>(await apiFetch("/api/products/admin", json(body)));
}
export async function adminUpdateProduct(id: number, body: Partial<AdminProduct> & { imageBase64?: string | null; diagramBase64?: string | null }) {
  return handle<AdminProduct>(await apiFetch(`/api/products/admin/${id}`, json(body, "PUT")));
}
export async function adminDeleteProduct(id: number) {
  return handle<{ success: true }>(await apiFetch(`/api/products/admin/${id}`, { method: "DELETE", credentials: "include" }));
}

// ── Users ────────────────────────────────────────────────────────────────
export type AppUser = {
  id: number; phone: string; email: string | null; role: string;
  name: string | null; city: string | null; regionId: number | null;
  points: number; createdAt: string | null;
};
export async function adminListUsers() {
  return handle<AppUser[]>(await apiFetch("/api/admin/users", j()));
}
export async function adminCreateUser(body: { phone: string; password: string; role: string; name?: string; email?: string; city?: string; regionId?: number | null }) {
  return handle<AppUser>(await apiFetch("/api/admin/users", json(body)));
}
export async function adminUpdateUser(id: number, body: Partial<AppUser> & { password?: string }) {
  return handle<AppUser>(await apiFetch(`/api/admin/users/${id}`, json(body, "PUT")));
}
export async function adminDeleteUser(id: number) {
  return handle<{ success: true }>(await apiFetch(`/api/admin/users/${id}`, { method: "DELETE", credentials: "include" }));
}

// ── QR Codes ─────────────────────────────────────────────────────────────
export type QRCode = {
  id: number; qrNumber: string; productId: number; productName: string;
  points: number; status: string; createdAt: string | null;
};
export async function adminListQRCodes() {
  return handle<QRCode[]>(await apiFetch("/api/admin/qr-codes", j()));
}
export async function adminCreateQRCode(body: { qrNumber: string; productId: number }) {
  return handle<QRCode>(await apiFetch("/api/admin/qr-codes", json(body)));
}

// ── Claims ───────────────────────────────────────────────────────────────
export type Claim = {
  id: number; pointsClaimed: number; verifiedPoints: number; unverifiedPoints: number;
  status: string; claimedAt: string | null;
  userName: string; userPhone: string | null; userRole: string; userId: number;
  totalScans: number; verifiedScans: number; missingScans: number;
};
export type ClaimScan = {
  id: number; pointsEarned: number; scannedAt: string | null;
  adminVerified: boolean | null; qrNumber: string; productName: string;
};
export async function adminListClaims() {
  return handle<Claim[]>(await apiFetch("/api/admin/claims", j()));
}
export async function adminClaimScans(id: number) {
  return handle<ClaimScan[]>(await apiFetch(`/api/admin/claims/${id}/scans`, j()));
}
export async function adminVerifyQRForClaim(id: number, qrNumber: string) {
  return handle<{ scanId: number; pointsEarned: number; verifiedPoints: number }>(
    await apiFetch(`/api/admin/claims/${id}/verify-qr`, json({ qrNumber })),
  );
}
export async function adminMarkScanMissing(id: number, scanId: number) {
  return handle<{ scanId: number; verifiedPoints: number }>(
    await apiFetch(`/api/admin/claims/${id}/mark-missing`, json({ scanId })),
  );
}
export async function adminMarkClaimReceived(id: number) {
  return handle<Claim>(await apiFetch(`/api/admin/claims/${id}`, json({ status: "received" }, "PATCH")));
}

// ── Payments ─────────────────────────────────────────────────────────────
export type RetailerBalance = {
  id: number; name: string | null; phone: string; city: string | null;
  totalOrdered: number; totalPaid: number; outstanding: number;
};
export type Payment = {
  id: number; amount: number; notes: string | null; status: string;
  verifiedAt: string | null; verifiedByName: string | null;
  createdAt: string | null;
  retailerId: number; retailerName: string | null; retailerPhone: string | null;
  receivedBy: number | null; collectorName: string | null; collectorPhone: string | null;
};
export async function adminRetailerBalances() {
  return handle<RetailerBalance[]>(await apiFetch("/api/admin/payments/retailer-balances", j()));
}
export async function adminPendingPaymentCount() {
  return handle<{ count: number }>(await apiFetch("/api/admin/payments/pending-count", j()));
}
export async function adminListPayments() {
  return handle<Payment[]>(await apiFetch("/api/admin/payments", j()));
}
export async function adminCreatePayment(body: { retailerId: number; amount: number; notes?: string }) {
  return handle<Payment>(await apiFetch("/api/admin/payments", json(body)));
}
export async function adminVerifyPayment(id: number) {
  return handle<{ id: number; status: string; verifiedAt: string }>(
    await apiFetch(`/api/admin/payments/${id}/verify`, json({}, "PATCH")),
  );
}

// ── Commission ───────────────────────────────────────────────────────────
export type SalesmanCommissionRow = {
  salesmanId: number; name: string | null; phone: string;
  totalOrders: number; confirmedOrders: number;
  totalSalesValue: number; confirmedSalesValue: number;
  totalBonus: number; confirmedBonus: number;
  currentMonthOrders: number; currentMonthSalesValue: number;
};
export type MonthlyTotals = {
  months: Array<{
    year: number; month: number; label: string;
    totalSales: number; orderCount: number;
    salesmen: Array<{ salesmanId: number; name: string | null; phone: string; salesAmount: number; orderCount: number; pct: number }>;
  }>;
};
export type SalesmanMonths = {
  salesmanId: number; salesmanName: string | null; salesmanPhone: string;
  months: Array<{
    year: number; month: number; orderCount: number; salesAmount: number;
    alreadyApproved: boolean; approvedAt?: string; commissionAmount?: number;
    canApprove: boolean;
  }>;
};
export type SalesmanSales = {
  salesmanId: number; salesmanName: string | null; salesmanPhone: string;
  periodFrom: string; periodTo: string;
  salesAmount: number; orderCount: number;
  orders: Array<{ id: number; createdAt: string | null; retailerName: string | null; retailerPhone: string | null; totalValue: number }>;
  alreadyApproved: boolean; approvedAt?: string; commissionAmount?: number; commissionPercentage?: number;
};
export async function adminSalesmanCommissions() {
  return handle<SalesmanCommissionRow[]>(await apiFetch("/api/admin/commission/salesman-commissions", j()));
}
export async function adminMonthlyTotals() {
  return handle<MonthlyTotals>(await apiFetch("/api/admin/commission/monthly-totals", j()));
}
export async function adminSalesmanMonths(salesmanId: number) {
  return handle<SalesmanMonths>(await apiFetch(`/api/admin/commission/salesman-months/${salesmanId}`, j()));
}
export async function adminSalesmanSales(salesmanId: number, year?: number, month?: number) {
  const qs = year && month ? `?year=${year}&month=${month}` : "";
  return handle<SalesmanSales>(await apiFetch(`/api/admin/commission/salesman-sales/${salesmanId}${qs}`, j()));
}
export async function adminApproveCommission(body: { salesmanId: number; percentage: number; salesAmount: number; periodFrom: string; periodTo?: string }) {
  return handle(await apiFetch("/api/admin/commission", json(body)));
}

// ── Ads ──────────────────────────────────────────────────────────────────
export type Ad = { id: number; mediaType: string; title: string | null; createdAt: string | null; mediaUrl: string };
export async function adminListAds() { return handle<Ad[]>(await apiFetch("/api/admin/ads", j())); }
export async function adminCreateAd(body: { imageBase64?: string; mediaType?: string; title?: string }) {
  return handle<Ad>(await apiFetch("/api/admin/ads", json(body)));
}
export async function adminUploadAdFile(file: File, mediaType: string, title?: string) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("mediaType", mediaType);
  if (title) fd.append("title", title);
  return handle<Ad>(await apiFetch("/api/admin/ads", { method: "POST", credentials: "include", body: fd }));
}
export async function adminDeleteAd(id: number) {
  return handle<{ success: true }>(await apiFetch(`/api/admin/ads/${id}`, { method: "DELETE", credentials: "include" }));
}

// ── Ticker ───────────────────────────────────────────────────────────────
export type TickerItem = { id: number; text: string; createdAt: string | null };
export async function adminListTicker() { return handle<TickerItem[]>(await apiFetch("/api/admin/ticker", j())); }
export async function adminAddTicker(text: string) {
  return handle<TickerItem>(await apiFetch("/api/admin/ticker", json({ text })));
}
export async function adminDeleteTicker(id: number) {
  return handle<{ success: true }>(await apiFetch(`/api/admin/ticker/${id}`, { method: "DELETE", credentials: "include" }));
}

// ── Regions ──────────────────────────────────────────────────────────────
export type Region = { id: number; name: string };
export async function adminListRegions() { return handle<Region[]>(await apiFetch("/api/admin/regions", j())); }
export async function adminCreateRegion(name: string) {
  return handle<Region>(await apiFetch("/api/admin/regions", json({ name })));
}
export async function adminDeleteRegion(id: number) {
  return handle<{ success: true }>(await apiFetch(`/api/admin/regions/${id}`, { method: "DELETE", credentials: "include" }));
}

// ── Team Members ─────────────────────────────────────────────────────────
export type TeamMember = {
  id: number; name: string; role: string; order: number; photoUrl: string | null; createdAt: string | null;
};
export async function adminListTeam() {
  return handle<TeamMember[]>(await apiFetch("/api/admin/team", j()));
}
export async function adminCreateTeamMember(fd: FormData) {
  return handle<TeamMember>(await apiFetch("/api/admin/team", { method: "POST", credentials: "include", body: fd }));
}
export async function adminUpdateTeamMember(id: number, fd: FormData) {
  return handle<TeamMember>(await apiFetch(`/api/admin/team/${id}`, { method: "PUT", credentials: "include", body: fd }));
}
export async function adminDeleteTeamMember(id: number) {
  return handle<{ success: true }>(await apiFetch(`/api/admin/team/${id}`, { method: "DELETE", credentials: "include" }));
}

// ── WhatsApp Contacts ────────────────────────────────────────────────────
export type WhatsappContacts = { mechanic: string; salesman: string; retailer: string };
export async function adminGetWhatsappContacts() {
  return handle<WhatsappContacts>(await apiFetch("/api/admin/whatsapp-contacts", j()));
}
export async function adminUpdateWhatsappContacts(c: Partial<WhatsappContacts>) {
  return handle<WhatsappContacts>(await apiFetch("/api/admin/whatsapp-contacts", json(c, "PUT")));
}

// ── POS Stock ────────────────────────────────────────────────────────────
export type StockItem = {
  id: string; productId: number; productName: string; sku: string | null;
  quantity: number; minQuantity: number;
  costPrice: number | null; averageCost: number | null; totalStockValue: number;
  sellingPrice: number | null; updatedAt: string | null;
};
export type StockHistoryEntry = {
  id: string; stockId: string; productId: number; productName: string;
  type: "add" | "remove";
  qty: number; costPerUnit: number;
  avgCostBefore: number; avgCostAfter: number;
  totalValueBefore: number; totalValueAfter: number;
  quantityBefore: number; quantityAfter: number;
  category: string; reason: string | null;
  createdBy: string | null; createdAt: string | null;
};
export async function adminListStock() {
  return handle<StockItem[]>(await apiFetch("/api/admin/pos/stock", j()));
}
export async function adminCreateStock(body: { productId: number; productName: string; sku?: string; quantity?: number; minQuantity?: number; costPrice?: number; sellingPrice?: number }) {
  return handle<StockItem>(await apiFetch("/api/admin/pos/stock", json(body)));
}
export async function adminUpdateStock(id: string, body: { minQuantity?: number; sellingPrice?: number | null }) {
  return handle<StockItem>(await apiFetch(`/api/admin/pos/stock/${id}`, json(body, "PUT")));
}
export async function adminAdjustStock(id: string, qty: number, category: string, reason?: string, costPerUnit?: number) {
  return handle<StockItem>(await apiFetch(`/api/admin/pos/stock/${id}/adjust`, json({ qty, category, reason, costPerUnit })));
}
export async function adminGetStockHistory(id: string) {
  return handle<StockHistoryEntry[]>(await apiFetch(`/api/admin/pos/stock/${id}/history`, j()));
}
export async function adminDeleteStock(id: string) {
  return handle<{ success: true }>(await apiFetch(`/api/admin/pos/stock/${id}`, { method: "DELETE", credentials: "include" }));
}
export async function adminSyncStockFromPurchases() {
  return handle<{ ok: true; created: number; updated: number }>(
    await apiFetch("/api/admin/pos/stock/sync-from-purchases", { method: "POST", credentials: "include" })
  );
}

// ── POS Sales ─────────────────────────────────────────────────────────────
export type POSSaleItem = {
  productId: number; productName: string; sku: string;
  qty: number; unitPrice: number; discountPct: number; lineTotal: number;
};
export type POSSale = {
  id: string; saleNumber: string;
  customerId: string | null; customerName: string;
  items: POSSaleItem[];
  subtotal: number; discountAmount: number; discountPct: number; total: number;
  paymentMethod: string;
  cashReceived: number | null; changeGiven: number | null;
  notes: string | null; createdAt: string | null;
};
export type POSSaleStats = { totalRevenue: number; todayRevenue: number; todayCount: number; totalSales: number };
export async function adminListPOSSales(limit = 50) {
  return handle<POSSale[]>(await apiFetch(`/api/admin/pos/sales?limit=${limit}`, j()));
}
export async function adminCreatePOSSale(body: Omit<POSSale, "id" | "saleNumber" | "createdAt">) {
  return handle<POSSale>(await apiFetch("/api/admin/pos/sales", json(body)));
}
export async function adminGetPOSSaleStats() {
  return handle<POSSaleStats>(await apiFetch("/api/admin/pos/sales/stats", j()));
}

// ── Sales Analytics (combined POS + Wholesale) ────────────────────────────
export type SalesTx = {
  id: string; type: "pos" | "wholesale" | "website"; ref: string;
  customer: string; customerId: string | null;
  amount: number; netAmount: number; refundedAmount: number;
  returned: boolean; returnRefs: string[];
  createdAt: string; paymentMethod: string;
  status: string | null; itemCount: number;
  items: { productName: string; qty: number; unitPrice: number; discountPct: number; lineTotal: number; sku?: string; productId?: number | null }[];
  raw?: unknown;
};
export type SalesAnalyticsStats = {
  totalRevenue: number; posRevenue: number; wsRevenue: number; websiteRevenue: number;
  todayRevenue: number; todayPOSRevenue: number; todayWSRevenue: number; todayWebsiteRevenue: number;
  totalCount: number;
};
export type SalesChartPoint = { date: string; pos: number; wholesale: number; website: number; total: number };
export type TopProduct = { name: string; qty: number; revenue: number };
export type SalesAnalyticsResult = {
  stats: SalesAnalyticsStats; chartData: SalesChartPoint[];
  topProducts: TopProduct[]; transactions: SalesTx[];
};
export type SalesAutocompleteOptions = { customers: string[]; products: string[] };
export async function adminGetSalesAnalytics(params: { from?: string; to?: string; channel?: string; customer?: string; product?: string } = {}) {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.channel) q.set("channel", params.channel);
  if (params.customer) q.set("customer", params.customer);
  if (params.product) q.set("product", params.product);
  return handle<SalesAnalyticsResult>(await apiFetch(`/api/admin/sales-analytics?${q}`, j()));
}
export async function adminGetSalesAutocompleteOptions() {
  return handle<SalesAutocompleteOptions>(await apiFetch("/api/admin/sales-analytics/options", j()));
}

// ── POS Returns ───────────────────────────────────────────────────────────
export type POSReturnItem = {
  productId: number; productName: string; sku: string;
  qty: number; unitPrice: number; discountPct: number; lineTotal: number;
};
export type POSReturn = {
  id: string; returnNumber: string;
  saleId: string; saleNumber: string | null;
  customerId: string | null; customerName: string;
  items: POSReturnItem[];
  totalRefund: number;
  reason: string | null;
  paymentMethod: string;
  createdAt: string | null;
};
export async function adminListPOSReturns(limit = 50) {
  return handle<POSReturn[]>(await apiFetch(`/api/admin/pos/returns?limit=${limit}`, j()));
}
export async function adminCreatePOSReturn(body: {
  saleId: string; saleNumber: string | null; customerId: string | null; customerName: string;
  items: POSReturnItem[]; totalRefund: number; reason: string | null; paymentMethod: string;
}) {
  return handle<POSReturn>(await apiFetch("/api/admin/pos/returns", json(body)));
}

// ── Website / Retail Returns ───────────────────────────────────────────────
export type WebsiteReturnItem = {
  productId: number | null; productName: string; sku: string;
  qty: number; unitPrice: number; lineTotal: number;
};
export type WebsiteReturn = {
  id: string; returnNumber: string;
  orderId: string; orderDocId: string;
  customerName: string; customerPhone: string | null;
  items: WebsiteReturnItem[];
  totalRefund: number;
  reason: string | null;
  refundMethod: string;
  createdAt: string | null;
};
export async function adminListWebsiteReturns(limit = 50) {
  return handle<WebsiteReturn[]>(await apiFetch(`/api/admin/website-returns?limit=${limit}`, j()));
}
export async function adminCreateWebsiteReturn(body: {
  orderId: string; orderDocId: string; customerName: string; customerPhone: string | null;
  items: WebsiteReturnItem[]; totalRefund: number; reason: string | null; refundMethod: string;
}) {
  return handle<WebsiteReturn>(await apiFetch("/api/admin/website-returns", json(body)));
}

// ── Wholesale Returns ──────────────────────────────────────────────────────
export type WholesaleReturnItem = {
  productId: number | null; productName: string; sku: string;
  qty: number; unitPrice: number; lineTotal: number;
};
export type WholesaleReturn = {
  id: string; returnNumber: string;
  orderId: string; orderDocId: string;
  retailerName: string; retailerPhone: string | null; salesmanName: string | null;
  items: WholesaleReturnItem[];
  totalRefund: number;
  reason: string | null;
  createdAt: string | null;
};
export async function adminListWholesaleReturns(limit = 50) {
  return handle<WholesaleReturn[]>(await apiFetch(`/api/admin/wholesale-returns?limit=${limit}`, j()));
}
export async function adminCreateWholesaleReturn(body: {
  orderId: string; orderDocId: string; retailerName: string; retailerPhone: string | null;
  salesmanName: string | null; items: WholesaleReturnItem[]; totalRefund: number; reason: string | null;
}) {
  return handle<WholesaleReturn>(await apiFetch("/api/admin/wholesale-returns", json(body)));
}

// ── POS Customers ─────────────────────────────────────────────────────────
export type POSCustomerType = "mechanic" | "retailer" | "consumer";
export type POSCustomer = {
  id: string; source?: string; name: string; phone: string | null;
  email?: string | null; city: string | null; address?: string | null;
  customerType: POSCustomerType;
  totalPurchases: number; createdAt: string | null; lastPurchaseAt: string | null;
};
export async function adminListPOSCustomers() {
  return handle<POSCustomer[]>(await apiFetch("/api/admin/pos/customers", j()));
}
export async function adminListAllPOSCustomers() {
  return handle<{ mechanics: POSCustomer[]; retailers: POSCustomer[]; consumers: POSCustomer[] }>(
    await apiFetch("/api/admin/pos/customers/all-types", j()),
  );
}
export async function adminCreatePOSCustomer(body: { name: string; phone?: string; email?: string; city?: string; address?: string; customerType?: string }) {
  return handle<POSCustomer>(await apiFetch("/api/admin/pos/customers", json(body)));
}
export async function adminUpdatePOSCustomer(id: string, body: Partial<POSCustomer>) {
  return handle<POSCustomer>(await apiFetch(`/api/admin/pos/customers/${id}`, json(body, "PUT")));
}
export async function adminDeletePOSCustomer(id: string) {
  return handle<{ success: true }>(await apiFetch(`/api/admin/pos/customers/${id}`, { method: "DELETE", credentials: "include" }));
}

// ── Careers ───────────────────────────────────────────────────────────────
export type CareerJob = {
  id: string; title: string; department: string | null; location: string | null;
  type: string | null; description: string | null; requirements: string | null;
  isOpen: boolean; createdAt: string | null;
};
export type CareerApplication = {
  id: string; jobId: string; jobTitle: string;
  applicantName: string; email: string | null; phone: string | null;
  coverLetter: string | null; status: "new" | "reviewing" | "shortlisted" | "rejected";
  createdAt: string | null;
};
export async function adminListCareerJobs() {
  return handle<CareerJob[]>(await apiFetch("/api/careers/jobs", j()));
}
export async function adminCreateCareerJob(body: Partial<CareerJob>) {
  return handle<CareerJob>(await apiFetch("/api/careers/jobs", json(body)));
}
export async function adminUpdateCareerJob(id: string, body: Partial<CareerJob>) {
  return handle<CareerJob>(await apiFetch(`/api/careers/jobs/${id}`, json(body, "PUT")));
}
export async function adminDeleteCareerJob(id: string) {
  return handle<{ success: true }>(await apiFetch(`/api/careers/jobs/${id}`, { method: "DELETE", credentials: "include" }));
}
export async function adminListCareerApplications(jobId?: string) {
  const url = jobId ? `/api/careers/applications?jobId=${jobId}` : "/api/careers/applications";
  return handle<CareerApplication[]>(await apiFetch(url, j()));
}
export async function adminUpdateCareerApplication(id: string, status: CareerApplication["status"]) {
  return handle<CareerApplication>(await apiFetch(`/api/careers/applications/${id}`, json({ status }, "PATCH")));
}

// ── Suppliers ─────────────────────────────────────────────────────────────
export type Supplier = {
  id: string; name: string; phone: string | null; email: string | null;
  address: string | null; city: string | null; notes: string | null; createdAt: string | null;
};
export type SupplierCreditPayment = {
  id: string; paymentNumber: string; supplierId: string; supplierName: string;
  amount: number; method: string; date: string; notes: string | null; createdAt: string | null;
};
export type SupplierCreditSummary = {
  supplierId: string; supplierName: string;
  totalCreditExpenses: number; totalPurchaseDebt: number;
  totalGross: number; totalPayments: number; balance: number;
  creditExpenses: Expense[]; unpaidPurchases: Purchase[]; payments: SupplierCreditPayment[];
};
export async function adminListSuppliers() {
  return handle<Supplier[]>(await apiFetch("/api/admin/suppliers", j()));
}
export async function adminCreateSupplier(body: Partial<Supplier>) {
  return handle<Supplier>(await apiFetch("/api/admin/suppliers", json(body)));
}
export async function adminUpdateSupplier(id: string, body: Partial<Supplier>) {
  return handle<Supplier>(await apiFetch(`/api/admin/suppliers/${id}`, json(body, "PUT")));
}
export async function adminDeleteSupplier(id: string) {
  return handle<{ success: true }>(await apiFetch(`/api/admin/suppliers/${id}`, { method: "DELETE", credentials: "include" }));
}
export async function adminGetSupplierCreditSummary(id: string) {
  return handle<SupplierCreditSummary>(await apiFetch(`/api/admin/suppliers/${id}/credit-summary`, j()));
}
export async function adminCreateCreditPayment(supplierId: string, body: { amount: number; method: string; date: string; notes?: string }) {
  return handle<SupplierCreditPayment>(await apiFetch(`/api/admin/suppliers/${supplierId}/credit-payments`, json(body)));
}
export async function adminDeleteCreditPayment(supplierId: string, paymentId: string) {
  return handle<{ success: true }>(await apiFetch(`/api/admin/suppliers/${supplierId}/credit-payments/${paymentId}`, { method: "DELETE", credentials: "include" }));
}

// ── Expenses ──────────────────────────────────────────────────────────────
export type Expense = {
  id: string; expenseNumber: string; category: string; amount: number;
  description: string | null; date: string; supplierId: string | null;
  supplierName: string | null; paymentMethod: string; isCredit: boolean;
  notes: string | null; createdAt: string | null;
};
export async function adminListExpenses(params: { from?: string; to?: string; category?: string } = {}) {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.category) q.set("category", params.category);
  return handle<Expense[]>(await apiFetch(`/api/admin/expenses?${q}`, j()));
}
export async function adminCreateExpense(body: Partial<Expense> & { amount: number }) {
  return handle<Expense>(await apiFetch("/api/admin/expenses", json(body)));
}
export async function adminUpdateExpense(id: string, body: Partial<Expense>) {
  return handle<Expense>(await apiFetch(`/api/admin/expenses/${id}`, json(body, "PUT")));
}
export async function adminDeleteExpense(id: string) {
  return handle<{ success: true }>(await apiFetch(`/api/admin/expenses/${id}`, { method: "DELETE", credentials: "include" }));
}

// ── Purchases ─────────────────────────────────────────────────────────────
export type PurchaseItem = { productName: string; sku: string; qty: number; unitCost: number; lineTotal: number };
export type Purchase = {
  id: string; purchaseNumber: string; supplierId: string | null; supplierName: string | null;
  items: PurchaseItem[]; totalAmount: number; amountPaid: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  notes: string | null; date: string; createdAt: string | null;
};
export type PurchaseReturn = {
  id: string; returnNumber: string; purchaseId: string; purchaseNumber: string;
  supplierId: string | null; supplierName: string | null;
  items: PurchaseItem[]; totalReturn: number; reason: string | null; createdAt: string | null;
};
export async function adminListPurchases(supplierId?: string) {
  const url = supplierId ? `/api/admin/purchases?supplierId=${supplierId}` : "/api/admin/purchases";
  return handle<Purchase[]>(await apiFetch(url, j()));
}
export async function adminCreatePurchase(body: Omit<Purchase, "id" | "purchaseNumber" | "totalAmount" | "amountPaid" | "createdAt"> & { items: Array<Omit<PurchaseItem, "lineTotal">>; amountPaid?: number }) {
  return handle<Purchase>(await apiFetch("/api/admin/purchases", json(body)));
}
export async function adminUpdatePurchase(id: string, body: { paymentStatus?: Purchase["paymentStatus"]; amountPaid?: number; notes?: string }) {
  return handle<Purchase>(await apiFetch(`/api/admin/purchases/${id}`, json(body, "PATCH")));
}
export async function adminDeletePurchase(id: string) {
  return handle<{ success: true }>(await apiFetch(`/api/admin/purchases/${id}`, { method: "DELETE", credentials: "include" }));
}
export async function adminListPurchaseReturns() {
  return handle<PurchaseReturn[]>(await apiFetch("/api/admin/purchases/returns", j()));
}
export async function adminCreatePurchaseReturn(body: { purchaseId: string; purchaseNumber: string; supplierId?: string | null; supplierName?: string; items: PurchaseItem[]; totalReturn: number; reason?: string }) {
  return handle<PurchaseReturn>(await apiFetch("/api/admin/purchases/returns", json(body)));
}

// ── Chart of Accounts ─────────────────────────────────────────────────────
export type Account = {
  id: string; code: string; name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  subtype: string; parentId: string | null;
  description: string; isActive: boolean; createdAt: string | null;
};
export async function adminListAccounts() {
  return handle<Account[]>(await apiFetch("/api/admin/accounts", j()));
}
export async function adminSeedAccounts() {
  return handle<{ message: string; count: number; accounts?: Account[] }>(await apiFetch("/api/admin/accounts/seed", json({})));
}
export async function adminCreateAccount(body: Partial<Account>) {
  return handle<Account>(await apiFetch("/api/admin/accounts", json(body)));
}
export async function adminUpdateAccount(id: string, body: Partial<Account>) {
  return handle<Account>(await apiFetch(`/api/admin/accounts/${id}`, json(body, "PUT")));
}
export async function adminDeleteAccount(id: string) {
  return handle<{ success: true }>(await apiFetch(`/api/admin/accounts/${id}`, { method: "DELETE", credentials: "include" }));
}

// ── Account Ledger ────────────────────────────────────────────────────────
export type LedgerLine = {
  id: string; date: string; source: "journal" | "expense";
  reference: string; description: string;
  debit: number; credit: number; runningBalance: number;
  journalId?: string; expenseId?: string;
};
export type AccountLedger = {
  account: Account;
  lines: LedgerLine[];
  totalDebit: number; totalCredit: number; closingBalance: number;
};
export async function adminGetAccountLedger(id: string, params: { from?: string; to?: string } = {}) {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to)   q.set("to", params.to);
  return handle<AccountLedger>(await apiFetch(`/api/admin/accounts/${id}/ledger?${q}`, j()));
}

// ── Journal Entries ───────────────────────────────────────────────────────
export type JournalLine = {
  accountId: string; accountCode: string; accountName: string;
  debit: number; credit: number; description: string;
};
export type JournalEntry = {
  id: string; reference: string; date: string; description: string;
  lines: JournalLine[]; totalDebit: number; totalCredit: number;
  status: "draft" | "posted" | "void";
  createdAt: string | null; postedAt: string | null; voidedAt: string | null;
  voidReason: string | null;
};
export async function adminListJournals(params: { from?: string; to?: string; status?: string } = {}) {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.status) q.set("status", params.status);
  return handle<JournalEntry[]>(await apiFetch(`/api/admin/journals?${q}`, j()));
}
export async function adminCreateJournal(body: { date: string; description?: string; reference?: string; lines: Partial<JournalLine>[] }) {
  return handle<JournalEntry>(await apiFetch("/api/admin/journals", json(body)));
}
export async function adminUpdateJournal(id: string, body: Partial<{ date: string; description: string; reference: string; lines: Partial<JournalLine>[] }>) {
  return handle<JournalEntry>(await apiFetch(`/api/admin/journals/${id}`, json(body, "PUT")));
}
export async function adminPostJournal(id: string) {
  return handle<JournalEntry>(await apiFetch(`/api/admin/journals/${id}/post`, json({},"PUT")));
}
export async function adminVoidJournal(id: string, reason?: string) {
  return handle<JournalEntry>(await apiFetch(`/api/admin/journals/${id}/void`, json({ reason }, "PUT")));
}
export async function adminDeleteJournal(id: string) {
  return handle<{ success: true }>(await apiFetch(`/api/admin/journals/${id}`, { method: "DELETE", credentials: "include" }));
}
export async function adminGenerateMonthlyJournals(year: number, month: number) {
  return handle<{ message: string; monthLabel: string; monthName: string; entries: JournalEntry[] }>(
    await apiFetch("/api/admin/journals/generate-monthly", json({ year, month })),
  );
}

// ── Cash Book ─────────────────────────────────────────────────────────────
export type CashBookEntry = {
  date: string; type: "receipt" | "payment"; source: string;
  ref: string; description: string; receipt: number; payment: number;
  balance: number; paymentMethod: string; sourceId: string;
};
export async function adminGetCashBook(params: { from?: string; to?: string } = {}) {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  return handle<{ entries: CashBookEntry[]; summary: { totalReceipts: number; totalPayments: number; netBalance: number } }>(
    await apiFetch(`/api/admin/cash-book?${q}`, j()),
  );
}

// ── Financial Reports (GL-driven) ─────────────────────────────────────────
export type GLLine = { code: string; name: string; amount: number };
export type PLReport = {
  period: { from: string; to: string };
  source: "gl";
  revenue: { lines: GLLine[]; gross: number; returns: number; net: number };
  cogs: { lines: GLLine[]; total: number };
  grossProfit: number;
  operatingExpenses: { lines: GLLine[]; total: number };
  operatingProfit: number;
  financeExpenses: { lines: GLLine[]; total: number };
  netProfit: number;
};
export type BSRow = { code: string; name: string; amount: number };
export type BalanceSheet = {
  asOf: string;
  source: "gl";
  assets: {
    current: { rows: BSRow[]; total: number };
    nonCurrent: { rows: BSRow[]; total: number };
    total: number;
  };
  liabilities: {
    current: { rows: BSRow[]; total: number };
    nonCurrent: { rows: BSRow[]; total: number };
    total: number;
  };
  equity: { rows: BSRow[]; retainedEarnings: number; totalCapital: number; total: number };
  totalLiabilitiesAndEquity: number;
  checkBalance: boolean;
};
export type TrialBalance = {
  asOf: string;
  source: "gl";
  rows: { id: string; code: string; name: string; type: string; debit: number; credit: number }[];
  totalDebit: number; totalCredit: number; balanced: boolean;
};
export type CashFlow = {
  period: { from: string; to: string };
  source: "gl";
  method: "indirect";
  operatingActivities: {
    netProfit: number;
    adjustments: { depreciation: number };
    workingCapitalChanges: { changeInAR: number; changeInInventory: number; changeInAP: number; changeInAccruedExpenses: number };
    total: number;
  };
  investingActivities: { fixedAssetPurchases: number; total: number };
  financingActivities: { netShortTermLoans: number; netLongTermLoans: number; ownerCapitalInjection: number; drawings: number; total: number };
  netCashMovement: number;
  openingCashBalance: number;
  closingCashBalance: number;
  checkBalance: boolean;
};
export async function adminGetPL(params: { from?: string; to?: string } = {}) {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  return handle<PLReport>(await apiFetch(`/api/admin/financial-reports/pl?${q}`, j()));
}
export async function adminGetBalanceSheet(date?: string) {
  const q = date ? `?date=${date}` : "";
  return handle<BalanceSheet>(await apiFetch(`/api/admin/financial-reports/balance-sheet${q}`, j()));
}
export async function adminGetTrialBalance(date?: string) {
  const q = date ? `?date=${date}` : "";
  return handle<TrialBalance>(await apiFetch(`/api/admin/financial-reports/trial-balance${q}`, j()));
}
export async function adminGetCashFlow(params: { from?: string; to?: string } = {}) {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  return handle<CashFlow>(await apiFetch(`/api/admin/financial-reports/cash-flow?${q}`, j()));
}

// ── Constants & helpers ──────────────────────────────────────────────────
export const STATUS_META: Record<string, { label: string; tone: string; ring: string; dot: string }> = {
  pending:    { label: "Pending",    tone: "bg-amber-50 text-amber-800",   ring: "ring-amber-200",   dot: "bg-amber-500"   },
  dispatched: { label: "Dispatched", tone: "bg-indigo-50 text-indigo-800", ring: "ring-indigo-200",  dot: "bg-indigo-500"  },
  cancelled:  { label: "Cancelled",  tone: "bg-red-50 text-red-800",       ring: "ring-red-200",     dot: "bg-red-500"     },
  // legacy / wholesale compat
  confirmed:  { label: "Confirmed",  tone: "bg-blue-50 text-blue-800",     ring: "ring-blue-200",    dot: "bg-blue-500"    },
  shipped:    { label: "Dispatched", tone: "bg-indigo-50 text-indigo-800", ring: "ring-indigo-200",  dot: "bg-indigo-500"  },
  delivered:  { label: "Delivered",  tone: "bg-emerald-50 text-emerald-800", ring: "ring-emerald-200", dot: "bg-emerald-500" },
  received:   { label: "Received",   tone: "bg-emerald-50 text-emerald-800", ring: "ring-emerald-200", dot: "bg-emerald-500" },
  verified:   { label: "Verified",   tone: "bg-emerald-50 text-emerald-800", ring: "ring-emerald-200", dot: "bg-emerald-500" },
};
export const PAYMENT_LABEL: Record<string, string> = {
  cod: "Cash on Delivery", easypaisa: "Easypaisa", jazzcash: "JazzCash",
};
export function formatPrice(value: number) {
  return `Rs. ${Math.round(value).toLocaleString()}`;
}
export function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
  } catch { return iso; }
}
export function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-PK", { dateStyle: "medium" }); } catch { return iso; }
}
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
