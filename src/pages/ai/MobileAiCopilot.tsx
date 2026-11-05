import { AiChatPanel } from "../../components/ai/AiChatPanel";

export function MobileAiCopilot() {
  return (
    <div className="h-[calc(100vh-10rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-elevation-1">
      <AiChatPanel />
    </div>
  );
}
