"use server";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDataStore } from "@/data";
import { isUuid } from "@/domain/ids";
import { DEV_SESSION_COOKIE, devCookieOptions, isDevSignInEnabled } from "../_lib/dev-session";

/** Development sign-in: signs in as the chosen seeded user. */
export async function signInAsDevUser(formData: FormData): Promise<void> {
  if (!isDevSignInEnabled()) notFound();
  const userId = formData.get("userId");
  if (!isUuid(userId) || !(await getDataStore().users.get(userId))) redirect("/sign-in");
  (await cookies()).set(DEV_SESSION_COOKIE, userId, devCookieOptions);
  redirect("/");
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(DEV_SESSION_COOKIE);
  redirect("/sign-in");
}
