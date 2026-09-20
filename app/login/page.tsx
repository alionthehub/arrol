import { isPasswordConfigured } from "@/lib/auth";
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

  return (
    <LoginGate passwordConfigured={isPasswordConfigured()} />
  );
}
