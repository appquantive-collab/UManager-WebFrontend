import { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID, GOOGLE_SCRIPT, loadScript } from "../../lib/social-auth";

/** Google's official "Continue with Google" button (Google requires its own rendering). */
export function GoogleSignInButton({
  onCredential,
  locale,
  width,
}: {
  onCredential: (credential: string) => void;
  locale: string;
  width: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [failed, setFailed] = useState(false);

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
        if (cancelled || !containerRef.current || !google) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => callbackRef.current(response.credential),
          ux_mode: "popup",
        });
        google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "left",
          locale,
          width,
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, width]);

  if (!GOOGLE_CLIENT_ID || failed) return null;
  return <div ref={containerRef} className="flex min-h-10 justify-center" />;
}
