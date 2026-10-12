// Server Component so params can be awaited directly instead of via the
// client `use()` hook — StageTabBar (usePathname, framer-motion) is the
// only client-only part, and it gets its own local Suspense boundary here
// rather than relying on the ancestor boundary in stages/layout.tsx, which
// doesn't reliably cover a same-level dynamic-segment layout (loading.tsx
// only wraps the page, not the layout beside it).
import { Suspense } from "react";
import StageTabBar from "./StageTabBar";

export default async function StageSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8">
      <Suspense fallback={null}>
        <StageTabBar slug={slug} />
      </Suspense>

      <div className="relative">{children}</div>
    </div>
  );
}
