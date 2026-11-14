import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Factory,
  Globe,
  Phone,
  Loader2,
  Mic,
  PackagePlus,
  ReceiptText,
  Settings2,
  Sparkles,
  Square,
  Store,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { planSetups, saveOnboarding, personalizeDashboard, understandBusiness } from "../../lib/tenants-api";
import type { AppSetup, BusinessCategory, BusinessRole, OnlineChannel, OrderVolume } from "../../lib/auth-api";
import { categoryGroups } from "../../lib/business-categories";
import { categoryLabel, orderVolumeLabel } from "../../lib/onboarding-labels";
import {
  TEMPLATES,
  buildAppSetup,
  goalsFor,
  starterCategoriesFor,
  suggestTemplates,
  type SetupAnswers,
  type TemplateKey,
} from "../../lib/business-templates";
import { GSTIN_PATTERN } from "../../lib/gst-states";
import { transcribeVoice, useVoiceRecorder, voiceRecordingSupported } from "../../lib/speech";
import { useNewSaleModalStore } from "../../lib/new-sale-store";
import { errorMessage } from "../../lib/api-errors";
import { showError } from "../../lib/toast";
import type { SupportedLanguageCode } from "../../lib/i18n";

type Step = "work" | "role" | "online" | "gst" | "size" | "plans" | "saving" | "done";
const QUESTION_STEPS: Step[] = ["work", "role", "online", "gst", "size", "plans"];

const EXAMPLES = ["kirana", "wholesale", "namkeen", "medical", "mobile", "garments"] as const;

const ROLE_OPTIONS: { value: BusinessRole; icon: LucideIcon }[] = [
  { value: "retailer", icon: Store },
  { value: "trader", icon: Truck },
  { value: "manufacturer", icon: Factory },
];

const ONLINE_OPTIONS: OnlineChannel[] = ["phone", "social", "website", "marketplace"];
const ORDER_VOLUMES: OrderVolume[] = ["lt_100", "100_500", "500_2000", "gt_2000"];
const STAFF_OPTIONS = [
  { key: "justMe", value: 1 },
  { key: "small", value: 3 },
  { key: "medium", value: 10 },
  { key: "large", value: 25 },
];
const GODOWN_OPTIONS = [
  { key: "one", value: 1 },
  { key: "few", value: 2 },
  { key: "many", value: 4 },
];

const TEMPLATE_ICONS: Record<TemplateKey, LucideIcon> = {
  kirana_counter: Store,
  retail_gst: ReceiptText,
  wholesale_trader: Truck,
  manufacturer: Factory,
  medical_store: PackagePlus,
  mobile_electronics: Settings2,
  fashion_store: Sparkles,
  online_seller: Globe,
};

/** One setup the owner can pick on the last step. */
interface SetupOption {
  id: string;
  /** Standard setup it's closest to (for the icon). */
  base: TemplateKey;
  name: string;
  tagline: string;
  points: string[];
  appSetup: AppSetup;
  categories: string[];
}

const isTemplateKey = (key: string): key is TemplateKey => key in TEMPLATES;

/**
 * Business setup, one question at a time: what they do (typed, spoken or
 * picked) → how they sell → online → GST → size → setups that Munshi AI writes
 * for this business from those answers (fixed ready-made setups if AI is down).
 */
export function OnboardingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <SetupFlow onClose={onClose} />;
}

function SetupFlow({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const openNewSale = useNewSaleModalStore((s) => s.openModal);
  const language = (i18n.resolvedLanguage ?? "hi-Latn") as SupportedLanguageCode;

  const [step, setStep] = useState<Step>("work");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<BusinessCategory | null>(null);
  const [showList, setShowList] = useState(false);
  const [summary, setSummary] = useState("");
  const [needs, setNeeds] = useState<SetupAnswers["needs"]>({ batch: false, serial: false, variants: false, rawMaterials: false });
  const [roles, setRoles] = useState<BusinessRole[]>([]);
  const [online, setOnline] = useState<OnlineChannel[] | null>(null);
  const [storeUrl, setStoreUrl] = useState("");
  const [hasGst, setHasGst] = useState<boolean | null | undefined>(undefined);
  const [gstin, setGstin] = useState("");
  const [orderVolume, setOrderVolume] = useState<OrderVolume>("lt_100");
  const [staffCount, setStaffCount] = useState(1);
  const [warehouseCount, setWarehouseCount] = useState(1);
  const [chosenId, setChosenId] = useState<string | null>(null);
  // Munshi AI's setups, and the answers they were made for (redone if answers change).
  const [aiSetups, setAiSetups] = useState<SetupOption[] | null>(null);
  const [plannedFor, setPlannedFor] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const recorder = useVoiceRecorder(() => showError(t("setup.work.micError")));

  const understand = useMutation({
    mutationFn: () => understandBusiness(description.trim(), language),
    onSuccess: (u) => {
      if (!category) setCategory(u.category);
      setRoles((current) => (current.length ? current : u.roles));
      setNeeds(u.needs);
      setSummary(u.summary);
      setStep("role");
    },
    // AI being down must never block setup: carry on with what they picked.
    onError: () => setStep("role"),
  });

  const planInput = () => ({ ...currentAnswers(), description: description.trim() || undefined, orderVolume, language });

  const plan = useMutation({
    mutationFn: () => planSetups(planInput()),
    onSuccess: (res) => {
      if (!res.setups) setPlannedFor(""); // AI had nothing: try again next time
      setAiSetups(
        res.setups
          ? res.setups.map((s, i) => {
              const base: TemplateKey = isTemplateKey(s.base) ? s.base : "retail_gst";
              // ":" would be read as an i18n namespace where the name is shown later.
              const name = s.name.replace(/:/g, " -").slice(0, 40);
              return {
                id: `ai-${i}`,
                base,
                name,
                tagline: s.tagline,
                points: s.points,
                appSetup: { template: name, defaultBillType: s.defaultBillType, features: s.features },
                categories: s.categories.length ? s.categories : starterCategoriesFor(category, base),
              };
            })
          : null
      );
      setChosenId(null);
      setStep("plans");
    },
    // AI being down must never block setup: show the ready-made setups.
    onError: () => {
      setAiSetups(null);
      setChosenId(null);
      setPlannedFor(""); // try Munshi AI again next time
      setStep("plans");
    },
  });

  const save = useMutation({
    mutationFn: async (option: SetupOption) => {
      const appSetup = option.appSetup;
      await saveOnboarding({
        category: category ?? "other",
        customerType: roles.includes("retailer") && roles.length === 1 ? "retail" : roles.includes("retailer") ? "both" : "wholesale",
        orderVolume,
        warehouseCount,
        staffCount,
        goals: goalsFor(appSetup),
        description: description.trim() || undefined,
        roles,
        sellsOnline: online ?? [],
        onlineStoreUrl: storeUrl.trim() || undefined,
        hasGst: hasGst ?? null,
        gstin: hasGst && GSTIN_PATTERN.test(gstin) ? gstin : undefined,
        appSetup,
        starterCategories: option.categories,
      });
      try {
        await personalizeDashboard();
      } catch {
        // Dashboard wording is a nice-to-have; setup has already been saved.
      }
    },
    onMutate: () => setStep("saving"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setStep("done");
    },
    onError: (err) => {
      showError(errorMessage(err, t));
      setStep("plans");
    },
  });

  function currentAnswers(): SetupAnswers {
    return { category, roles, needs, sellsOnline: online ?? [], hasGst: hasGst ?? null, staffCount, warehouseCount };
  }

  // Ready-made setups: shown when Munshi AI couldn't write any.
  const fixedOptions: SetupOption[] = suggestTemplates(currentAnswers()).map((key) => ({
    id: key,
    base: key,
    name: t(`setupTemplates.${key}.name`),
    tagline: t(`setupTemplates.${key}.tagline`),
    points: TEMPLATES[key].points.map((p) => t(`setupTemplates.points.${p}`)),
    appSetup: buildAppSetup(key, currentAnswers()),
    categories: starterCategoriesFor(category, key),
  }));
  const options = aiSetups ?? fixedOptions;
  const chosen = options.find((o) => o.id === chosenId) ?? options[0];
  const stepIndex = QUESTION_STEPS.indexOf(step);
  const gstinInvalid = hasGst === true && gstin !== "" && !GSTIN_PATTERN.test(gstin);

  const toggleMic = async () => {
    if (!recorder.recording) {
      void recorder.start();
      return;
    }
    const clip = await recorder.stop();
    if (!clip || clip.durationMs < 600) return;
    setTranscribing(true);
    try {
      const text = await transcribeVoice(clip.blob, language, "text");
      if (text.trim()) setDescription((d) => (d ? `${d} ${text.trim()}` : text.trim()));
    } catch {
      showError(t("setup.work.micError"));
    } finally {
      setTranscribing(false);
    }
  };

  const back = () => {
    const i = QUESTION_STEPS.indexOf(step);
    if (i > 0) setStep(QUESTION_STEPS[i - 1]);
  };

  const next = () => {
    if (step === "work") {
      if (description.trim().length >= 2) understand.mutate();
      else setStep("role");
      return;
    }
    if (step === "plans") {
      if (chosen) save.mutate(chosen);
      return;
    }
    if (step === "size") {
      // Munshi AI writes the setups from all the answers; reuse them if nothing changed.
      const key = JSON.stringify(planInput());
      if (key === plannedFor) setStep("plans");
      else {
        setPlannedFor(key);
        plan.mutate();
      }
      return;
    }
    setStep(QUESTION_STEPS[stepIndex + 1]);
  };

  const canNext =
    step === "work"
      ? description.trim().length >= 2 || category !== null
      : step === "role"
        ? roles.length > 0
        : step === "online"
          ? online !== null
          : step === "gst"
            ? hasGst !== undefined && !gstinInvalid
            : true;

  const choice = (selected: boolean) =>
    clsx(
      "flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
      selected ? "border-primary bg-primary-container" : "border-border hover:bg-surface-muted"
    );
  const chip = (selected: boolean) =>
    clsx(
      "min-h-11 rounded-full border px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
      selected ? "border-primary bg-primary-container text-text" : "border-border text-text hover:bg-surface-muted"
    );

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t("setup.title")}>
      <div className="relative flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-elevation-3 sm:rounded-3xl">
        {stepIndex >= 0 ? (
          <div className="flex items-center gap-2 px-4 pb-2 pt-3.5">
            <button
              type="button"
              onClick={back}
              disabled={stepIndex === 0}
              aria-label={t("onboarding.back")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-icon outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40 disabled:invisible"
            >
              <ArrowLeft size={19} aria-hidden="true" />
            </button>
            <div className="flex-1" aria-hidden="true">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-variant">
                <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${((stepIndex + 1) / QUESTION_STEPS.length) * 100}%` }} />
              </div>
            </div>
            <span className="w-12 text-center text-xs font-semibold tabular-nums text-text-muted">
              {stepIndex + 1}/{QUESTION_STEPS.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("onboarding.skipForNow")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-icon outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2">
          {step === "work" && (
            <>
              <h2 className="text-xl font-bold text-text">{t("setup.work.title")}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("setup.work.subtitle")}</p>
              <div className="relative mt-4">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={500}
                  autoFocus
                  placeholder={t("setup.work.placeholder")}
                  aria-label={t("setup.work.title")}
                  className="w-full resize-none rounded-2xl border border-border bg-surface px-4 py-3 pr-14 text-base text-text outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {voiceRecordingSupported ? (
                  <button
                    type="button"
                    onClick={() => void toggleMic()}
                    disabled={transcribing}
                    aria-label={recorder.recording ? t("setup.work.stopMic") : t("setup.work.mic")}
                    className={clsx(
                      "absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      recorder.recording ? "bg-danger text-white" : "bg-primary text-on-primary"
                    )}
                  >
                    {transcribing ? <Loader2 size={18} className="animate-spin" /> : recorder.recording ? <Square size={14} fill="currentColor" /> : <Mic size={18} />}
                  </button>
                ) : null}
              </div>
              {recorder.recording ? <p className="mt-1.5 text-xs font-semibold text-danger">{t("setup.work.listening")}</p> : null}

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">{t("setup.work.examplesLabel")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button key={ex} type="button" className={chip(false)} onClick={() => setDescription(t(`setup.work.examples.${ex}`))}>
                    {t(`setup.work.examples.${ex}`)}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowList((v) => !v)}
                aria-expanded={showList}
                className="mt-5 flex min-h-12 w-full items-center justify-between rounded-2xl border border-border px-4 text-left text-sm font-semibold text-text outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span>{category ? t("setup.work.picked", { category: categoryLabel(category) }) : t("setup.work.orPick")}</span>
                <ChevronDown size={17} className={clsx("shrink-0 text-icon transition-transform", showList && "rotate-180")} aria-hidden="true" />
              </button>
              {showList ? (
                <div className="mt-3 space-y-4">
                  {categoryGroups.map((group) => (
                    <div key={group.labelKey}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t(group.labelKey)}</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {group.items.map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            aria-pressed={category === item.value}
                            onClick={() => setCategory(category === item.value ? null : item.value)}
                            className={clsx(
                              "flex min-h-12 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                              category === item.value ? "border-primary bg-primary-container text-text" : "border-border text-text hover:bg-surface-muted"
                            )}
                          >
                            {category === item.value ? (
                              <Check size={16} className="shrink-0 text-primary" aria-hidden="true" />
                            ) : (
                              <item.icon size={16} className="shrink-0 text-icon" aria-hidden="true" />
                            )}
                            <span className="leading-tight">{categoryLabel(item.value)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}

          {step === "role" && (
            <>
              {summary || category ? (
                <div className="mb-4 flex items-start gap-3 rounded-2xl bg-surface-muted px-4 py-3">
                  <Sparkles size={18} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-text">{t("setup.role.understood")}</p>
                    {summary ? <p className="mt-0.5 text-text">{summary}</p> : null}
                    {category ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowList(true);
                          setStep("work");
                        }}
                        className="mt-1 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        {categoryLabel(category)} · {t("setup.role.change")}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <h2 className="text-xl font-bold text-text">{t("setup.role.title")}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("setup.role.subtitle")}</p>
              <div className="mt-4 space-y-2.5">
                {ROLE_OPTIONS.map(({ value, icon: Icon }) => {
                  const selected = roles.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setRoles((r) => (selected ? r.filter((x) => x !== value) : [...r, value]))}
                      className={choice(selected)}
                    >
                      {selected ? <Check size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" /> : <Icon size={20} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />}
                      <span>
                        <span className="block text-base font-bold text-text">{t(`setup.role.${value}.title`)}</span>
                        <span className="mt-0.5 block text-sm text-text-muted">{t(`setup.role.${value}.body`)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === "online" && (
            <>
              <h2 className="text-xl font-bold text-text">{t("setup.online.title")}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("setup.online.subtitle")}</p>
              <div className="mt-4 space-y-2.5">
                <button type="button" aria-pressed={online?.length === 0} onClick={() => setOnline([])} className={choice(online?.length === 0)}>
                  {online?.length === 0 ? <Check size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" /> : <Store size={20} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />}
                  <span className="text-base font-bold text-text">{t("setup.online.no")}</span>
                </button>
                {ONLINE_OPTIONS.map((ch) => {
                  const selected = online?.includes(ch) ?? false;
                  return (
                    <button
                      key={ch}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setOnline((o) => (selected ? (o ?? []).filter((x) => x !== ch) : [...(o ?? []), ch]))}
                      className={choice(selected)}
                    >
                      {selected ? <Check size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" /> : ch === "phone" ? <Phone size={20} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" /> : <Globe size={20} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />}
                      <span>
                        <span className="block text-base font-bold text-text">{t(`setup.online.${ch}.title`)}</span>
                        <span className="mt-0.5 block text-sm text-text-muted">{t(`setup.online.${ch}.body`)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {online?.includes("website") ? (
                <label className="mt-4 block text-sm font-semibold text-text">
                  {t("setup.online.urlLabel")}
                  <input
                    value={storeUrl}
                    onChange={(e) => setStoreUrl(e.target.value)}
                    inputMode="url"
                    placeholder="www.myshop.in"
                    className="mt-1.5 h-12 w-full rounded-xl border border-border bg-surface px-3 text-base font-normal outline-none focus:border-primary"
                  />
                </label>
              ) : null}
            </>
          )}

          {step === "gst" && (
            <>
              <h2 className="text-xl font-bold text-text">{t("setup.gst.title")}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("setup.gst.subtitle")}</p>
              <div className="mt-4 space-y-2.5">
                {([
                  [true, "yes"],
                  [false, "no"],
                  [null, "unsure"],
                ] as const).map(([value, key]) => (
                  <button key={key} type="button" aria-pressed={hasGst === value} onClick={() => setHasGst(value)} className={choice(hasGst === value)}>
                    {hasGst === value ? <Check size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" /> : <ReceiptText size={20} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />}
                    <span>
                      <span className="block text-base font-bold text-text">{t(`setup.gst.${key}.title`)}</span>
                      <span className="mt-0.5 block text-sm text-text-muted">{t(`setup.gst.${key}.body`)}</span>
                    </span>
                  </button>
                ))}
              </div>
              {hasGst === true ? (
                <label className="mt-4 block text-sm font-semibold text-text">
                  {t("setup.gst.gstinLabel")}
                  <input
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase().slice(0, 15))}
                    placeholder="27ABCDE1234F1Z5"
                    className={clsx(
                      "mt-1.5 h-12 w-full rounded-xl border bg-surface px-3 text-base font-normal uppercase tracking-wide outline-none focus:border-primary",
                      gstinInvalid ? "border-danger" : "border-border"
                    )}
                  />
                  <span className={clsx("mt-1 block text-xs font-normal", gstinInvalid ? "font-semibold text-danger" : "text-text-muted")}>
                    {gstinInvalid ? t("businessSettings.gstinInvalid") : t("setup.gst.gstinHint")}
                  </span>
                </label>
              ) : null}
            </>
          )}

          {step === "size" && (
            <>
              <h2 className="text-xl font-bold text-text">{t("setup.size.title")}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("setup.size.subtitle")}</p>
              <p className="mt-5 text-sm font-semibold text-text">{t("setup.size.bills")}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {ORDER_VOLUMES.map((v) => (
                  <button key={v} type="button" aria-pressed={orderVolume === v} className={clsx(chip(orderVolume === v), "rounded-xl")} onClick={() => setOrderVolume(v)}>
                    {orderVolumeLabel(v)}
                  </button>
                ))}
              </div>
              <p className="mt-5 text-sm font-semibold text-text">{t("setup.size.staff")}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {STAFF_OPTIONS.map((o) => (
                  <button key={o.key} type="button" aria-pressed={staffCount === o.value} className={clsx(chip(staffCount === o.value), "rounded-xl")} onClick={() => setStaffCount(o.value)}>
                    {t(`setup.size.staffOptions.${o.key}`)}
                  </button>
                ))}
              </div>
              <p className="mt-5 text-sm font-semibold text-text">{t("setup.size.godowns")}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {GODOWN_OPTIONS.map((o) => (
                  <button key={o.key} type="button" aria-pressed={warehouseCount === o.value} className={clsx(chip(warehouseCount === o.value), "rounded-xl")} onClick={() => setWarehouseCount(o.value)}>
                    {t(`setup.size.godownOptions.${o.key}`)}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "plans" && (
            <>
              <h2 className="text-xl font-bold text-text">{t("setup.plans.title")}</h2>
              <p className="mt-1 text-sm text-text-muted">{aiSetups ? t("setup.plans.aiSubtitle") : t("setup.plans.subtitle")}</p>
              <div className="mt-4 space-y-3">
                {options.map((option, index) => {
                  const Icon = TEMPLATE_ICONS[option.base];
                  const selected = chosen?.id === option.id;
                  return (
                    <button key={option.id} type="button" aria-pressed={selected} onClick={() => setChosenId(option.id)} className={clsx(choice(selected), "flex-col gap-2")}>
                      <span className="flex w-full items-start gap-3">
                        <Icon size={22} className="mt-0.5 shrink-0 text-icon" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-bold text-text">{option.name}</span>
                            {index === 0 ? (
                              <span className="rounded-full border border-primary/40 bg-primary-container px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-on-primary-container">{t("setup.plans.recommended")}</span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-sm text-text-muted">{option.tagline}</span>
                        </span>
                        <span
                          className={clsx(
                            "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                            selected ? "border-primary bg-primary text-on-primary" : "border-border"
                          )}
                          aria-hidden="true"
                        >
                          {selected ? <Check size={12} strokeWidth={3} /> : null}
                        </span>
                      </span>
                      <ul className="ml-9 space-y-1">
                        {option.points.map((p) => (
                          <li key={p} className="flex items-start gap-2 text-sm text-text">
                            <Check size={14} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-text-muted">{t("setup.plans.changeLater")}</p>
            </>
          )}

          {step === "saving" && (
            <div className="flex flex-col items-center py-12 text-center">
              <Loader2 size={30} className="animate-spin text-icon" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-bold text-text">{t("setup.saving.title")}</h2>
              <p className="mt-1 text-sm text-text-muted">{t("setup.saving.body")}</p>
            </div>
          )}

          {step === "done" && chosen && (
            <div className="py-4">
              <div className="flex flex-col items-center text-center">
                <Check size={34} className="text-success" aria-hidden="true" />
                <h2 className="mt-3 text-xl font-bold text-text">{t("setup.done.title")}</h2>
                <p className="mt-1 text-sm text-text-muted">{t("setup.done.body", { setup: chosen.name })}</p>
              </div>
              <p className="mt-6 text-sm font-semibold text-text">{t("setup.done.nextTitle")}</p>
              <div className="mt-2 space-y-2">
                {[
                  { key: "items", icon: PackagePlus, go: () => navigate("/app/inventory") },
                  { key: "billDetails", icon: Settings2, go: () => navigate("/app/settings?tab=invoice") },
                  { key: "firstBill", icon: ReceiptText, go: () => openNewSale() },
                ].map((s, i) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      onClose();
                      s.go();
                    }}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border px-4 text-left outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-xs font-bold text-text">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-text">{t(`setup.done.steps.${s.key}.title`)}</span>
                      <span className="block text-xs text-text-muted">{t(`setup.done.steps.${s.key}.body`)}</span>
                    </span>
                    <s.icon size={18} className="shrink-0 text-icon" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {stepIndex >= 0 ? (
          <div className="border-t border-border bg-surface-muted px-5 py-3.5">
            <Button className="w-full" disabled={!canNext} isLoading={understand.isPending || plan.isPending} onClick={next}>
              {understand.isPending
                ? t("setup.work.understanding")
                : plan.isPending
                  ? t("setup.plans.making")
                  : step === "plans"
                    ? t("setup.plans.start")
                    : t("onboarding.continue")}
            </Button>
          </div>
        ) : step === "done" ? (
          <div className="border-t border-border bg-surface-muted px-5 py-3.5">
            <Button variant="secondary" className="w-full" onClick={onClose}>
              {t("setup.done.dashboard")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
