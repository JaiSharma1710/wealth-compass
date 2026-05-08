export function SectionPage({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-full flex-col bg-[#f5f7fb]">
      <section className="flex h-full min-h-full flex-1 items-center justify-center border border-dashed border-[#d9dfeb] bg-[#f5f7fb] text-sm font-medium tracking-[0.02em] text-[#9aa3b2]">
        {title}
      </section>
    </div>
  );
}
