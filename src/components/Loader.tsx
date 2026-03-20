export default function Loader() {
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-4 px-4">
        <div className="relative w-full aspect-[2.2/1]">
          {/* Samo traka rute (pešačenje) */}
          <svg
            className="h-full w-full"
            viewBox="0 0 240 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Blago vidljiva baza rute */}
            <path
              d="M24 96 C 60 72, 92 106, 122 80 S 166 52, 216 62"
              stroke="rgb(5 150 105 / 0.18)"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Animated dashed route */}
            <path
              d="M24 96 C 60 72, 92 106, 122 80 S 166 52, 216 62"
              stroke="rgb(5 150 105 / 0.95)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="10 12"
              className="route-dash"
            />
          </svg>
          {/* Start pin */}
          <div
            className="absolute left-[10%] top-[80%] -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <div className="relative h-3 w-3">
              <div className="absolute inset-0 rounded-full bg-emerald-700" />
              <div className="absolute -inset-4 animate-ping rounded-full border border-emerald-500/60" />
            </div>
          </div>

          {/* Endpoint pin */}
          <div
            className="absolute left-[90%] top-[52%] -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <div className="relative h-3.5 w-3.5">
              <div className="absolute inset-0 rounded-full bg-emerald-900" />
              <div className="absolute -inset-4 animate-ping rounded-full border border-emerald-600/60" />
              <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}