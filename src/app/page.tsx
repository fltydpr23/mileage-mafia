import UnifiedGateway from "@/components/UnifiedGateway";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <Suspense fallback={<div className="w-full h-screen bg-[#050505]" />}>
      <UnifiedGateway />
    </Suspense>
  );
}
