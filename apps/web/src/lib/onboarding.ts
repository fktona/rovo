const prefix = "rovo:onboarding:";

export function onboardingSeen(userId: string): boolean {
  return window.localStorage.getItem(`${prefix}${userId}`) === "seen";
}

export function markOnboardingSeen(userId: string): void {
  window.localStorage.setItem(`${prefix}${userId}`, "seen");
}
