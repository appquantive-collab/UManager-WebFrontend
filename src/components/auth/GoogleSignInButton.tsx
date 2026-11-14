import { useEffect, useRef, useState, type ReactNode } from "react";
import { GOOGLE_CLIENT_ID, GOOGLE_SCRIPT, loadScript } from "../../lib/social-auth";

/**
 * "Continue with Google". Google only signs in through its own button, drawn
 * in a frame that ignores our sizes and language. So we show our own face
 * (`children`, matching the other buttons) and lay Google's real button over
 * it, invisible, so the tap still lands on Google's button. If Google's script
 * can't load, the face's own onClick (`onUnavailable`) runs instead.
 */
export function GoogleSignInButton({
  onCredential,
  onUnavailable,
  locale,
  width,
  children,
}: {
  onCredential: (credential: string) => void;
  onUnavailable: () => void;
  locale: string;
  width: number;
  children: ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    callbackRef.current = onCredential;
  });

  useEffect(() => {
    const clientId = GOOGLE_CLIENT_ID;
    if (!clientId) return;
    let cancelled = false;
    loadScript(GOOGLE_SCRIPT)
      .then(() => {
        const google = window.google;
        if (cancelled || !overlayRef.current || !google) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => callbackRef.current(response.credential),
          ux_mode: "popup",
        });
        google.accounts.id.renderButton(overlayRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "left",
          locale,
          width,
        });
        setReady(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [locale, width]);

  return (
    <div className="group relative mx-auto h-10 max-w-full overflow-hidden rounded-full" style={{ width }}>
      <button
        type="button"
        tabIndex={ready ? -1 : 0}
        aria-hidden={ready ? true : undefined}
        onClick={onUnavailable}
        className="flex h-full w-full items-center justify-center gap-2.5 rounded-full border border-border bg-white text-sm font-semibold text-[#1f1f1f] outline-none transition-colors group-hover:bg-[#f8f9fa] group-focus-within:ring-2 group-focus-within:ring-primary/40"
      >
        {children}
      </button>
      {/* Google's real button: invisible, stretched over the face, takes the tap. */}
      <div
        ref={overlayRef}
        className="absolute inset-0 flex items-center justify-center opacity-[0.01] [&_iframe]:!m-0"
        style={{ colorScheme: "light" }}
      />
    </div>
  );
}
