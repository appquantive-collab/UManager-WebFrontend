import { useTranslation } from "react-i18next";
import { SpeechEngineCard } from "../../components/settings/SpeechEngineCard";
import { PricingCard } from "./PricingCard";
import { AiBudgetsCard } from "./AiBudgetsCard";
import { VoiceCard } from "./VoiceCard";
import { AdminPasswordCard } from "./AdminPasswordCard";

export function AdminSettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-[1.625rem] font-bold tracking-tight text-text">{t("admin.settings.title")}</h1>
        <p className="text-sm text-text-muted">{t("admin.settings.subtitle")}</p>
      </div>
      <SpeechEngineCard />
      <VoiceCard />
      <AiBudgetsCard />
      <PricingCard />
      <AdminPasswordCard />
    </div>
  );
}
