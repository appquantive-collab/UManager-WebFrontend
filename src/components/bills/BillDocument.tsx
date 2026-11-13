import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { outT } from "../../lib/output-lang";
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
  // Bills always come out in English (see lib/output-lang).
  const t = outT;
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
  // Aadhaar is only ever printed masked. Older bills fall back to the customer record.
  const aadhaarLast4 = buyer.aadhaarLast4 ?? (typeof invoice.customerId === "object" ? invoice.customerId.aadhaarLast4 : undefined);
  const maskedAadhaar = aadhaarLast4 ? `XXXX XXXX ${aadhaarLast4}` : null;
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

  const P = t;
  const payBlock =
    qr || seller.bankAccount ? (
      <div className={format === "thermal" ? "mt-3 text-center" : "flex items-start gap-4"}>
        {qr ? (
          <div className={format === "thermal" ? "flex flex-col items-center" : "text-center"}>
            <img src={qr} alt={P("bill.scanToPay")} className={format === "thermal" ? "h-32 w-32" : "h-28 w-28"} />
            <p className="mt-1 text-[11px] font-semibold">{P("bill.scanToPay")} {formatMoney(balance)}</p>
            <p className="text-[10px]">{seller.upiId}</p>
          </div>
        ) : null}
        {seller.bankAccount ? (
          <div className={format === "thermal" ? "mt-2 text-[11px]" : "text-xs leading-5"}>
            <p className="font-semibold">{P("bill.bankDetails")}</p>
            {seller.bankName ? <p>{seller.bankName}</p> : null}
            <p>
              {P("bill.account")}: {seller.bankAccount}
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
        {maskedAadhaar ? <p>Aadhaar: {maskedAadhaar}</p> : null}
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

  // ---- A4: boxed invoice in the standard Indian GST layout ----
  const L = t;
  const sellerState = stateName(seller.stateCode);
  const supplyCode = buyer.stateCode ?? seller.stateCode;
  const supplyState = stateName(supplyCode);
  const inter = Boolean(invoice.isInterState);
  const cell = "border border-neutral-400 px-1.5 py-1 align-top";
  const head = "border border-neutral-400 bg-neutral-100 px-1.5 py-1 text-[10.5px] font-bold uppercase tracking-wide";
  const sum = (pick: (i: (typeof invoice.items)[number]) => number) => invoice.items.reduce((a, i) => a + pick(i), 0);
  const lineCgst = (i: (typeof invoice.items)[number]) => i.cgst ?? (inter ? 0 : i.lineTax / 2);
  const lineSgst = (i: (typeof invoice.items)[number]) => i.sgst ?? (inter ? 0 : i.lineTax / 2);
  const lineIgst = (i: (typeof invoice.items)[number]) => i.igst ?? (inter ? i.lineTax : 0);

  // HSN-wise tax summary (what a GST return needs).
  const hsnRows = isGst
    ? [
        ...invoice.items
          .reduce((map, i) => {
            const key = (i.hsn || "—") + "|" + i.gstPercent;
            const row = map.get(key) ?? { hsn: i.hsn || "—", rate: i.gstPercent, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
            row.taxable += i.lineSubtotal;
            row.cgst += lineCgst(i);
            row.sgst += lineSgst(i);
            row.igst += lineIgst(i);
            map.set(key, row);
            return map;
          }, new Map<string, { hsn: string; rate: number; taxable: number; cgst: number; sgst: number; igst: number }>())
          .values(),
      ]
    : [];

  const metaRows: [string, string][] = [
    [L("bill.invoiceNo"), invoice.invoiceNumber],
    [L("bill.invoiceDate"), date],
    ...(invoice.dueDate ? ([[L("bill.dueDate"), new Date(invoice.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })]] as [string, string][]) : []),
    ...(isGst && supplyState ? ([[L("bill.placeOfSupply"), `${supplyState} (${supplyCode})`]] as [string, string][]) : []),
    ...(isGst ? ([[L("bill.reverseCharge"), L("bill.no")]] as [string, string][]) : []),
  ];

  return (
    <div className="relative mx-auto w-full max-w-[200mm] bg-white p-4 text-[12px] leading-[1.45] text-black sm:p-6">
      {cancelled ? <CancelledStamp label={L("bill.cancelled")} /> : null}

      <div className="flex items-end justify-between pb-1.5">
        <p className="text-[17px] font-extrabold uppercase tracking-[0.12em]">{isGst ? L("bill.taxInvoice") : L("bill.bill")}</p>
        {isGst ? <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-600">{L("bill.originalForRecipient")}</p> : null}
      </div>

      <div className="border border-neutral-700">
        {/* Seller | invoice details */}
        <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr]">
          <div className="border-b border-neutral-400 p-3 sm:border-b-0 sm:border-r">
            <p className="text-[18px] font-extrabold leading-tight">{seller.name}</p>
            {seller.address ? <p className="mt-0.5 whitespace-pre-line">{seller.address}</p> : null}
            {seller.phone ? (
              <p>
                {L("bill.phoneFull")}: {seller.phone}
              </p>
            ) : null}
            {seller.gstin ? (
              <p className="mt-0.5">
                <span className="font-semibold">GSTIN:</span> <span className="font-semibold tracking-wide">{seller.gstin}</span>
              </p>
            ) : null}
            {sellerState ? (
              <p>
                {L("bill.state")}: {sellerState} ({seller.stateCode})
              </p>
            ) : null}
          </div>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1 p-3">
            {metaRows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-neutral-600">{k}</dt>
                <dd className="text-right font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Buyer */}
        <div className="border-t border-neutral-400 p-3">
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-neutral-600">{L("bill.billTo")}</p>
          <p className="mt-0.5 text-[14px] font-bold">{buyerName}</p>
          {buyer.address ? <p className="whitespace-pre-line">{buyer.address}</p> : null}
          <div className="flex flex-wrap gap-x-5">
            {buyerPhone ? (
              <p>
                {L("bill.phoneFull")}: {buyerPhone}
              </p>
            ) : null}
            {buyer.gstin ? (
              <p>
                <span className="font-semibold">GSTIN:</span> <span className="font-semibold tracking-wide">{buyer.gstin}</span>
              </p>
            ) : isGst ? (
              <p className="text-neutral-600">{L("bill.unregistered")}</p>
            ) : null}
            {maskedAadhaar ? (
              <p>
                <span className="font-semibold">Aadhaar:</span> <span className="tracking-wide">{maskedAadhaar}</span>
              </p>
            ) : null}
            {isGst && stateName(buyer.stateCode) ? (
              <p>
                {L("bill.state")}: {stateName(buyer.stateCode)} ({buyer.stateCode})
              </p>
            ) : null}
          </div>
        </div>

        {/* Items */}
        <div className="overflow-x-auto border-t border-neutral-400">
          <table className="w-full border-collapse text-[11.5px] [&_td]:tabular-nums">
            <thead>
              <tr className="text-left">
                <th className={head + " w-7 border-l-0"}>#</th>
                <th className={head}>{L("bill.itemDescription")}</th>
                {isGst ? <th className={head}>HSN</th> : null}
                <th className={head + " text-right"}>{L("bill.qty")}</th>
                <th className={head + " text-right"}>{L("bill.rate")}</th>
                {hasDiscount ? <th className={head + " text-right"}>{L("bill.disc")}</th> : null}
                {isGst ? <th className={head + " text-right"}>{L("bill.taxable")}</th> : null}
                {isGst && !inter ? <th className={head + " text-right"}>CGST</th> : null}
                {isGst && !inter ? <th className={head + " text-right"}>SGST</th> : null}
                {isGst && inter ? <th className={head + " text-right"}>IGST</th> : null}
                <th className={head + " border-r-0 text-right"}>{L("bill.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i}>
                  <td className={cell + " border-l-0"}>{i + 1}</td>
                  <td className={cell}>
                    <span className="font-semibold">{item.productName}</span>
                    {item.serials?.length ? <span className="block text-[10px] text-neutral-600">IMEI/S.No: {item.serials.join(", ")}</span> : null}
                  </td>
                  {isGst ? <td className={cell}>{item.hsn ?? ""}</td> : null}
                  <td className={cell + " whitespace-nowrap text-right"}>
                    {formatQty(item.quantity)} {item.unit}
                  </td>
                  <td className={cell + " whitespace-nowrap text-right"}>{formatMoney(item.unitPrice)}</td>
                  {hasDiscount ? <td className={cell + " text-right"}>{item.discountPercent ? `${item.discountPercent}%` : "—"}</td> : null}
                  {isGst ? <td className={cell + " whitespace-nowrap text-right"}>{formatMoney(item.lineSubtotal)}</td> : null}
                  {isGst && !inter ? <TaxCell rate={item.gstPercent / 2} amount={lineCgst(item)} className={cell} /> : null}
                  {isGst && !inter ? <TaxCell rate={item.gstPercent / 2} amount={lineSgst(item)} className={cell} /> : null}
                  {isGst && inter ? <TaxCell rate={item.gstPercent} amount={lineIgst(item)} className={cell} /> : null}
                  <td className={cell + " whitespace-nowrap border-r-0 text-right font-semibold"}>{formatMoney(item.lineTotal)}</td>
                </tr>
              ))}
              <tr className="bg-neutral-100 font-bold">
                <td className={cell + " border-l-0"} />
                <td className={cell} colSpan={1 + (isGst ? 1 : 0) + 2 + (hasDiscount ? 1 : 0)}>
                  {L("bill.total")}
                </td>
                {isGst ? <td className={cell + " whitespace-nowrap text-right"}>{formatMoney(invoice.subtotal)}</td> : null}
                {isGst && !inter ? <td className={cell + " whitespace-nowrap text-right"}>{formatMoney(sum(lineCgst))}</td> : null}
                {isGst && !inter ? <td className={cell + " whitespace-nowrap text-right"}>{formatMoney(sum(lineSgst))}</td> : null}
                {isGst && inter ? <td className={cell + " whitespace-nowrap text-right"}>{formatMoney(sum(lineIgst))}</td> : null}
                <td className={cell + " whitespace-nowrap border-r-0 text-right"}>{formatMoney(sum((i) => i.lineTotal))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Words + summary | totals */}
        <div className="grid grid-cols-1 border-t border-neutral-400 sm:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3 border-b border-neutral-400 p-3 sm:border-b-0 sm:border-r">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-neutral-600">{L("bill.amountInWords")}</p>
              <p className="font-semibold">{amountInWords(invoice.totalAmount)}</p>
            </div>
            {hsnRows.length > 0 ? (
              <table className="w-full border-collapse text-[10.5px] [&_td]:tabular-nums">
                <thead>
                  <tr>
                    <th className={head + " text-left"}>HSN</th>
                    <th className={head + " text-right"}>{L("bill.taxable")}</th>
                    {inter ? <th className={head + " text-right"}>IGST</th> : <th className={head + " text-right"}>CGST</th>}
                    {inter ? null : <th className={head + " text-right"}>SGST</th>}
                    <th className={head + " text-right"}>{L("bill.totalTax")}</th>
                  </tr>
                </thead>
                <tbody>
                  {hsnRows.map((r) => (
                    <tr key={r.hsn + r.rate}>
                      <td className={cell}>{r.hsn}</td>
                      <td className={cell + " text-right"}>{formatMoney(r.taxable)}</td>
                      {inter ? (
                        <TaxCell rate={r.rate} amount={r.igst} className={cell} />
                      ) : (
                        <>
                          <TaxCell rate={r.rate / 2} amount={r.cgst} className={cell} />
                          <TaxCell rate={r.rate / 2} amount={r.sgst} className={cell} />
                        </>
                      )}
                      <td className={cell + " text-right font-semibold"}>{formatMoney(r.cgst + r.sgst + r.igst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {payBlock}
          </div>
          <div className="p-3">
            <div className="space-y-1">
              <Row label={isGst ? L("bill.taxableValue") : L("bill.subtotal")} value={formatMoney(invoice.subtotal)} />
              {discount > 0 ? <Row label={L("bill.discountIncluded")} value={`− ${formatMoney(discount)}`} /> : null}
              {taxRows.map((r) => (
                <Row key={r.label} label={r.label} value={formatMoney(r.value)} />
              ))}
              {roundOff !== 0 ? <Row label={L("bill.roundOff")} value={`${roundOff > 0 ? "+" : "−"} ${formatMoney(Math.abs(roundOff))}`} /> : null}
            </div>
            <div className="-mx-3 mt-2 flex justify-between gap-3 border-y border-neutral-700 bg-neutral-100 px-3 py-2 text-[14px] font-extrabold tabular-nums">
              <span>{L("bill.grandTotal")}</span>
              <span>{formatMoney(invoice.totalAmount)}</span>
            </div>
            {invoice.amountPaid > 0 || balance > 0 ? (
              <div className="mt-2 space-y-1">
                {invoice.amountPaid > 0 ? <Row label={L("bill.paid")} value={formatMoney(invoice.amountPaid)} /> : null}
                <Row label={L("bill.balance")} value={formatMoney(balance)} strong={balance > 0} />
              </div>
            ) : null}
          </div>
        </div>

        {/* Terms & declaration | signature */}
        <div className="grid grid-cols-1 border-t border-neutral-400 sm:grid-cols-[1.4fr_1fr]">
          <div className="space-y-2 border-b border-neutral-400 p-3 text-[10.5px] sm:border-b-0 sm:border-r">
            {seller.terms ? (
              <div>
                <p className="font-bold uppercase tracking-wide text-neutral-600">{L("bill.terms")}</p>
                <p className="whitespace-pre-line">{seller.terms}</p>
              </div>
            ) : null}
            {isGst ? (
              <div>
                <p className="font-bold uppercase tracking-wide text-neutral-600">{L("bill.declarationTitle")}</p>
                <p>{L("bill.declaration")}</p>
              </div>
            ) : (
              <p>{L("bill.thankYou")}</p>
            )}
          </div>
          <div className="flex flex-col justify-between p-3 text-right text-[11px]">
            <p className="font-semibold">{L("bill.forSeller", { name: seller.name ?? "" })}</p>
            <div className="h-12" />
            <p className="border-t border-neutral-500 pt-1">{L("bill.authorisedSignatory")}</p>
          </div>
        </div>
      </div>

      <p className="mt-1.5 text-center text-[9.5px] text-neutral-500">{L("bill.computerGenerated")}</p>
    </div>
  );
}

/** "9%" over "₹90.00" — rate and amount in one tax column. */
function TaxCell({ rate, amount, className }: { rate: number; amount: number; className: string }) {
  return (
    <td className={className + " whitespace-nowrap text-right"}>
      <span className="block text-[10px] text-neutral-600">{`${Number(rate.toFixed(2))}%`}</span>
      {formatMoney(amount)}
    </td>
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
