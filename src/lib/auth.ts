export const AUTH_KEY = "mm_authed_v1";

export function isAuthed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTH_KEY) === "1";
}

export function setAuthed() {
  localStorage.setItem(AUTH_KEY, "1");
}

export function clearAuthed() {
  localStorage.removeItem(AUTH_KEY);
}