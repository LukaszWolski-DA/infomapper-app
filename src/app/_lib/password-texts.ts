// The texts of the people slice's password forms (slice 33; the prototype's `PPL`), shared by the server actions and
// the forms. A plain module: a "use server" file exports server actions only.

export const ENTER_CURRENT_PASSWORD = "Enter your current password.";
export const CURRENT_PASSWORD_WRONG = "The current password is not right. Nothing was changed.";
export const PASSWORD_CHANGED = "Password changed. Use the new one next time you sign in.";
export const ENTER_PASSWORD = "Enter your password.";
/** Supabase refused the password by a stricter rule of the project's (Q7). */
export const PASSWORD_REFUSED_BY_SERVER = "This server does not take this password: choose a stronger one.";
/** An Auth account with the invitation's e-mail that no person uses and no invitation of this link made (Q10). */
export const ACCOUNT_IN_THE_WAY = "This e-mail already has an account on this server that nobody uses. Ask the person who invited you.";
export const NOTHING_CHANGED = "Something went wrong. Nothing was changed.";
/** The hint under a new password's fields (the prototype's). */
export const PASSWORD_HINT = "At least 10 characters.";
