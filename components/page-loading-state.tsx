import { Skeleton } from "@/components/ui/kit";

/** Route-level skeleton: mirrors the hero + KPI + two-card layout most pages use. */
export function PageLoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="h-full overflow-hidden" aria-busy="true" aria-label={label}>
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 md:pt-6 lg:px-8">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-20 rounded-2xl" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
