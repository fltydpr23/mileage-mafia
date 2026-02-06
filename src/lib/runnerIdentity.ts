const KEY = "mm_runner_v1";

export function getRunnerIdentity(): string | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v && v.trim().length ? v : null;
}

export function setRunnerIdentity(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, name.trim());
}

export function clearRunnerIdentity() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
