import { CountUp, TerminalFrame, TypeText } from "@/components/terminal";
import {
  EMPTY_LABEL,
  PLACEHOLDER_BANNER,
  TODAY_PLACEHOLDER,
  type StatusItem,
} from "@/lib/placeholders";
import { requireSession } from "@/lib/session";

export const metadata = {
  title: "TODAY",
};

export default async function TodayPage() {
  await requireSession();
  const data = TODAY_PLACEHOLDER;

  return (
    <div className="h-full overflow-auto px-3 py-4 sm:px-5">
      <div className="flex flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <TypeText
              as="h1"
              className="crt-aberrate crt-glow text-2xl tracking-[0.2em] sm:text-3xl"
              text="SYSTEM STATUS"
            />
            <p className="mt-1 text-[11px] tracking-widest text-amber">
              {PLACEHOLDER_BANNER}
            </p>
          </div>
          <p className="text-xs text-phosphor-dim">
            ITEMS <CountUp value={data.priority.length + data.schedule.length} />
          </p>
        </header>

        <ReadoutBlock title="PRIORITY" items={data.priority} />
        <ReadoutBlock title="SCHEDULE" items={data.schedule} />
        <ReadoutBlock title="INCOMING" items={data.incoming} />
      </div>
    </div>
  );
}

function ReadoutBlock({ title, items }: { title: string; items: StatusItem[] }) {
  return (
    <TerminalFrame title={title}>
      {items.length === 0 ? (
        <p className="py-3 text-center text-sm tracking-widest text-phosphor-dim">
          {EMPTY_LABEL}
        </p>
      ) : (
        <ul className="divide-y divide-phosphor/20">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5 text-sm"
            >
              <span className="w-4 shrink-0 text-ice" aria-hidden="true">
                {item.glyph}
              </span>
              <span className="min-w-0 flex-1 break-all tracking-wide">
                {item.title}
              </span>
              <span className="shrink-0 text-xs text-ice">{item.time}</span>
              <span
                className={
                  item.status === "FLAGGED" || item.status === "HOLD"
                    ? "shrink-0 text-xs tracking-widest text-amber"
                    : "shrink-0 text-xs tracking-widest text-phosphor-dim"
                }
              >
                {item.status}
              </span>
              <span className="shrink-0 text-[10px] tracking-widest text-phosphor-dim">
                PH
              </span>
            </li>
          ))}
        </ul>
      )}
    </TerminalFrame>
  );
}
