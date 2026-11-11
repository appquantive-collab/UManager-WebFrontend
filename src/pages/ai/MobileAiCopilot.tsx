import { AiChatPanel } from "../../components/ai/AiChatPanel";

// Fills the screen between the top bar and the floating bottom dock (and the
// iPhone home bar), so the message box always sits just above the dock.
export function MobileAiCopilot() {
  return (
    <div className="h-[calc(100dvh-12.75rem-env(safe-area-inset-bottom))] min-h-[24rem] overflow-hidden rounded-2xl border border-border bg-surface shadow-elevation-1">
      <AiChatPanel />
    </div>
  );
}
