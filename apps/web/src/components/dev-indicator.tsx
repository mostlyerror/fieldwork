export function DevIndicator() {
  const isProd =
    process.env.NEXT_PUBLIC_SUPABASE_URL ===
    process.env.NEXT_PUBLIC_SUPABASE_PROD_URL;

  if (isProd) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white opacity-70">
      Dev
    </div>
  );
}
