export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#082B41] px-4 py-10">
      {/* Layered atmosphere on a deep petrol canvas: a fine architectural grid for
          structure, one off-centre glow for depth, and a whisper of grain for
          tactility. Calm and institutional rather than decorative. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #FFFFFF 1px, transparent 1px)," +
            "linear-gradient(to bottom, #FFFFFF 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(80% 70% at 50% 40%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(80% 70% at 50% 40%, black, transparent 75%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(52% 44% at 22% 8%, rgba(79,163,188,0.34), transparent 62%)," +
            "radial-gradient(44% 40% at 86% 88%, rgba(191,216,225,0.16), transparent 62%)," +
            "radial-gradient(90% 70% at 50% 105%, rgba(3,15,23,0.72), transparent 72%)",
        }}
        aria-hidden
      />
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay" aria-hidden />

      <div className="relative z-10 w-full max-w-[25rem] animate-fade-in-up">{children}</div>
    </div>
  )
}
