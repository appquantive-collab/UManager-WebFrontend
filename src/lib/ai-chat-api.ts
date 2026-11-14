import { apiFetch } from "./api";
import { currentLanguage } from "./i18n";

export type ActionStatus = "pending" | "confirmed" | "dismissed";
export type ActionType = "mark_attendance" | "create_order";

export interface ProposedAction {
  type: ActionType;
  payload: Record<string, unknown>;
  status: ActionStatus;
  resultSummary?: string;
}

export interface AiChatMessage {
  _id: string;
  role: "user" | "assistant";
  content: string;
  proposedAction?: ProposedAction;
  createdAt: string;
}

export interface SendMessageResult {
  userMessage: AiChatMessage;
  assistantMessage: AiChatMessage;
}

export function listMessages(): Promise<AiChatMessage[]> {
  return apiFetch("/ai-chat/messages");
}

export function sendMessage(content: string): Promise<SendMessageResult> {
  return apiFetch("/ai-chat/messages", {
    method: "POST",
    // Munshi AI replies in the app's language.
    body: JSON.stringify({ content, language: currentLanguage() }),
  });
}

export function confirmAction(messageId: string): Promise<AiChatMessage> {
  return apiFetch(`/ai-chat/messages/${messageId}/confirm`, { method: "POST" });
}

export function dismissAction(messageId: string): Promise<AiChatMessage> {
  return apiFetch(`/ai-chat/messages/${messageId}/dismiss`, { method: "POST" });
}

/** AI search: a quick question about the business, answered by Munshi AI (not saved to the chat). */
export function askBusinessQuestion(question: string): Promise<{ answer: string }> {
  return apiFetch("/ai-chat/ask", { method: "POST", body: JSON.stringify({ question, language: currentLanguage() }) });
}
