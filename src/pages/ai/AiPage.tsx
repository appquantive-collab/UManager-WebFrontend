import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AiChatPanel } from "../../components/ai/AiChatPanel";
import { MobileAiCopilot } from "./MobileAiCopilot";

export function AiPage() {
  const { t } = useTranslation();
  return (
    <>
      <div className="lg:hidden">
        <MobileAiCopilot />
      </div>

      <div className="hidden h-[calc(100vh-10rem)] lg:block">
        <div className="flex h-full flex-col rounded-2xl bg-surface shadow-elevation-1">
          <div className="flex items-center gap-2 px-6 py-4">
            <Sparkles size={18} className="text-primary" />
            <h2 className="text-base font-semibold text-text">{t("ai.aiPage.heading")}</h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <AiChatPanel />
          </div>
        </div>
      </div>
    </>
  );
}
