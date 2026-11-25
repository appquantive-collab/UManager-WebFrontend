import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Download, MessageCircle, ReceiptText, Search, Send, Share2, Wallet, X } from "lucide-react";
import clsx from "clsx";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { formatCurrency } from "../../lib/format";
import { ApiError } from "../../lib/api";
import { indianMobile, whatsappLink } from "../../lib/phone";
import { listInvoices, isCancelled, type Invoice } from "../../lib/invoices-api";
import { listCatalogues } from "../../lib/catalogues-api";
import { listChatContacts, startChat, type BillCardData, type ChatCardType, type ChatContact, type Conversation } from "../../lib/chat-api";
import { chatKeys } from "../../lib/chat-cache";
import { ChatAvatar } from "./ConversationList";

/** Pick a customer / supplier who is on VoiceMunshi, or type a number. Others can be invited. */
export function NewChatDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const contacts = useQuery({ queryKey: chatKeys.contacts, queryFn: listChatContacts, enabled: open, staleTime: 60_000 });

  const start = useMutation({
    mutationFn: startChat,
    onSuccess: (conv: Conversation) => {
      qc.setQueryData(chatKeys.one(conv._id), conv);
      void qc.invalidateQueries({ queryKey: chatKeys.list });
      onClose();
      navigate(`/app/chats/${conv._id}`);
    },
    onError: (err) => setError(err instanceof ApiError && err.code === "NOT_ON_PLATFORM" ? t("chat.new.notOnPlatform") : err instanceof ApiError && err.code === "BAD_PHONE" ? t("chat.new.badPhone") : t("chat.new.failed")),
  });

  const q = query.trim().toLowerCase();
  const rows = (contacts.data ?? []).filter((c) => !q || `${c.name} ${c.phone} ${c.shop?.businessName ?? ""}`.toLowerCase().includes(q));
  const onPlatform = rows.filter((c) => c.shop);
  const others = rows.filter((c) => !c.shop);

  const invite = (c: ChatContact) => {
    const mobile = indianMobile(c.phone);
    if (!mobile) return;
    window.open(whatsappLink(mobile, t("chat.new.inviteText", { link: window.location.origin })), "_blank", "noopener");
  };

  const open1 = (c: ChatContact) => {
    setError(null);
    if (c.conversationId) {
      onClose();
      navigate(`/app/chats/${c.conversationId}`);
    } else start.mutate({ contactKind: c.kind, contactId: c.id });
  };

  return (
    <Dialog open={open} onClose={onClose} title={t("chat.new.title")}>
      <div className="space-y-4">
        <p className="text-sm text-text-muted">{t("chat.new.help")}</p>
        {error ? (
          <p role="alert" className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white">
            {error}
          </p>
        ) : null}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (phone.replace(/\D/g, "").length < 10) return setError(t("chat.new.badPhone"));
            start.mutate({ phone });
          }}
        >
          <label className="sr-only" htmlFor="chat-phone">
            {t("chat.new.byNumber")}
          </label>
          <input
            id="chat-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("chat.new.byNumber")}
            className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
          />
          <Button type="submit" isLoading={start.isPending && "phone" in (start.variables ?? {})}>
            {t("chat.new.start")}
          </Button>
        </form>

        <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 focus-within:border-primary">
          <Search size={16} className="text-icon" aria-hidden="true" />
          <span className="sr-only">{t("chat.new.search")}</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("chat.new.search")} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted" />
        </label>

        {contacts.isLoading ? <p className="py-6 text-center text-sm text-text-muted">{t("chat.loading")}</p> : null}

        {onPlatform.length > 0 ? (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">{t("chat.new.onPlatform", { count: onPlatform.length })}</h3>
            <ul className="divide-y divide-border">
              {onPlatform.map((c) => (
                <li key={`${c.kind}-${c.id}`}>
                  <button type="button" onClick={() => open1(c)} disabled={start.isPending} className="flex w-full items-center gap-3 py-2.5 text-left outline-none hover:bg-surface-muted focus-visible:bg-surface-muted">
                    <ChatAvatar name={c.name} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text">{c.name}</span>
                      <span className="block truncate text-xs text-text-muted">
                        {t(`chat.kindTag.${c.kind}`)} · {c.shop!.businessName}
                      </span>
                    </span>
                    <MessageCircle size={20} className="shrink-0 text-primary" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!contacts.isLoading && onPlatform.length === 0 ? (
          <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-text-muted">{t("chat.new.noneOnPlatform")}</p>
        ) : null}

        {others.length > 0 ? (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">{t("chat.new.invite")}</h3>
            <ul className="divide-y divide-border">
              {others.slice(0, 80).map((c) => (
                <li key={`${c.kind}-${c.id}`} className="flex items-center gap-3 py-2.5">
                  <ChatAvatar name={c.name} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">{c.name}</span>
                    <span className="block truncate text-xs text-text-muted">
                      {t(`chat.kindTag.${c.kind}`)} · {c.phone}
                    </span>
                  </span>
                  {indianMobile(c.phone) ? (
                    <button type="button" onClick={() => invite(c)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-text hover:bg-surface-muted">
                      <Share2 size={14} aria-hidden="true" />
                      {t("chat.new.inviteButton")}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}

/** Send a bill, a catalogue or a payment reminder as a card. */
export function ShareCardDialog({
  type,
  contact,
  onClose,
  onSend,
}: {
  type: ChatCardType | null;
  contact: Conversation["other"];
  onClose: () => void;
  onSend: (card: { type: ChatCardType; refId?: string }) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const bills = useQuery({ queryKey: ["invoices"], queryFn: listInvoices, enabled: type === "bill" });
  const catalogues = useQuery({ queryKey: ["catalogues"], queryFn: listCatalogues, enabled: type === "catalogue" });

  const billRows = useMemo(() => {
    const all = (bills.data ?? []).filter((b) => !isCancelled(b));
    // This shop's own bills first when it's saved as my customer.
    const theirs = contact.kind === "customer" && contact.contactId ? all.filter((b) => (typeof b.customerId === "string" ? b.customerId : b.customerId._id) === contact.contactId) : [];
    const list = theirs.length ? theirs : all;
    const q = query.trim().toLowerCase();
    return list
      .filter((b) => !q || `${b.invoiceNumber} ${typeof b.customerId === "string" ? "" : b.customerId.name}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 60);
  }, [bills.data, contact, query]);

  if (!type) return null;
  const title = t(`chat.share.${type}Title`);
  const due = (b: Invoice) => Math.max(0, b.totalAmount - b.amountPaid);

  return (
    <Dialog open onClose={onClose} title={title}>
      {type === "dues" ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-primary-container/50 p-4">
            <Wallet size={22} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-text">{t(contact.kind === "supplier" ? "chat.share.duesHelpSupplier" : "chat.share.duesHelp")}</p>
          </div>
          {!contact.kind ? <p className="rounded-lg bg-danger px-3 py-2 text-sm font-semibold text-white">{t("chat.share.notAContact")}</p> : null}
          <Button className="w-full" disabled={!contact.kind} onClick={() => onSend({ type: "dues" })}>
            <Send size={16} aria-hidden="true" />
            {t("chat.share.sendDues")}
          </Button>
        </div>
      ) : type === "bill" ? (
        <div className="space-y-3">
          <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 focus-within:border-primary">
            <Search size={16} className="text-icon" aria-hidden="true" />
            <span className="sr-only">{t("chat.share.searchBills")}</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("chat.share.searchBills")} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted" />
          </label>
          {bills.isLoading ? <p className="py-6 text-center text-sm text-text-muted">{t("chat.loading")}</p> : null}
          {!bills.isLoading && billRows.length === 0 ? <p className="py-6 text-center text-sm text-text-muted">{t("chat.share.noBills")}</p> : null}
          <ul className="divide-y divide-border">
            {billRows.map((b) => (
              <li key={b._id}>
                <button type="button" onClick={() => onSend({ type: "bill", refId: b._id })} className="flex w-full items-center gap-3 py-2.5 text-left outline-none hover:bg-surface-muted focus-visible:bg-surface-muted">
                  <ReceiptText size={20} className="shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">
                      {b.invoiceNumber} · {typeof b.customerId === "string" ? "" : b.customerId.name}
                    </span>
                    <span className="block text-xs text-text-muted">{new Date(b.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-bold tabular-nums text-text">{formatCurrency(b.totalAmount)}</span>
                    {due(b) > 0 ? <span className="block text-xs font-semibold text-warning">{t("chat.card.due", { amount: formatCurrency(due(b)) })}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-3">
          {catalogues.isLoading ? <p className="py-6 text-center text-sm text-text-muted">{t("chat.loading")}</p> : null}
          {!catalogues.isLoading && (catalogues.data ?? []).length === 0 ? <p className="py-6 text-center text-sm text-text-muted">{t("chat.share.noCatalogues")}</p> : null}
          <ul className="divide-y divide-border">
            {(catalogues.data ?? []).map((c) => (
              <li key={c._id}>
                <button type="button" onClick={() => onSend({ type: "catalogue", refId: c._id })} className="flex w-full items-center gap-3 py-2.5 text-left outline-none hover:bg-surface-muted focus-visible:bg-surface-muted">
                  <BookOpen size={20} className="shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text">{c.title}</span>
                    <span className="block text-xs text-text-muted">{t("chat.share.catalogueItems", { count: c.productCount ?? c.productIds.length })}</span>
                  </span>
                  <Send size={16} className="shrink-0 text-primary" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}

/** The full bill from a bill card. */
export function BillCardDialog({ data, onClose }: { data: BillCardData | null; onClose: () => void }) {
  const { t } = useTranslation();
  if (!data) return null;
  return (
    <Dialog open onClose={onClose} title={t("chat.card.bill", { number: data.invoiceNumber })}>
      <p className="text-sm text-text-muted">
        {data.payee} · {new Date(data.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
      </p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
            <th className="py-2 font-semibold">{t("chat.bill.item")}</th>
            <th className="py-2 text-right font-semibold">{t("chat.bill.qty")}</th>
            <th className="py-2 text-right font-semibold">{t("chat.bill.amount")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.items.map((item, i) => (
            <tr key={i}>
              <td className="py-2 pr-2 text-text">
                {item.name}
                <span className="block text-xs text-text-muted">@ {formatCurrency(item.price)}</span>
              </td>
              <td className="py-2 text-right tabular-nums text-text">
                {item.qty} {item.unit}
              </td>
              <td className="py-2 text-right font-semibold tabular-nums text-text">{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.moreItems ? <p className="mt-1 text-xs text-text-muted">{t("chat.card.moreItems", { count: data.moreItems })}</p> : null}
      <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
        {data.tax ? (
          <div className="flex justify-between text-text-muted">
            <dt>{t("chat.bill.tax")}</dt>
            <dd className="tabular-nums">{formatCurrency(data.tax)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between text-base font-bold text-text">
          <dt>{t("chat.card.total")}</dt>
          <dd className="tabular-nums">{formatCurrency(data.total)}</dd>
        </div>
        <div className="flex justify-between text-text-muted">
          <dt>{t("chat.bill.paid")}</dt>
          <dd className="tabular-nums">{formatCurrency(data.paid)}</dd>
        </div>
        {data.due > 0 ? (
          <div className="flex justify-between font-semibold text-warning">
            <dt>{t("chat.bill.due")}</dt>
            <dd className="tabular-nums">{formatCurrency(data.due)}</dd>
          </div>
        ) : null}
      </dl>
    </Dialog>
  );
}

/** Full-screen photo with download. */
export function ImageViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  if (!url) return null;
  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={t("chat.kind.image")} onClick={onClose}>
      <div className="flex shrink-0 justify-end gap-2 p-3">
        <a href={url} download target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} aria-label={t("chat.download")} className="rounded-full p-2.5 text-white hover:bg-white/10">
          <Download size={22} aria-hidden="true" />
        </a>
        <button type="button" onClick={onClose} aria-label={t("ui.dialog.close")} className="rounded-full p-2.5 text-white hover:bg-white/10">
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        <img src={url} alt="" className={clsx("max-h-full max-w-full rounded-lg object-contain")} onClick={(e) => e.stopPropagation()} />
      </div>
    </div>
  );
}
