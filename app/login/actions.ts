"use server";

import { redirect } from "next/navigation";
import { isPasswordConfigured, passwordMatches } from "@/lib/auth";
import { writeSessionCookie } from "@/lib/session";

export type LoginState = {
  status: "idle" | "denied" | "unset";
  stamp?: number;
};

export async function authenticate(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isPasswordConfigured()) {
    return { status: "unset" };
  }

  const password = String(formData.get("password") ?? "");
  if (!passwordMatches(password)) {
    return { status: "denied", stamp: Date.now() };
  }

  await writeSessionCookie();
  redirect("/today");
}
