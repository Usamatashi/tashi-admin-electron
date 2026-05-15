import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Home = lazy(() => import("@/pages/Home"));
const About = lazy(() => import("@/pages/About"));
const Career = lazy(() => import("@/pages/Career"));
const Products = lazy(() => import("@/pages/Products"));
const Contact = lazy(() => import("@/pages/Contact"));
const Cart = lazy(() => import("@/pages/Cart"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const OrderConfirmation = lazy(() => import("@/pages/OrderConfirmation"));
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const AdminLayout = lazy(() => import("@/components/AdminLayout"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminOrders = lazy(() => import("@/pages/AdminOrders"));
const AdminOrderDetail = lazy(() => import("@/pages/AdminOrderDetail"));
const AdminWholesaleOrderDetail = lazy(() => import("@/pages/AdminWholesaleOrderDetail"));
const AdminProducts = lazy(() => import("@/pages/AdminProducts"));
const AdminClaims = lazy(() => import("@/pages/AdminClaims"));
const AdminPayments = lazy(() => import("@/pages/AdminPayments"));
const AdminCommission = lazy(() => import("@/pages/AdminCommission"));
const AdminSalesmanDetail = lazy(() => import("@/pages/AdminSalesmanDetail"));
const AdminQRCodes = lazy(() => import("@/pages/AdminQRCodes"));
const AdminPrintLabels = lazy(() => import("@/pages/AdminPrintLabels"));
const AdminAds = lazy(() => import("@/pages/AdminAds"));
const AdminTicker = lazy(() => import("@/pages/AdminTicker"));
const AdminUsers = lazy(() => import("@/pages/AdminUsers"));
const AdminRegions = lazy(() => import("@/pages/AdminRegions"));
const AdminWhatsapp = lazy(() => import("@/pages/AdminWhatsapp"));
const AdminSuperConfig = lazy(() => import("@/pages/AdminSuperConfig"));
const AdminTeam = lazy(() => import("@/pages/AdminTeam"));
const AdminPOS = lazy(() => import("@/pages/AdminPOS"));
const AdminStock = lazy(() => import("@/pages/AdminStock"));
const AdminPOSCustomers = lazy(() => import("@/pages/AdminPOSCustomers"));
const AdminPOSSales = lazy(() => import("@/pages/AdminPOSSales"));
const AdminPOSReturns = lazy(() => import("@/pages/AdminPOSReturns"));
const AdminCareers = lazy(() => import("@/pages/AdminCareers"));
const AdminSuppliers = lazy(() => import("@/pages/AdminSuppliers"));
const AdminExpenses = lazy(() => import("@/pages/AdminExpenses"));
const AdminPurchases = lazy(() => import("@/pages/AdminPurchases"));
const AdminChartOfAccounts = lazy(() => import("@/pages/AdminChartOfAccounts"));
const AdminAccountLedger = lazy(() => import("@/pages/AdminAccountLedger"));
const AdminJournals = lazy(() => import("@/pages/AdminJournals"));
const AdminCashBook = lazy(() => import("@/pages/AdminCashBook"));
const AdminFinancialReports = lazy(() => import("@/pages/AdminFinancialReports"));
const AdminOrderPrint = lazy(() => import("@/pages/AdminOrderPrint"));
const AdminOrderReceipt = lazy(() => import("@/pages/AdminOrderReceipt"));
const AdminWholesaleOrderPrint = lazy(() => import("@/pages/AdminWholesaleOrderPrint"));
const AdminWholesaleOrderReceipt = lazy(() => import("@/pages/AdminWholesaleOrderReceipt"));
const AdminPrintSettings = lazy(() => import("@/pages/AdminPrintSettings"));
const AdminCredit = lazy(() => import("@/pages/AdminCredit"));

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  if (isAdminRoute) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/print-labels" element={<AdminPrintLabels />} />
          <Route path="/admin/print-order/:orderId" element={<AdminOrderPrint />} />
          <Route path="/admin/receipt-order/:orderId" element={<AdminOrderReceipt />} />
          <Route path="/admin/print-wholesale-order/:docId" element={<AdminWholesaleOrderPrint />} />
          <Route path="/admin/receipt-wholesale-order/:docId" element={<AdminWholesaleOrderReceipt />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/wholesale/:docId" element={<AdminWholesaleOrderDetail />} />
            <Route path="orders/:orderId" element={<AdminOrderDetail />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="claims" element={<AdminClaims />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="commission" element={<AdminCommission />} />
            <Route path="commission/salesman/:salesmanId" element={<AdminSalesmanDetail />} />
            <Route path="qr-codes" element={<AdminQRCodes />} />
            <Route path="ads" element={<AdminAds />} />
            <Route path="ticker" element={<AdminTicker />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="regions" element={<AdminRegions />} />
            <Route path="whatsapp" element={<AdminWhatsapp />} />
            <Route path="super-config" element={<AdminSuperConfig />} />
            <Route path="team" element={<AdminTeam />} />
            <Route path="pos" element={<AdminPOS />} />
            <Route path="stock" element={<AdminStock />} />
            <Route path="pos-customers" element={<AdminPOSCustomers />} />
            <Route path="pos-sales" element={<AdminPOSSales />} />
            <Route path="pos-returns" element={<AdminPOSReturns />} />
            <Route path="careers" element={<AdminCareers />} />
            <Route path="suppliers" element={<AdminSuppliers />} />
            <Route path="expenses" element={<AdminExpenses />} />
            <Route path="purchases" element={<AdminPurchases />} />
            <Route path="chart-of-accounts" element={<AdminChartOfAccounts />} />
            <Route path="accounts/:id" element={<AdminAccountLedger />} />
            <Route path="journals" element={<AdminJournals />} />
            <Route path="cash-book" element={<AdminCashBook />} />
            <Route path="financial-reports" element={<AdminFinancialReports />} />
            <Route path="print-settings" element={<AdminPrintSettings />} />
            <Route path="credit" element={<AdminCredit />} />
          </Route>
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink-800">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/admin/login" replace />} />
            <Route path="/about" element={<About />} />
            <Route path="/team" element={<Navigate to="/about" replace />} />
            <Route path="/culture" element={<Navigate to="/about" replace />} />
            <Route path="/career" element={<Career />} />
            <Route path="/quality" element={<Navigate to="/" replace />} />
            <Route path="/products" element={<Products />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
            <Route path="*" element={<Navigate to="/admin/login" replace />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
