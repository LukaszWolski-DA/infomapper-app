import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDataStore } from "@/data";
import type { AppUser } from "@/domain/types";
import { DEV_SESSION_COOKIE, userIdFromDevCookie } from "./dev-session";

/** The signed-in user, or null. Refuses the development cookie in production and ids of unknown users. */
export async function getSessionUser(): Promise<AppUser | null> {
  const userId = userIdFromDevCookie((await cookies()).get(DEV_SESSION_COOKIE)?.value);
  if (!userId) return null;
  return getDataStore().users.get(userId);
}

/** The signed-in user; without a valid session, redirects to /sign-in. */
export async function requireSessionUser(): Promise<AppUser> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return user;
}
