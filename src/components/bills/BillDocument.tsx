import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useTranslation } from "react-i18next";
import type { Invoice, SellerSnapshot } from "../../lib/invoices-api";
import { amountInWords, billBalance, billCustomerName, billCustomerPhone, upiPayLink } from "../../lib/bill-share";
import { formatMoney, formatQty } from "../../lib/format";
import { stateName } from "../../lib/gst-states";

export type BillFormat = "a4" | "thermal";

/** The bill as it prints. Plain black-on-white so it reads the same on paper, PDF and screen. */
export function BillDocument({
  invoice,
  seller,
  format,
  onReady,
}: {
  invoice: Invoice;
  seller: SellerSnapshot;
  format: BillFormat;
  /** Called once the UPI QR (if any) is drawn, so printing never catches a blank square. */
  onReady?: () => void;
}) {
  const { t } = useTranslation();
  const balance = billBalance(invoice);
  const cancelled = invoice.status === "cancelled";
  const isGst = invoice.billType === "gst";
  const wantsQr = Boolean(seller.upiId) && balance > 0 && !cancelled;
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!wantsQr) {
      setQr(null);
      onReady?.();
      return;
    }
    QRCode.toDataURL(upiPayLink(seller.upiId!, seller.name ?? "", balance, invoice.invoiceNumber), { margin: 1, width: 220 })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null))
      .finally(() => alive && onReady?.());
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsQr, seller.upiId, seller.name, balance, invoice.invoiceNumber]);

  const buyerName = billCustomerName(invoice) || t("bill.walkIn");
  const buyerPhone = billCustomerPhone(invoice);
  const buyer = invoice.buyer ?? {};
  const date = new Date(invoice.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const title = isGst ? t("bill.taxInvoice") : t("bill.bill");
  const discount = invoice.discountTotal ?? 0;
  const roundOff = invoice.roundOff ?? 0;
  const hasDiscount = invoice.items.some((i) => (i.discountPercent ?? 0) > 0);

  const taxRows = isGst
    ? invoice.isInterState
      ? [{ label: t("bill.igst"), value: invoice.igstTotal ?? invoice.taxTotal }]
      : [
          { label: t("bill.cgst"), value: invoice.cgstTotal ?? invoice.taxTotal / 2 },
          { label: t("bill.sgst"), value: invoice.sgstTotal ?? invoice.taxTotal / 2 },
        ]
    : [];

  const totals = (
    <>
      <Row label={isGst ? t("bill.taxableValue") : t("bill.subtotal")} value={formatMoney(invoice.subtotal)} />
      {discount > 0 ? <Row label={t("bill.discountIncluded")} value={`− ${formatMoney(discount)}`} /> : null}
      {taxRows.map((r) => (
        <Row key={r.label} label={r.label} value={formatMoney(r.value)} />
      ))}
      {roundOff !== 0 ? <Row label={t("bill.roundOff")} value={`${roundOff > 0 ? "+" : "−"} ${formatMoney(Math.abs(roundOff))}`} /> : null}
      <Row label={t("bill.total")} value={formatMoney(invoice.totalAmount)} strong />
      {invoice.amountPaid > 0 ? <Row label={t("bill.paid")} value={formatMoney(invoice.amountPaid)} /> : null}
      {invoice.amountPaid > 0 || balance > 0 ? <Row label={t("bill.balance")} value={formatMoney(balance)} strong={balance > 0} /> : null}
    </>
  );

  const payBlock =
    qr || seller.bankAccount ? (
      <div className={format === "thermal" ? "mt-3 text-center" : "flex items-start gap-4"}>
        {qr ? (
          <div className={format === "thermal" ? "flex flex-col items-center" : "text-center"}>
            <img src={qr} alt={t("bill.scanToPay")} className={format === "thermal" ? "h-32 w-32" : "h-28 w-28"} />
            <p className="mt-1 text-[11px] font-semibold">{t("bill.scanToPay")} {formatMoney(balance)}</p>
            <p className="text-[10px]">{seller.upiId}</p>
          </div>
        ) : null}
        {seller.bankAccount ? (
          <div className={format === "thermal" ? "mt-2 text-[11px]" : "text-xs leading-5"}>
            <p className="font-semibold">{t("bill.bankDetails")}</p>
            {seller.bankName ? <p>{seller.bankName}</p> : null}
            <p>
              {t("bill.account")}: {seller.bankAccount}
            </p>
            {seller.bankIfsc ? <p>IFSC: {seller.bankIfsc}</p> : null}
          </div>
        ) : null}
      </div>
    ) : null;

  if (format === "thermal") {
    return (
      <div className="relative mx-auto w-[72mm] bg-white p-1 font-mono text-[12px] leading-[1.35] text-black">
        {cancelled ? <CancelledStamp label={t("bill.cancelled")} /> : null}
        <div className="text-center">
          <p className="text-[15px] font-bold">{seller.name}</p>
          {seller.address ? <p className="whitespace-pre-line">{seller.address}</p> : null}
          {seller.phone ? <p>{t("bill.phone")}: {seller.phone}</p> : null}
          {seller.gstin ? <p>GSTIN: {seller.gstin}</p> : null}
          <p className="mt-1 font-bold">{title}</p>
        </div>
        <Dashed />
        <p>
          {invoice.invoiceNumber} · {date}
        </p>
        <p>
          {t("bill.to")}: {buyerName}
          {buyerPhone ? ` · ${buyerPhone}` : ""}
        </p>
        {buyer.gstin ? <p>GSTIN: {buyer.gstin}</p> : null}
        <Dashed />
        {invoice.items.map((item, i) => (
          <div key={i} className="mb-1">
            <p className="font-semibold">{item.productName}</p>
            <div className="flex justify-between">
              <span>
                {formatQty(item.quantity)} {item.unit} × {formatMoney(item.unitPrice)}
                {(item.discountPercent ?? 0) > 0 ? ` −${item.discountPercent}%` : ""}
                {isGst && item.gstPercent > 0 ? ` +${item.gstPercent}%` : ""}
              </span>
              <span>{formatMoney(item.lineTotal)}</span>
            </div>
          </div>
        ))}
        <Dashed />
        <div className="space-y-0.5">{totals}</div>
        <Dashed />
        <p className="text-[10px]">{amountInWords(invoice.totalAmount)}</p>
        {payBlock}
        {seller.terms ? <p className="mt-2 whitespace-pre-line text-center text-[10px]">{seller.terms}</p> : null}
        <p className="mt-2 text-center">{t("bill.thankYou")}</p>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-[200mm] bg-white p-6 text-[13px] leading-5 text-black sm:p-8">
      {cancelled ? <CancelledStamp label={t("bill.cancelled")} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-black pb-3">
        <div className="min-w-0">
          <p className="text-xl font-bold">{seller.name}</p>
          {seller.address ? <p className="whitespace-pre-line">{seller.address}</p> : null}
          <p>
            {seller.phone ? `${t("bill.phone")}: ${seller.phone}` : ""}
            {seller.phone && seller.gstin ? " · " : ""}
            {seller.gstin ? `GSTIN: ${seller.gstin}` : ""}
          </p>
          {stateName(seller.stateCode) ? (
            <p>
              {t("bill.state")}: {stateName(seller.stateCode)} ({seller.stateCode})
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold uppercase tracking-wide">{title}</p>
          <p>
            {t("bill.number")}: <span className="font-semibold">{invoice.invoiceNumber}</span>
          </p>
          <p>
            {t("bill.date")}: {date}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">{t("bill.billTo")}</p>
          <p className="font-semibold">{buyerName}</p>
          {buyer.address ? <p className="whitespace-pre-line">{buyer.address}</p> : null}
          {buyerPhone ? (
            <p>
              {t("bill.phone")}: {buyerPhone}
            </p>
          ) : null}
          {buyer.gstin ? <p>GSTIN: {buyer.gstin}</p> : null}
        </div>
        {isGst && stateName(buyer.stateCode ?? seller.stateCode) ? (
          <div className="sm:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">{t("bill.placeOfSupply")}</p>
            <p>
              {stateName(buyer.stateCode ?? seller.stateCode)} ({buyer.stateCode ?? seller.stateCode})
            </p>
          </div>
        ) : null}
      </div>

      <table className="mt-4 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-black text-left">
            <th className="py-1.5 pr-2 font-semibold">#</th>
            <th className="py-1.5 pr-2 font-semibold">{t("bill.item")}</th>
            {isGst ? <th className="py-1.5 pr-2 font-semibold">HSN</th> : null}
            <th className="py-1.5 pr-2 text-right font-semibold">{t("bill.qty")}</th>
            <th className="py-1.5 pr-2 text-right font-semibold">{t("bill.rate")}</th>
            {hasDiscount ? <th className="py-1.5 pr-2 text-right font-semibold">{t("bill.disc")}</th> : null}
            {isGst ? <th className="py-1.5 pr-2 text-right font-semibold">{t("bill.taxable")}</th> : null}
            {isGst ? <th className="py-1.5 pr-2 text-right font-semibold">GST</th> : null}
            <th className="py-1.5 text-right font-semibold">{t("bill.amount")}</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => (
            <tr key={i} className="border-b border-neutral-300 align-top">
              <td className="py-1.5 pr-2">{i + 1}</td>
              <td className="py-1.5 pr-2">{item.productName}</td>
              {isGst ? <td className="py-1.5 pr-2">{item.hsn ?? ""}</td> : null}
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {formatQty(item.quantity)} {item.unit}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
              {hasDiscount ? <td className="py-1.5 pr-2 text-right tabular-nums">{item.discountPercent ? `${item.discountPercent}%` : ""}</td> : null}
              {isGst ? <td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(item.lineSubtotal)}</td> : null}
              {isGst ? <td className="py-1.5 pr-2 text-right tabular-nums">{item.gstPercent}%</td> : null}
              <td className="py-1.5 text-right tabular-nums">{formatMoney(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex flex-wrap justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-[12px]">
            <span className="font-semibold">{t("bill.inWords")}:</span> {amountInWords(invoice.totalAmount)}
          </p>
          {payBlock}
        </div>
        <div className="w-full space-y-1 sm:w-64">{totals}</div>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-neutral-300 pt-3">
        <div className="max-w-md text-[11px] text-neutral-700">
          {seller.terms ? (
            <>
              <p className="font-semibold text-black">{t("bill.terms")}</p>
              <p className="whitespace-pre-line">{seller.terms}</p>
            </>
          ) : (
            <p>{t("bill.thankYou")}</p>
          )}
        </div>
        <div className="text-center text-[11px]">
          <div className="h-10" />
          <p className="border-t border-black px-6 pt-1">
            {t("bill.forSeller", { name: seller.name ?? "" })}
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 tabular-nums ${strong ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Dashed() {
  return <div className="my-1.5 border-t border-dashed border-black" />;
}

function CancelledStamp({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="-rotate-12 rounded border-4 border-red-600 px-4 py-1 text-3xl font-black uppercase tracking-widest text-red-600 opacity-60">
        {label}
      </span>
    </div>
  );
}
