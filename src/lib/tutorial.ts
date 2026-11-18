export const TUTORIAL_STORAGE_KEY = "voicemunshi.tutorial.v1";
export const SIGNED_IN_STORAGE_KEY = "voicemunshi.hasSignedIn";

export const tutorialSlides = ["ai", "voice", "billing", "welcome"] as const;

export function hasSignedInBefore(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_STORAGE_KEY) === "yes";
  } catch {
    return false;
  }
}

export function rememberSignedIn(): void {
  try {
    localStorage.setItem(SIGNED_IN_STORAGE_KEY, "yes");
    completeTutorial();
  } catch {
    // A storage failure must not prevent signing in.
  }
}

export function shouldShowTutorial(): boolean {
  // The team console has a separate sign-in experience.
  if (/^\/admin(?:\/|$)/.test(window.location.pathname)) return false;
  if (hasSignedInBefore()) return false;
  try {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) !== "done";
  } catch {
    return true;
  }
}

export function completeTutorial(): void {
  try {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "done");
  } catch {
    // Still let the visitor continue if browser storage is unavailable.
  }
}
