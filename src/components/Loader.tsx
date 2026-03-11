export default function Loader() {
    return (
      <div className="fixed inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-[3px] border-emerald-500 border-t-transparent animate-spin" />
        <p className="text-sm text-emerald-700">Loading</p>
      </div>
    </div>
      )}