// Static mock data for laying out page designs before backend wiring.
// Replace with real API calls (React Query) once each module is implemented.

export const mockPurchaseOrders = [
  { id: "PO-341", supplier: "Coca-Cola Distributors", items: 12, amount: 96000, status: "Pending Receipt", date: "16 Sep 2026" },
  { id: "PO-340", supplier: "Unilever Wholesale", items: 8, amount: 54200, status: "Received", date: "14 Sep 2026" },
  { id: "PO-339", supplier: "ITC Distribution", items: 5, amount: 31200, status: "Received", date: "12 Sep 2026" },
];

export const mockReports = {
  sales: { today: 482500, week: 2840000, month: 1840000 },
  inventoryValue: 1820000,
  grossProfit: 412000,
};

