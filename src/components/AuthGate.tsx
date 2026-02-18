"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAuthed } from "@/lib/auth";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [ok, setOk] = useState(false);

  // Public routes that should NEVER be gated (prevents redirect loops in incognito)
  const isPublicRoute = useMemo(() => {
    if (!pathname) return true;
    return pathname === "/" || pathname === "/login";
  }, [pathname]);

  useEffect(() => {
    let alive = true;

    setMounted(true);

    // Always allow public routes
    if (isPublicRoute) {
      if (alive) setOk(true);
      return () => {
        alive = false;
      };
    }

    // Protected routes: check auth on client
    const authed = isAuthed();
    if (!alive) return () => {
      alive = false;
    };

    setOk(authed);

    // If not authed, send them to the password screen
    if (!authed) {
      router.replace("/");
    }

    return () => {
      alive = false;
    };
  }, [isPublicRoute, router, pathname]);

  // Prevent SSR/client mismatch flashes
  if (!mounted) return null;

  // Public routes are always visible
  if (isPublicRoute) return <>{children}</>;

  // Block protected routes until auth is confirmed
  if (!ok) return null;

  return <>{children}</>;
}
