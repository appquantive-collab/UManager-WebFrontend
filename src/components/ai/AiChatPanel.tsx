import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Send, Sparkles, X } from "lucide-react";
import { Badge } from "../ui/Badge";
import { ApiError } from "../../lib/api";
import { showError } from "../../lib/toast";
import {
  confirmAction,
  dismissAction,
  listMessages,
  sendMessage,
  type AiChatMessage,
} from "../../lib/ai-chat-api";

function useActionLabel() {
  const { t } = useTranslation();
  return (action: NonNullable<AiChatMessage["proposedAction"]>): string => {
    if (action.type === "mark_attendance") {
      const p = action.payload as { staffName?: string; status?: string; date?: string };
      return t("ai.aiChatPanel.markAttendance", {
        staffName: p.staffName ?? t("ai.aiChatPanel.staffFallback"),
        status: String(p.status ?? "").replace("_", " "),
        date: p.date ?? "",
      });
    }
    const p = action.payload as { customerName?: string; items?: { productName: string; quantity: number }[] };
    const itemsText = (p.items ?? []).map((i) => `${i.quantity} × ${i.productName}`).join(", ");
    return t("ai.aiChatPanel.newOrderFor", {
      customerName: p.customerName ?? t("ai.aiChatPanel.customerFallback"),
      itemsText,
    });
  };
}

function ActionCard({ message }: { message: AiChatMessage }) {
  const { t } = useTranslation();
  const actionLabel = useActionLabel();
  const queryClient = useQueryClient();
  const action = message.proposedAction!;

  const confirmMutation = useMutation({
    mutationFn: () => confirmAction(message._id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-chat-messages"] }),
    onError: (err) => showError(err instanceof ApiError ? err.message : t("ai.aiChatPanel.couldNotConfirmAction")),
  });
  const dismissMutation = useMutation({
    mutationFn: () => dismissAction(message._id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-chat-messages"] }),
    onError: (err) => showError(err instanceof ApiError ? err.message : t("ai.aiChatPanel.couldNotDismissAction")),
  });

  return (
    <div className="mt-2 rounded-xl border border-primary/30 bg-primary-container/20 p-3">
      <p className="text-xs font-semibold text-text">{actionLabel(action)}</p>

      {action.status === "pending" ? (
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={() => dismissMutation.mutate()}
            disabled={confirmMutation.isPending || dismissMutation.isPending}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted outline-none transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            <X size={13} /> {t("ai.aiChatPanel.dismiss")}
          </button>
          <button
            type="button"
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending || dismissMutation.isPending}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary outline-none transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {confirmMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {t("ai.aiChatPanel.confirm")}
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <Badge tone={action.status === "confirmed" ? "success" : "neutral"}>
            {action.status === "confirmed" ? (action.resultSummary ?? t("ai.aiChatPanel.confirmed")) : t("ai.aiChatPanel.dismissed")}
          </Badge>
        </div>
      )}
    </div>
  );
}

export function AiChatPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const promptSuggestions = [
    t("ai.aiChatPanel.promptSuggestions.todaysSales"),
    t("ai.aiChatPanel.promptSuggestions.pendingPayment"),
    t("ai.aiChatPanel.promptSuggestions.lowStock"),
  ];

  const messagesQuery = useQuery({ queryKey: ["ai-chat-messages"], queryFn: listMessages });
  const messages = messagesQuery.data ?? [];

  const sendMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-chat-messages"] });
      setInput("");
    },
    onError: (err) => {
      showError(err instanceof ApiError ? err.message : t("ai.aiChatPanel.couldNotReachAssistant"));
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const handleSend = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sendMutation.isPending) return;
    sendMutation.mutate(content);
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6">
        {messagesQuery.isLoading ? (
          <p className="text-sm text-text-muted">{t("ai.aiChatPanel.loadingConversation")}</p>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Sparkles size={28} className="text-primary" />
            <p className="mt-3 text-sm font-medium text-text">{t("ai.aiChatPanel.askAboutBusiness")}</p>
            <p className="mt-1 max-w-xs text-sm text-text-muted">
              {t("ai.aiChatPanel.askAboutBusinessDescription")}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {promptSuggestions.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleSend(p)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-muted outline-none transition-colors hover:border-primary/40 hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message._id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  message.role === "user"
                    ? "max-w-md rounded-2xl bg-primary px-4 py-2.5 text-sm text-on-primary"
                    : "max-w-md rounded-2xl bg-surface-muted px-4 py-2.5 text-sm text-text"
                }
              >
                {message.content}
                {message.proposedAction ? <ActionCard message={message} /> : null}
              </div>
            </div>
          ))
        )}
        {sendMutation.isPending ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl bg-surface-muted px-4 py-2.5">
              <Loader2 size={14} className="animate-spin text-text-muted" />
              <span className="text-sm text-text-muted">{t("ai.aiChatPanel.thinking")}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 rounded-lg bg-surface-variant px-4 py-2.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t("ai.aiChatPanel.inputPlaceholder")}
            className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
            disabled={sendMutation.isPending}
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || sendMutation.isPending}
            aria-label={t("ai.aiChatPanel.send")}
            className="text-primary outline-none disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          {t("ai.aiChatPanel.disclaimer")}
        </p>
      </div>
    </div>
  );
}
