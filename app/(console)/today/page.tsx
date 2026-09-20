import { HudRoute } from "@/app/(console)/hud-route";

export const metadata = {
  title: "CORE",
};

export default async function TodayPage() {
  return <HudRoute interactive />;
}
