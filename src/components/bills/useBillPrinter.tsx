import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { getProfile } from "../../lib/auth-api";
import type { Invoice, SellerSnapshot } from "../../lib/invoices-api";
import { BillDocument, type BillFormat } from "./BillDocument";

/** Who the bill is from: the details saved on the bill, else today's business settings (older bills). */
export function useBillSeller(invoice: Invoice | null): SellerSnapshot {
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: getProfile, staleTime: 60_000 });
  const tenant = profile?.tenant;
  if (invoice?.seller?.name) return invoice.seller;
  return {
    name: tenant?.businessName,
    phone: tenant?.phone,
    gstin: tenant?.gstin,
    address: tenant?.address,
    stateCode: tenant?.stateCode,
    upiId: tenant?.upiId,
    bankName: tenant?.bankName,
    bankAccount: tenant?.bankAccount,
    bankIfsc: tenant?.bankIfsc,
    terms: tenant?.invoiceTerms,
  };
}

interface PrintJob {
  invoice: Invoice;
  seller: SellerSnapshot;
  format: BillFormat;
}

/**
 * Prints one bill: renders it outside the app (everything else is hidden for
 * print), sets the paper size, waits for the UPI QR, then opens the print
 * dialog — where "Save as PDF" gives a PDF to send.
 */
export function useBillPrinter() {
  const [job, setJob] = useState<PrintJob | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!job || !ready) return;
    const style = document.createElement("style");
    style.textContent =
      job.format === "thermal" ? "@page { size: 80mm auto; margin: 2mm; }" : "@page { size: A4; margin: 10mm; }";
    document.head.appendChild(style);
    document.body.classList.add("printing-bill");
    const finish = () => {
      setJob(null);
      setReady(false);
    };
    window.addEventListener("afterprint", finish, { once: true });
    const timer = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", finish);
      style.remove();
      document.body.classList.remove("printing-bill");
    };
  }, [job, ready]);

  const print = useCallback((invoice: Invoice, seller: SellerSnapshot, format: BillFormat) => {
    setReady(false);
    setJob({ invoice, seller, format });
  }, []);

  const portal = job
    ? createPortal(
        <div className="bill-print-root" aria-hidden="true">
          <BillDocument invoice={job.invoice} seller={job.seller} format={job.format} onReady={() => setReady(true)} />
        </div>,
        document.body
      )
    : null;

  return { print, portal, printing: Boolean(job) };
}
