import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <p className="hud-mono tracking-[0.22em] text-stale">! 404 NO SUCH VOLUME</p>
      <Link href="/today" className="hud-btn">
        RETURN
      </Link>
    </div>
  );
}
