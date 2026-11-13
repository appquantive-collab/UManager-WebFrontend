import { MessageCircle, Printer, ReceiptText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Invoice } from "../../lib/invoices-api";
import { billCustomerPhone, billWhatsappText } from "../../lib/bill-share";
import { outT } from "../../lib/output-lang";
import { indianMobile, whatsappLink } from "../../lib/phone";
import { useBillPrinter, useBillSeller } from "./useBillPrinter";

/** Print (A4 / PDF), small receipt (thermal) and WhatsApp — the three ways a bill leaves the shop. */
export function BillActions({ invoice, compact = false }: { invoice: Invoice; compact?: boolean }) {
  const { t } = useTranslation();
  const seller = useBillSeller(invoice);
  const { print, portal, printing } = useBillPrinter();

  const shareOnWhatsapp = () => {
    // The bill itself is always in English, like the printed copy.
    const text = billWhatsappText(invoice, seller, {
      bill: outT("bill.bill"),
      total: outT("bill.total"),
      paid: outT("bill.paid"),
      balance: outT("bill.balance"),
      payByUpi: outT("bill.payByUpi"),
      thanks: outT("bill.thankYou"),
    });
    const mobile = indianMobile(billCustomerPhone(invoice));
    const url = mobile ? whatsappLink(mobile, text) : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  };

  const button = compact
    ? "inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-text outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
    : "flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-surface px-2 py-2 text-xs font-semibold text-text outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50";
  const label = "max-w-full truncate";

  return (
    <>
      <div className={compact ? "flex gap-2" : "grid grid-cols-3 gap-2"}>
        <button type="button" className={button} disabled={printing} onClick={() => print(invoice, seller, "a4")}>
          <Printer size={18} className="text-icon" aria-hidden="true" />
          <span className={label}>{t("bill.printPdf")}</span>
        </button>
        <button type="button" className={button} disabled={printing} onClick={() => print(invoice, seller, "thermal")}>
          <ReceiptText size={18} className="text-icon" aria-hidden="true" />
          <span className={label}>{t("bill.smallReceipt")}</span>
        </button>
        <button type="button" className={button} onClick={shareOnWhatsapp}>
          <MessageCircle size={18} className="text-icon" aria-hidden="true" />
          <span className={label}>{t("bill.whatsapp")}</span>
        </button>
      </div>
      {portal}
    </>
  );
}
