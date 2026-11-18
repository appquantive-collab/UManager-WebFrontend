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

export type StepType = "create_customer" | "create_supplier" | "create_product" | "record_purchase" | "create_bill" | "create_order" | "mark_attendance";

export interface StepLine {
  productName: string;
  quantity: number;
  unit?: string;
  price?: number;
}

/** One step of a Munshi AI workflow; confirmed one by one, in order. */
export interface WorkflowStep {
  id: string;
  type: StepType;
  payload: Record<string, unknown> & { items?: StepLine[] };
  status: ActionStatus;
  /** Added by Munshi because a later step needs it (a supplier who isn't saved yet). */
  auto?: boolean;
  /** Replaced by a corrected list further down the chat. */
  replaced?: boolean;
  resultSummary?: string;
  resultId?: string;
}

export interface AiChatMessage {
  _id: string;
  role: "user" | "assistant";
  content: string;
  proposedAction?: ProposedAction;
  steps?: WorkflowStep[];
  /** Answers the user can tap (Munshi asked a question). */
  quickReplies?: string[];
  createdAt: string;
}

/** Do a step; `payload` carries the user's edits, `force` goes ahead after a stock/credit warning. */
export function confirmStep(messageId: string, stepId: string, body: { payload?: Record<string, unknown>; force?: boolean } = {}): Promise<AiChatMessage> {
  return apiFetch(`/ai-chat/messages/${messageId}/steps/${stepId}/confirm`, { method: "POST", body: JSON.stringify(body) });
}

export function dismissStep(messageId: string, stepId: string): Promise<AiChatMessage> {
  return apiFetch(`/ai-chat/messages/${messageId}/steps/${stepId}/dismiss`, { method: "POST" });
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
