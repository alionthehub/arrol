import { HudRoute } from "@/app/(console)/hud-route";

export const metadata = {
  title: "WALL",
};

export default async function WallPage() {
  return <HudRoute interactive={false} />;
}
