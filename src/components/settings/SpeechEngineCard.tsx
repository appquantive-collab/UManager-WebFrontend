import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Mic } from "lucide-react";
import clsx from "clsx";
import { getPlatformSettings, updatePlatformSettings, type SttEngine } from "../../lib/billing-api";
import { errorMessage } from "../../lib/api-errors";
import { showError, showSuccess } from "../../lib/toast";

const ENGINES: SttEngine[] = ["auto", "sarvam", "whisper"];

/** Super admin: which speech-to-text every business's mic uses. */
export function SpeechEngineCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["platform-settings"], queryFn: getPlatformSettings });
  const save = useMutation({
    mutationFn: (sttEngine: SttEngine) => updatePlatformSettings({ sttEngine }),
    onSuccess: (data) => {
      queryClient.setQueryData(["platform-settings"], data);
      showSuccess(t("speechEngine.saved"));
    },
    onError: (err) => showError(errorMessage(err, t)),
  });
  const current = settings.data?.sttEngine;
  const sarvamStatus = !settings.data
    ? null
    : !settings.data.sarvamConfigured
      ? t("speechEngine.sarvamMissing")
      : !settings.data.sarvamAvailable
        ? t("speechEngine.sarvamPaused")
        : t("speechEngine.sarvamReady");

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <Mic size={18} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-base font-bold text-text">{t("speechEngine.title")}</h3>
          <p className="text-sm text-text-muted">{t("speechEngine.body")}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2" role="radiogroup" aria-label={t("speechEngine.title")}>
        {ENGINES.map((engine) => {
          const selected = current === engine;
          return (
            <button
              key={engine}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!settings.data || save.isPending}
              onClick={() => engine !== current && save.mutate(engine)}
              className={clsx(
                "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60",
                selected ? "border-primary bg-primary-container" : "border-border hover:bg-surface-muted"
              )}
            >
              <span
                className={clsx(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  selected ? "border-primary bg-primary text-on-primary" : "border-border"
                )}
                aria-hidden="true"
              >
                {selected ? <Check size={12} strokeWidth={3} /> : null}
              </span>
              <span>
                <span className="block text-sm font-semibold text-text">{t(`speechEngine.options.${engine}.title`)}</span>
                <span className="block text-xs text-text-muted">{t(`speechEngine.options.${engine}.body`)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {sarvamStatus ? <p className="mt-2 text-xs text-text-muted">{sarvamStatus}</p> : null}
    </section>
  );
}
