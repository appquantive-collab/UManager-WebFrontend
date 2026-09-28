import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Settings as SettingsIcon } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Tabs } from "../../components/ui/Tabs";
import { TextField } from "../../components/ui/TextField";
import { Badge } from "../../components/ui/Badge";
import { getProfile } from "../../lib/auth-api";
import { categoryLabels, customerTypeLabels, goalLabels, orderVolumeLabels } from "../../lib/onboarding-labels";
import { OnboardingModal } from "../../components/onboarding/OnboardingModal";

const tabs = [
  { key: "business", label: "Business" },
  { key: "tax", label: "Tax" },
  { key: "invoice", label: "Invoice" },
  { key: "notifications", label: "Notifications" },
  { key: "integrations", label: "Integrations" },
  { key: "subscription", label: "Subscription" },
];

function BusinessSettings() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
  });

  return (
    <div className="max-w-xl space-y-4 rounded-2xl bg-surface p-6 shadow-elevation-1">
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Business name"
          value={isLoading ? "Loading…" : (profile?.tenant?.businessName ?? "")}
          disabled
        />
        <TextField
          label="Business type"
          value={isLoading ? "Loading…" : (profile?.tenant?.businessType ?? "")}
          disabled
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Phone" value={isLoading ? "Loading…" : (profile?.phone ?? "—")} disabled />
        <TextField
          label="Currency"
          value={isLoading ? "Loading…" : (profile?.tenant?.currency ?? "INR")}
          disabled
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        <p className="text-xs text-text-muted">Editing business settings isn&apos;t available yet.</p>
        <Button disabled title="Coming soon">
          Save changes
        </Button>
      </div>
    </div>
  );
}

function BusinessProfileCard() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
  });
  const [wizardOpen, setWizardOpen] = useState(false);

  const onboarding = profile?.tenant?.onboarding;
  const aiLayout = profile?.tenant?.aiDashboardLayout;

  if (isLoading) {
    return <div className="max-w-xl rounded-2xl bg-surface p-6 shadow-elevation-1 text-sm text-text-muted">Loading…</div>;
  }

  return (
    <div className="max-w-xl space-y-4 rounded-2xl bg-surface p-6 shadow-elevation-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text">Business profile</h3>
          <p className="mt-1 text-xs text-text-muted">
            Used to personalize your dashboard and recommendations.
          </p>
        </div>
        <Badge tone={onboarding?.completed ? "success" : "warning"}>
          {onboarding?.completed ? "Complete" : "Not set up"}
        </Badge>
      </div>

      {onboarding?.completed ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-text-muted">Category</p>
              <p className="mt-0.5 text-sm font-medium text-text">
                {onboarding.category ? categoryLabels[onboarding.category] : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Customers</p>
              <p className="mt-0.5 text-sm font-medium text-text">
                {onboarding.customerType ? customerTypeLabels[onboarding.customerType] : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Order volume</p>
              <p className="mt-0.5 text-sm font-medium text-text">
                {onboarding.orderVolume ? orderVolumeLabels[onboarding.orderVolume] : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Warehouses &amp; staff</p>
              <p className="mt-0.5 text-sm font-medium text-text">
                {onboarding.warehouseCount ?? 0} warehouses · {onboarding.staffCount ?? 0} staff
              </p>
            </div>
          </div>

          {onboarding.goals.length > 0 && (
            <div>
              <p className="text-xs text-text-muted">Priorities</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {onboarding.goals.map((g) => (
                  <Badge key={g} tone="info">
                    {goalLabels[g]}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {onboarding.painPoints && (
            <div>
              <p className="text-xs text-text-muted">Notes</p>
              <p className="mt-0.5 text-sm text-text">{onboarding.painPoints}</p>
            </div>
          )}

          {aiLayout && (
            <div className="flex items-start gap-2 rounded-xl border border-primary-container bg-primary-container/40 p-3">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold text-primary">AI-personalized dashboard active</p>
                <p className="mt-0.5 text-xs text-text-muted">{aiLayout.welcomeMessage}</p>
              </div>
            </div>
          )}

          <Button variant="secondary" onClick={() => setWizardOpen(true)}>
            Update business profile
          </Button>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-text-muted">
            You haven&apos;t completed your business profile yet.
          </p>
          <Button onClick={() => setWizardOpen(true)}>Complete setup</Button>
        </div>
      )}

      <OnboardingModal open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}

function PlaceholderSettings({ label }: { label: string }) {
  return (
    <EmptyState
      icon={SettingsIcon}
      title={`${label} settings coming soon`}
      description="This section is being designed."
    />
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState("business");

  return (
    <div className="space-y-6">
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "business" && (
        <div className="space-y-6">
          <BusinessSettings />
          <BusinessProfileCard />
        </div>
      )}
      {tab === "tax" && <PlaceholderSettings label="Tax" />}
      {tab === "invoice" && <PlaceholderSettings label="Invoice" />}
      {tab === "notifications" && <PlaceholderSettings label="Notifications" />}
      {tab === "integrations" && <PlaceholderSettings label="Integrations" />}
      {tab === "subscription" && <PlaceholderSettings label="Subscription" />}
    </div>
  );
}
