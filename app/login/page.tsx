import { enrollmentState, type Enrollment } from "@/lib/security/auth-flow";
import { isAuthenticated } from "@/lib/session";
import { redirect } from "next/navigation";
import { LoginGate } from "./login-gate";

export const metadata = {
  title: "AUTHENTICATE",
};

export default async function LoginPage() {
  if (await isAuthenticated()) {
    redirect("/today");
  }

  let enrollment: Enrollment | "offline" = "offline";
  try {
    enrollment = await enrollmentState();
  } catch {
    enrollment = "offline";
  }

  return <LoginGate enrollment={enrollment} />;
}
