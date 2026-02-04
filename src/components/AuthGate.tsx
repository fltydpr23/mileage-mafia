"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAuthed } from "@/lib/auth";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Allow login page always
    if (pathname === "/") {
      setOk(true);
      return;
    }

    const authed = isAuthed(); // safe: runs only on client after mount
    setOk(authed);

    if (!authed) router.replace("/");
  }, [pathname, router]);

  // Prevent SSR/client mismatch
  if (!mounted) return null;

  // Block protected routes until auth is confirmed
  if (pathname !== "/" && !ok) return null;

  return <>{children}</>;
}
