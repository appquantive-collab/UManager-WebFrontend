// Google's and Apple's own sign-in scripts. Each button appears only when its
// client ID is configured (VITE_GOOGLE_CLIENT_ID / VITE_APPLE_CLIENT_ID); the
// backend verifies the returned ID token with the same IDs.

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined;

export const googleSignInEnabled = Boolean(GOOGLE_CLIENT_ID);
export const appleSignInEnabled = Boolean(APPLE_CLIENT_ID);

export const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";
const APPLE_SCRIPT = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

interface GoogleIdentity {
  initialize(config: { client_id: string; callback: (response: { credential: string }) => void; ux_mode?: "popup" }): void;
  renderButton(element: HTMLElement, options: Record<string, string | number>): void;
}

interface AppleSignInResponse {
  authorization: { id_token: string };
  user?: { name?: { firstName?: string; lastName?: string } };
}

interface AppleIdentity {
  auth: {
    init(config: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }): void;
    signIn(): Promise<AppleSignInResponse>;
  };
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
    AppleID?: AppleIdentity;
  }
}

const scripts = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  let loading = scripts.get(src);
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scripts.delete(src);
        reject(new Error(`Failed to load ${src}`));
      };
      document.head.appendChild(script);
    });
    scripts.set(src, loading);
  }
  return loading;
}

/** Load Apple's script ahead of time: its popup must open within the user's tap. */
export function preloadAppleSignIn() {
  if (APPLE_CLIENT_ID) void loadScript(APPLE_SCRIPT).catch(() => undefined);
}

export class AppleSignInCancelled extends Error {}

export async function signInWithApple(): Promise<{ idToken: string; name?: string }> {
  if (!APPLE_CLIENT_ID) throw new Error("Apple sign-in is not configured");
  if (!window.AppleID) await loadScript(APPLE_SCRIPT);
  const apple = window.AppleID;
  if (!apple) throw new Error("Apple sign-in failed to load");

  apple.auth.init({ clientId: APPLE_CLIENT_ID, scope: "name email", redirectURI: window.location.origin, usePopup: true });
  try {
    const response = await apple.auth.signIn();
    const name = [response.user?.name?.firstName, response.user?.name?.lastName].filter(Boolean).join(" ");
    return { idToken: response.authorization.id_token, name: name || undefined };
  } catch (err) {
    const code = (err as { error?: string })?.error;
    if (code === "popup_closed_by_user" || code === "user_cancelled_authorize") throw new AppleSignInCancelled();
    throw err;
  }
}
