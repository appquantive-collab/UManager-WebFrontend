import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import clsx from "clsx";
import { Tabs } from "../../components/ui/Tabs";
import { updateProfile } from "../../lib/auth-api";
import { ApiError } from "../../lib/api";
import { showError, showSuccess } from "../../lib/toast";
import { useAuthStore } from "../../lib/auth-store";
import type { PreferredLanguage } from "../../lib/auth-store";
import { supportedLanguages } from "../../lib/i18n";
import { DisplaySettings } from "../../components/settings/DisplaySettings";
import { BillSettings, BusinessDetailsSettings, GstSettings } from "../../components/settings/BusinessDetailsSettings";
import { TeamSettings } from "../../components/settings/TeamSettings";
import { AppSetupCard } from "../../components/settings/AppSetupCard";
import { PlanSettings } from "../../components/settings/PlanSettings";
import { PlatformAdminPlans } from "../../components/settings/PlatformAdminPlans";
import { usePlan } from "../../lib/use-plan";
import { ActivityLog } from "../../components/settings/ActivityLog";

function LanguageSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((state) => state.updateUser);
  const currentLanguage = useAuthStore((state) => state.user?.preferredLanguage) ?? "en";

  const mutation = useMutation({
    mutationFn: (preferredLanguage: PreferredLanguage) => updateProfile({ preferredLanguage }),
    onSuccess: (result) => {
      updateUser({ preferredLanguage: result.preferredLanguage });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      showSuccess(t("language.changedSuccess"));
    },
    onError: (err) => {
      showError(err instanceof ApiError ? err.message : t("common.somethingWentWrong"));
    },
  });

  return (
    <div className="max-w-2xl space-y-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div>
        <h3 className="text-sm font-semibold text-text">{t("language.label")}</h3>
        <p className="mt-1 text-xs text-text-muted">{t("settingsPage.languageDescription")}</p>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {supportedLanguages.map((lang) => (
          <button
            key={lang.code}
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(lang.code)}
            className={clsx(
              "flex items-center justify-between gap-2 rounded-xl border p-3.5 text-left outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60",
              currentLanguage === lang.code
                ? "border-primary bg-primary-container text-primary"
                : "border-border text-text-muted hover:border-primary/30"
            )}
          >
            <span className="text-sm font-medium">{lang.label}</span>
            {currentLanguage === lang.code ? <Check size={16} className="shrink-0" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = useAuthStore((state) => state.user?.role);
  const isManager = role === "OWNER" || role === "MANAGER" || role === "SUPER_ADMIN";
  const { platformAdmin } = usePlan();
  const TAB_KEYS = [
    ...(isManager ? ["business", "plan", "tax", "invoice", "team", "activity"] : []),
    "language",
    "display",
    ...(platformAdmin ? ["allPlans"] : []),
  ];
  const requested = searchParams.get("tab") ?? TAB_KEYS[0];
  const tab = TAB_KEYS.includes(requested) ? requested : TAB_KEYS[0];
  const setTab = (key: string) => setSearchParams({ tab: key }, { replace: true });

  const tabs = [
    { key: "business", label: t("settingsPage.tabs.business") },
    { key: "plan", label: t("settingsPage.tabs.plan") },
    { key: "tax", label: t("settingsPage.tabs.tax") },
    { key: "invoice", label: t("settingsPage.tabs.invoice") },
    { key: "team", label: t("settingsPage.tabs.team") },
    { key: "activity", label: t("settingsPage.tabs.activity") },
    { key: "language", label: t("settingsPage.tabs.language") },
    { key: "display", label: t("settingsPage.tabs.display") },
    { key: "allPlans", label: t("settingsPage.tabs.allPlans") },
  ].filter((item) => TAB_KEYS.includes(item.key));

  return (
    <div className="min-w-0 space-y-6">
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "business" && (
        <div className="space-y-6">
          <BusinessDetailsSettings />
          <AppSetupCard />
        </div>
      )}
      {tab === "language" && <LanguageSettings />}
      {tab === "display" && <DisplaySettings />}
      {tab === "tax" && <GstSettings />}
      {tab === "invoice" && <BillSettings />}
      {tab === "team" && <TeamSettings />}
      {tab === "activity" && <ActivityLog />}
      {tab === "plan" && <PlanSettings />}
      {tab === "allPlans" && <PlatformAdminPlans />}
    </div>
  );
}
