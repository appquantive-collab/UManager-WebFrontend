import { AiChatPanel } from "../../components/ai/AiChatPanel";
import { MobileAiCopilot } from "./MobileAiCopilot";

export function AiPage() {
  return (
    <>
      <div className="lg:hidden">
        <MobileAiCopilot />
      </div>

      {/* The chat panel has its own header (Munshi, status, speaker). */}
      <div className="hidden h-[calc(100dvh-10rem)] min-h-[32rem] lg:block">
        <div className="mx-auto h-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-surface shadow-elevation-1">
          <AiChatPanel />
        </div>
      </div>
    </>
  );
}
