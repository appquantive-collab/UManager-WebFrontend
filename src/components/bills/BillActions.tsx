import { MessageCircle, Printer, ReceiptText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Invoice } from "../../lib/invoices-api";
import { billCustomerPhone, billWhatsappText } from "../../lib/bill-share";
import { indianMobile, whatsappLink } from "../../lib/phone";
import { useBillPrinter, useBillSeller } from "./useBillPrinter";

/** Print (A4 / PDF), small receipt (thermal) and WhatsApp — the three ways a bill leaves the shop. */
export function BillActions({ invoice, compact = false }: { invoice: Invoice; compact?: boolean }) {
  const { t } = useTranslation();
  const seller = useBillSeller(invoice);
  const { print, portal, printing } = useBillPrinter();

  const shareOnWhatsapp = () => {
    const text = billWhatsappText(invoice, seller, {
      bill: t("bill.bill"),
      total: t("bill.total"),
      paid: t("bill.paid"),
      balance: t("bill.balance"),
      payByUpi: t("bill.payByUpi"),
      thanks: t("bill.thankYou"),
    });
    const mobile = indianMobile(billCustomerPhone(invoice));
    const url = mobile ? whatsappLink(mobile, text) : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  };

  const button =
    "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-text outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50";

  return (
    <>
      <div className={compact ? "flex gap-2" : "grid grid-cols-3 gap-2"}>
        <button type="button" className={button} disabled={printing} onClick={() => print(invoice, seller, "a4")}>
          <Printer size={16} className="text-icon" aria-hidden="true" />
          {t("bill.printPdf")}
        </button>
        <button type="button" className={button} disabled={printing} onClick={() => print(invoice, seller, "thermal")}>
          <ReceiptText size={16} className="text-icon" aria-hidden="true" />
          {t("bill.smallReceipt")}
        </button>
        <button type="button" className={button} onClick={shareOnWhatsapp}>
          <MessageCircle size={16} className="text-icon" aria-hidden="true" />
          {t("bill.whatsapp")}
        </button>
      </div>
      {portal}
    </>
  );
}
