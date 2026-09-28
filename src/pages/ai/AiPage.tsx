import { Mic, Send, Sparkles } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { mockAiConversation, mockAiInsights } from "../../lib/mock-data";
import { MobileAiCopilot } from "./MobileAiCopilot";

const severityTone = {
  warning: "warning",
  danger: "danger",
  info: "info",
} as const;

export function AiPage() {
  return (
    <>
      <div className="lg:hidden">
        <MobileAiCopilot />
      </div>

    <div className="hidden grid-cols-1 gap-6 lg:grid lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col rounded-2xl bg-surface shadow-elevation-1">
        <div className="flex items-center gap-2 px-6 py-4">
          <Sparkles size={18} className="text-primary" />
          <h2 className="text-base font-semibold text-text">AI Business Assistant</h2>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {mockAiConversation.map((message, i) => (
            <div key={i} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  message.role === "user"
                    ? "max-w-md rounded-2xl bg-primary px-4 py-2.5 text-sm text-on-primary"
                    : "max-w-md rounded-2xl bg-surface-muted px-4 py-2.5 text-sm text-text"
                }
              >
                {message.text}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 rounded-lg bg-surface-variant px-4 py-2.5">
            <input
              placeholder="Ask about your business, e.g. Aaj kitni sale hui?"
              className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
              disabled
            />
            <button type="button" aria-label="Voice entry" className="text-text-muted hover:text-text" disabled>
              <Mic size={18} />
            </button>
            <button type="button" aria-label="Send" className="text-primary" disabled>
              <Send size={18} />
            </button>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            AI-drafted actions always require your review and confirmation before affecting your business data.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-text">AI Insights</h2>
        {mockAiInsights.map((insight, i) => (
          <div key={i} className="rounded-2xl bg-surface p-4 shadow-elevation-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text">{insight.type}</span>
              <Badge tone={severityTone[insight.severity]}>{insight.severity}</Badge>
            </div>
            <p className="mt-2 text-sm text-text-muted">{insight.detail}</p>
          </div>
        ))}
      </div>
    </div>
    </>
  );
}
