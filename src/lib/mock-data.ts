// Static mock data for laying out page designs before backend wiring.
// Replace with real API calls (React Query) once each module is implemented.

export const mockPurchaseOrders = [
  { id: "PO-341", supplier: "Coca-Cola Distributors", items: 12, amount: 96000, status: "Pending Receipt", date: "16 Sep 2026" },
  { id: "PO-340", supplier: "Unilever Wholesale", items: 8, amount: 54200, status: "Received", date: "14 Sep 2026" },
  { id: "PO-339", supplier: "ITC Distribution", items: 5, amount: 31200, status: "Received", date: "12 Sep 2026" },
];

export const mockCustomers = [
  { id: "CUST-001", name: "Sharma Traders", phone: "+91 98765 43210", totalPurchases: 842000, outstanding: 124000, creditLimit: 200000, lastPurchase: "16 Sep 2026" },
  { id: "CUST-002", name: "ABC Traders", phone: "+91 98765 11111", totalPurchases: 512000, outstanding: 0, creditLimit: 150000, lastPurchase: "16 Sep 2026" },
  { id: "CUST-003", name: "Gupta Store", phone: "+91 98765 22222", totalPurchases: 318000, outstanding: 41800, creditLimit: 100000, lastPurchase: "15 Sep 2026" },
  { id: "CUST-004", name: "XYZ Traders", phone: "+91 98765 33333", totalPurchases: 96000, outstanding: 3200, creditLimit: 50000, lastPurchase: "15 Sep 2026" },
];

export const mockSuppliers = [
  { id: "SUP-001", name: "Coca-Cola Distributors", phone: "+91 90000 11111", totalPurchased: 1240000, outstanding: 96000, lastOrder: "16 Sep 2026" },
  { id: "SUP-002", name: "Unilever Wholesale", phone: "+91 90000 22222", totalPurchased: 842000, outstanding: 0, lastOrder: "14 Sep 2026" },
  { id: "SUP-003", name: "ITC Distribution", phone: "+91 90000 33333", totalPurchased: 512000, outstanding: 0, lastOrder: "12 Sep 2026" },
];

export const mockWarehouses = [
  { id: "WH-001", name: "Main Warehouse", location: "Sector 58, Noida", stockValue: 1240000, products: 421, staff: 6 },
  { id: "WH-002", name: "Noida Warehouse", location: "Sector 63, Noida", stockValue: 482000, products: 186, staff: 3 },
  { id: "WH-003", name: "Retail Store", location: "Connaught Place, Delhi", stockValue: 96000, products: 74, staff: 2 },
];

export const mockStaff = [
  { id: "USR-001", name: "Rahul Sharma", email: "rahul@sharmatraders.test", role: "OWNER", status: "Active" },
  { id: "USR-002", name: "Priya Singh", email: "priya@sharmatraders.test", role: "MANAGER", status: "Active" },
  { id: "USR-003", name: "Amit Kumar", email: "amit@sharmatraders.test", role: "SALESMAN", status: "Active" },
  { id: "USR-004", name: "Suresh Yadav", email: "suresh@sharmatraders.test", role: "WAREHOUSE_STAFF", status: "Invited" },
  { id: "USR-005", name: "Vikram Rao", email: "vikram@sharmatraders.test", role: "SALESMAN", status: "Suspended" },
];

export const mockAiInsights = [
  { type: "Low Stock Prediction", detail: "Product A may run out in 4 days.", severity: "warning" as const },
  { type: "Dead Stock", detail: "Product B has remained unsold for 73 days.", severity: "info" as const },
  { type: "Payment Risk", detail: "₹42,500 has been overdue for 12 days.", severity: "danger" as const },
  { type: "Customer Behavior", detail: "ABC Traders usually orders every 12 days. Current gap: 21 days.", severity: "info" as const },
];

export const mockAiConversation = [
  { role: "user" as const, text: "Aaj kitni sale hui?" },
  { role: "assistant" as const, text: "Aaj ki total sale ₹4,82,500 hai, 12 orders ke saath." },
  { role: "user" as const, text: "Kaunse customers ka payment pending hai?" },
  { role: "assistant" as const, text: "3 customers ka payment pending hai: Sharma Traders (₹1,24,000), Gupta Store (₹41,800), XYZ Traders (₹3,200)." },
];

export const mockReports = {
  sales: { today: 482500, week: 2840000, month: 1840000 },
  inventoryValue: 1820000,
  grossProfit: 412000,
};

