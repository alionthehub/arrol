import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-void p-6 text-phosphor">
      <p className="tracking-[0.2em] text-deny">! 404 NO SUCH VOLUME</p>
      <Link href="/today" className="term-btn">
        RETURN
      </Link>
    </div>
  );
}
