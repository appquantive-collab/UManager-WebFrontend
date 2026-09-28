// Static mock data for laying out page designs before backend wiring.
// Replace with real API calls (React Query) once each module is implemented.

export const mockPurchaseOrders = [
  { id: "PO-341", supplier: "Coca-Cola Distributors", items: 12, amount: 96000, status: "Pending Receipt", date: "16 Sep 2026" },
  { id: "PO-340", supplier: "Unilever Wholesale", items: 8, amount: 54200, status: "Received", date: "14 Sep 2026" },
  { id: "PO-339", supplier: "ITC Distribution", items: 5, amount: 31200, status: "Received", date: "12 Sep 2026" },
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

