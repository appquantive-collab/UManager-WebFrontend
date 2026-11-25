import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MessagesSquare } from "lucide-react";
import clsx from "clsx";
import { listConversations } from "../../lib/chat-api";
import { chatKeys } from "../../lib/chat-cache";
import { ConversationList } from "../../components/chat/ConversationList";
import { ChatThread } from "../../components/chat/ChatThread";
import { NewChatDialog } from "../../components/chat/ChatDialogs";

/**
 * Shop-to-shop chat. Phones: the list, or one chat full-screen. Computers: the
 * list on the left and the open chat on the right (like WhatsApp Web).
 */
export function ChatsPage() {
  const { t } = useTranslation();
  const { conversationId } = useParams();
  const [newOpen, setNewOpen] = useState(false);
  const conversations = useQuery({ queryKey: chatKeys.list, queryFn: listConversations, refetchInterval: 60_000 });

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-surface lg:rounded-2xl lg:border lg:border-border lg:shadow-card">
      <aside className={clsx("min-h-0 w-full flex-col border-border lg:flex lg:w-[24rem] lg:shrink-0 lg:border-r", conversationId ? "hidden" : "flex")}>
        <ConversationList conversations={conversations.data ?? []} loading={conversations.isLoading} activeId={conversationId ?? null} onNewChat={() => setNewOpen(true)} />
      </aside>
      <section className={clsx("min-h-0 min-w-0 flex-1", conversationId ? "flex flex-col" : "hidden lg:flex lg:flex-col")}>
        {conversationId ? (
          <ChatThread key={conversationId} conversationId={conversationId} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-[#f6f0ea] p-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface text-primary shadow-card">
              <MessagesSquare size={30} aria-hidden="true" />
            </span>
            <p className="mt-4 text-lg font-bold text-text">{t("chat.pickTitle")}</p>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-text-muted">{t("chat.pickBody")}</p>
          </div>
        )}
      </section>
      <NewChatDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
