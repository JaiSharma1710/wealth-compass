export function SectionPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-[calc(100svh-6rem)] flex-col gap-3">
      <section className="rounded-[1.75rem] border border-black/5 bg-white px-5 py-4 shadow-sm">
        <h1 className="text-[1.55rem] font-semibold tracking-tight text-neutral-950 sm:text-[1.75rem]">
          {title}
        </h1>
      </section>

      <section className="flex-1 rounded-[1.75rem] border border-dashed border-neutral-200 bg-white/75 shadow-sm" />
    </div>
  );
}
