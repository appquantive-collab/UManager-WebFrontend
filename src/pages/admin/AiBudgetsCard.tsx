import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gauge } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { inputClass } from "../../components/page/kit";
import { getAiBudgets, saveAiBudgets, type AiBudgets } from "../../lib/admin-api";
import { ApiError } from "../../lib/api";
import { showError, showSuccess } from "../../lib/toast";
import { inr } from "./admin-format";

const PLANS: { key: keyof AiBudgets; label: string }[] = [
  { key: "basic", label: "₹999 plan (Basic)" },
  { key: "pro", label: "₹2,999 plan (Pro)" },
  { key: "trial", label: "Free trial" },
];

/**
 * Munshi AI budget per plan, in rupees a month. Businesses get it per day
 * (÷ 30, refilled at midnight) and only ever see percentages. Everything AI
 * counts: chat, speech-to-text, the voice, setup.
 */
export function AiBudgetsCard() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-ai-budgets"], queryFn: getAiBudgets });
  const [draft, setDraft] = useState<AiBudgets | null>(null);

  useEffect(() => {
    if (query.data && !draft) setDraft(query.data.budgets);
  }, [query.data, draft]);

  const save = useMutation({
    mutationFn: () => saveAiBudgets(draft!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-ai-budgets"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-businesses"] });
      showSuccess("AI budgets saved");
    },
    onError: (err) => showError(err instanceof ApiError ? err.message : "Couldn't save"),
  });

  const view = query.data;
  if (!view || !draft) return null;
  const unit = view.unitCostInr;
  const perDay = (monthly: number) => {
    const day = monthly / 30;
    return {
      day,
      chat: Math.floor(day / unit.chatMessage),
      sarvam: Math.round((day / unit.sarvamSpeechMinute) * 10) / 10,
      whisper: Math.floor(day / unit.whisperSpeechMinute),
      voice: Math.floor(day / unit.voiceReply),
    };
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <Gauge size={18} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
        <div>
          <h3 className="text-base font-bold text-text">Plan AI budgets</h3>
          <p className="text-sm text-text-muted">
            Rupees of AI per business per month. Given out per day (÷ 30), refilled at midnight; unused doesn&apos;t carry over. Businesses only see percentages.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {PLANS.map((p) => {
          const est = perDay(draft[p.key]);
          return (
            <div key={p.key} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="min-w-0 flex-1 text-sm font-semibold text-text" htmlFor={`budget-${p.key}`}>
                  {p.label}
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-text-muted">₹</span>
                  <input
                    id={`budget-${p.key}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={draft[p.key]}
                    onChange={(e) => setDraft({ ...draft, [p.key]: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className={`${inputClass} h-10 w-28 tabular-nums`}
                  />
                  <span className="text-xs text-text-muted">/ month</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                {inr(est.day)} a day ≈ {est.chat} Munshi chat messages, or {est.sarvam} min of Sarvam speech-to-text, or {est.whisper} min of Whisper, or {est.voice} spoken Sarvam replies
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-text-muted">
        Unit costs: chat message {inr(unit.chatMessage)}
        {view.measured.includes("chat") ? " (measured)" : " (estimate)"}, Sarvam speech {inr(unit.sarvamSpeechMinute)}/min, Whisper {inr(unit.whisperSpeechMinute)}/min, voice reply {inr(unit.voiceReply)}
        {view.measured.includes("tts") ? " (measured)" : " (estimate)"}. Measured figures are averages of the last 30 days.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button isLoading={save.isPending} onClick={() => save.mutate()}>
          Save budgets
        </Button>
        <Button variant="secondary" onClick={() => setDraft(view.defaults)}>
          Reset to ₹200 / ₹990 / ₹84.15
        </Button>
      </div>
    </section>
  );
}
