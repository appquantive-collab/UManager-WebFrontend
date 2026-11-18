import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { tutorialSlides } from "../lib/tutorial";
import { LanguageSwitcher } from "./LanguageSwitcher";

function formatTime(seconds: number): string {
  const whole = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function TutorialVideo({ slide, onEnded, onError }: {
  slide: (typeof tutorialSlides)[number];
  onEnded: () => void;
  onError: () => void;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsPlay, setNeedsPlay] = useState(false);
  const [playback, setPlayback] = useState({ playing: false, muted: false, current: 0, duration: 0 });

  const syncPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    setPlayback({
      playing: !video.paused,
      muted: video.muted || video.volume === 0,
      current: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
    });
  };

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

  const controlClass = "flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white";

  return (
    <>
      <video
        ref={videoRef}
        src={`/tutorial/${slide}.mp4`}
        poster={`/tutorial/${slide}.jpg`}
        aria-label={t(`tutorial.slides.${slide}.title`)}
        className="h-full w-full object-cover"
        muted={false}
        playsInline
        controls={false}
        preload="auto"
        onPlay={() => { setNeedsPlay(false); syncPlayback(); }}
        onPause={syncPlayback}
        onTimeUpdate={syncPlayback}
        onLoadedMetadata={syncPlayback}
        onDurationChange={syncPlayback}
        onVolumeChange={syncPlayback}
        onEmptied={syncPlayback}
        onEnded={onEnded}
        onError={onError}
      />
      <div role="group" aria-label={t("tutorial.controls")} className="absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-black/95 to-black/65 px-3 pb-2 text-white">
        <div className="flex items-center gap-1">
          <button type="button" className={controlClass} aria-label={t(playback.playing ? "tutorial.pause" : "tutorial.play")} onClick={() => { if (videoRef.current?.paused) play(); else videoRef.current?.pause(); }}>
            {playback.playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
          </button>
          <span className="flex-1 whitespace-nowrap text-xs tabular-nums">{formatTime(playback.current)} / {formatTime(playback.duration)}</span>
          <button type="button" className={controlClass} aria-label={t("tutorial.replay")} onClick={() => { if (videoRef.current) videoRef.current.currentTime = 0; play(); }}>
            <RotateCcw size={18} aria-hidden="true" />
          </button>
          <button type="button" className={controlClass} aria-label={t(playback.muted ? "tutorial.unmute" : "tutorial.mute")} onClick={() => { const video = videoRef.current; if (video) { video.muted = !playback.muted; if (!video.muted && video.volume === 0) video.volume = 1; } }}>
            {playback.muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={playback.duration || 1}
          step={0.1}
          value={Math.min(playback.current, playback.duration || 1)}
          disabled={!playback.duration}
          aria-label={t("tutorial.seek")}
          aria-valuetext={`${formatTime(playback.current)} / ${formatTime(playback.duration)}`}
          onChange={(event) => { if (videoRef.current) videoRef.current.currentTime = Number(event.target.value); }}
          className="block h-6 w-full cursor-pointer accent-white"
        />
      </div>
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
          <div>
            <p className="text-xs font-bold text-primary">{t("brand.name")}</p>
            <h1 id="tutorial-heading" className="text-lg font-bold text-text">{t("tutorial.title")}</h1>
          </div>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="mx-auto grid min-h-0 w-full max-w-5xl flex-1 grid-rows-[minmax(150px,1fr)_auto] gap-4 lg:grid-cols-2 lg:grid-rows-1 lg:gap-12">
        <div className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-black">
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

        <div className="flex flex-col justify-center lg:py-10">
          <div aria-live="polite" aria-atomic="true">
            <p className="text-xs font-bold tracking-wide text-primary">
              {t("tutorial.step", { current: index + 1, total: tutorialSlides.length })}
            </p>
            <h2 className="mt-2 text-2xl font-extrabold leading-tight text-text lg:text-4xl">
              {t(`tutorial.slides.${slide}.title`)}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-subtle lg:mt-4 lg:text-lg">
              {t(`tutorial.slides.${slide}.description`)}
            </p>
          </div>
          <p className="mt-2 text-xs text-text-subtle lg:mt-6">{t("tutorial.soundHint")}</p>
        </div>
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
