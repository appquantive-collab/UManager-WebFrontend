import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, Play, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { tutorialSlides } from "../lib/tutorial";
import { LanguageSwitcher } from "./LanguageSwitcher";

function TutorialVideo({ slide, onEnded, onError }: {
  slide: (typeof tutorialSlides)[number];
  onEnded: () => void;
  onError: () => void;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsPlay, setNeedsPlay] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let active = true;
    video.muted = false;
    video.volume = 1;
    // Some browsers require a tap before they allow playback with sound.
    void video.play().catch(() => {
      if (active && !video.error) setNeedsPlay(true);
    });
    return () => {
      active = false;
      video.pause();
    };
  }, [slide]);

  const playWithSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    void video.play().catch(() => setNeedsPlay(true));
  };

  const play = () => {
    void videoRef.current?.play().catch(() => setNeedsPlay(true));
  };

  return (
    <>
      <video
        ref={videoRef}
        src={`/tutorial/${slide}.mp4`}
        poster={`/tutorial/${slide}.jpg`}
        aria-label={t(`tutorial.slides.${slide}.title`)}
        // Whole frame always visible (the clips are 9:16); black fills any leftover space instead of cropping.
        className="h-full w-full object-contain"
        // No controls on screen: tapping the video pauses / resumes it.
        onClick={() => {
          const video = videoRef.current;
          if (!video) return;
          if (video.paused) play();
          else video.pause();
        }}
        muted={false}
        playsInline
        controls={false}
        preload="auto"
        onPlay={() => setNeedsPlay(false)}
        onEnded={onEnded}
        onError={onError}
      />
      {needsPlay && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <button
            type="button"
            onClick={playWithSound}
            className="pointer-events-auto flex min-h-12 max-w-[90%] items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-on-primary shadow-elevation-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Play size={20} aria-hidden="true" />
            {t("tutorial.playWithSound")}
          </button>
        </div>
      )}
    </>
  );
}

export function TutorialScreen({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const slide = tutorialSlides[index];

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    nextRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      // Let the language picker close itself first when its menu is open.
      if (event.key !== "Escape" || dialogRef.current?.querySelector('[aria-expanded="true"]')) return;
      event.preventDefault();
      onComplete();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onComplete]);

  const goToSlide = (next: number) => {
    setFailed(false);
    setIndex(next);
  };

  const next = () => {
    if (index === tutorialSlides.length - 1) onComplete();
    else goToSlide(index + 1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>("button, select, input:not(:disabled)");
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-heading"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-110 flex h-dvh flex-col overflow-y-auto bg-background px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] lg:px-12 lg:py-8"
    >
      <header className="mx-auto mb-4 flex w-full max-w-5xl shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="" className="h-10 w-10 rounded-xl" />
          <p className="text-sm font-bold text-primary">{t("brand.name")}</p>
          <h1 id="tutorial-heading" className="sr-only">{t("tutorial.title")}</h1>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col lg:max-w-3xl">
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black">
          {failed ? (
            <div role="status" className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-white">
              <p className="text-sm">{t("tutorial.videoError")}</p>
              <button
                type="button"
                onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-white/40 px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-white"
              >
                <RotateCcw size={16} aria-hidden="true" />{t("tutorial.retry")}
              </button>
            </div>
          ) : (
            <TutorialVideo
              key={attempt}
              slide={slide}
              onEnded={next}
              onError={() => setFailed(true)}
            />
          )}
        </div>
        {/* Which step it is, for screen readers only (no text on screen). */}
        <p className="sr-only" aria-live="polite">
          {t("tutorial.step", { current: index + 1, total: tutorialSlides.length })}: {t(`tutorial.slides.${slide}.title`)}
        </p>
      </main>

      <footer className="mx-auto mt-4 w-full max-w-5xl shrink-0">
        <nav aria-label={t("tutorial.slidesLabel")} className="mb-3 flex justify-center gap-1">
          {tutorialSlides.map((id, position) => (
            <button
              key={id}
              type="button"
              onClick={() => goToSlide(position)}
              aria-label={t("tutorial.goToSlide", { number: position + 1 })}
              aria-current={position === index ? "step" : undefined}
              className="flex h-8 min-w-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className={`h-2 rounded-full transition-all ${position === index ? "w-7 bg-primary" : "w-2 bg-border"}`} />
            </button>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-4">
          <button type="button" onClick={onComplete} className="min-h-12 rounded-xl px-5 text-sm font-bold text-text-subtle hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary">
            {t("tutorial.skip")}
          </button>
          <button ref={nextRef} type="button" onClick={next} className="flex min-h-12 min-w-36 items-center justify-center gap-3 rounded-xl bg-primary px-6 text-sm font-bold text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {t(index === tutorialSlides.length - 1 ? "tutorial.finish" : "tutorial.next")}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </div>
  );
}
