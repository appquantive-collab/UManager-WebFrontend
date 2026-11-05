import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Settings as SettingsIcon, Check } from "lucide-react";
import clsx from "clsx";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Tabs } from "../../components/ui/Tabs";
import { TextField } from "../../components/ui/TextField";
import { Badge } from "../../components/ui/Badge";
import { getProfile, updateProfile } from "../../lib/auth-api";
import { ApiError } from "../../lib/api";
import { showError, showSuccess } from "../../lib/toast";
import { useAuthStore } from "../../lib/auth-store";
import type { PreferredLanguage } from "../../lib/auth-store";
import { supportedLanguages } from "../../lib/i18n";
import { categoryLabel, customerTypeLabel, goalLabel, orderVolumeLabel } from "../../lib/onboarding-labels";
import { OnboardingModal } from "../../components/onboarding/OnboardingModal";

function BusinessSettings() {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
  });

  return (
    <div className="max-w-xl space-y-4 rounded-2xl bg-surface p-6 shadow-elevation-1">
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label={t("settingsPage.businessName")}
          value={isLoading ? t("common.loading") : (profile?.tenant?.businessName ?? "")}
          disabled
        />
        <TextField
          label={t("settingsPage.businessType")}
          value={isLoading ? t("common.loading") : (profile?.tenant?.businessType ?? "")}
          disabled
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TextField label={t("common.phone")} value={isLoading ? t("common.loading") : (profile?.phone ?? "—")} disabled />
        <TextField
          label={t("settingsPage.currency")}
          value={isLoading ? t("common.loading") : (profile?.tenant?.currency ?? "INR")}
          disabled
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        <p className="text-xs text-text-muted">{t("settingsPage.editingNotAvailable")}</p>
        <Button disabled title="Coming soon">
          {t("common.saveChanges")}
        </Button>
      </div>
    </div>
  );
}

function BusinessProfileCard() {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
  });
  const [wizardOpen, setWizardOpen] = useState(false);

  const onboarding = profile?.tenant?.onboarding;
  const aiLayout = profile?.tenant?.aiDashboardLayout;

  if (isLoading) {
    return (
      <div className="max-w-xl rounded-2xl bg-surface p-6 shadow-elevation-1 text-sm text-text-muted">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4 rounded-2xl bg-surface p-6 shadow-elevation-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text">{t("settingsPage.businessProfile")}</h3>
          <p className="mt-1 text-xs text-text-muted">{t("settingsPage.businessProfileDescription")}</p>
        </div>
        <Badge tone={onboarding?.completed ? "success" : "warning"}>
          {onboarding?.completed ? t("settingsPage.complete") : t("settingsPage.notSetUp")}
        </Badge>
      </div>

      {onboarding?.completed ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-text-muted">{t("settingsPage.category")}</p>
              <p className="mt-0.5 text-sm font-medium text-text">
                {onboarding.category ? categoryLabel(onboarding.category) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">{t("settingsPage.customers")}</p>
              <p className="mt-0.5 text-sm font-medium text-text">
                {onboarding.customerType ? customerTypeLabel(onboarding.customerType) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">{t("settingsPage.orderVolume")}</p>
              <p className="mt-0.5 text-sm font-medium text-text">
                {onboarding.orderVolume ? orderVolumeLabel(onboarding.orderVolume) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">{t("settingsPage.warehousesAndStaff")}</p>
              <p className="mt-0.5 text-sm font-medium text-text">
                {t("settingsPage.warehousesStaffCount", {
                  warehouses: onboarding.warehouseCount ?? 0,
                  staff: onboarding.staffCount ?? 0,
                })}
              </p>
            </div>
          </div>

          {onboarding.goals.length > 0 && (
            <div>
              <p className="text-xs text-text-muted">{t("settingsPage.priorities")}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {onboarding.goals.map((g) => (
                  <Badge key={g} tone="info">
                    {goalLabel(g)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {onboarding.painPoints && (
            <div>
              <p className="text-xs text-text-muted">{t("settingsPage.notes")}</p>
              <p className="mt-0.5 text-sm text-text">{onboarding.painPoints}</p>
            </div>
          )}

          {aiLayout && (
            <div className="flex items-start gap-2 rounded-xl border border-primary-container bg-primary-container/40 p-3">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold text-primary">{t("settingsPage.aiPersonalizedActive")}</p>
                <p className="mt-0.5 text-xs text-text-muted">{aiLayout.welcomeMessage}</p>
              </div>
            </div>
          )}

          <Button variant="secondary" onClick={() => setWizardOpen(true)}>
            {t("settingsPage.updateBusinessProfile")}
          </Button>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-text-muted">{t("settingsPage.notCompletedYet")}</p>
          <Button onClick={() => setWizardOpen(true)}>{t("settingsPage.completeSetup")}</Button>
        </div>
      )}

      <OnboardingModal open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}

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
    <div className="max-w-xl space-y-4 rounded-2xl bg-surface p-6 shadow-elevation-1">
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

function PlaceholderSettings({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={SettingsIcon}
      title={t("settingsPage.comingSoon", { label })}
      description={t("settingsPage.beingDesigned")}
    />
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("business");

  const tabs = [
    { key: "business", label: t("settingsPage.tabs.business") },
    { key: "language", label: t("settingsPage.tabs.language") },
    { key: "tax", label: t("settingsPage.tabs.tax") },
    { key: "invoice", label: t("settingsPage.tabs.invoice") },
    { key: "notifications", label: t("settingsPage.tabs.notifications") },
    { key: "integrations", label: t("settingsPage.tabs.integrations") },
    { key: "subscription", label: t("settingsPage.tabs.subscription") },
  ];

  return (
    <div className="space-y-6">
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "business" && (
        <div className="space-y-6">
          <BusinessSettings />
          <BusinessProfileCard />
        </div>
      )}
      {tab === "language" && <LanguageSettings />}
      {tab === "tax" && <PlaceholderSettings label={t("settingsPage.tabs.tax")} />}
      {tab === "invoice" && <PlaceholderSettings label={t("settingsPage.tabs.invoice")} />}
      {tab === "notifications" && <PlaceholderSettings label={t("settingsPage.tabs.notifications")} />}
      {tab === "integrations" && <PlaceholderSettings label={t("settingsPage.tabs.integrations")} />}
      {tab === "subscription" && <PlaceholderSettings label={t("settingsPage.tabs.subscription")} />}
    </div>
  );
}
