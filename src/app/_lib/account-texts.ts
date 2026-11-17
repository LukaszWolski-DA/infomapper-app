// What the sign-in on Postgres says (slice 29, step 3). A plain module: a "use server" file may export only actions.

/** A refused sign-in: the same for an unknown address and a wrong password. */
export const ACCOUNT_SIGN_IN_REFUSED = "The e-mail address or the password is wrong.";
/** An Auth account that no person in InfoMapper is linked to (`app_user.auth_user_id`). */
export const ACCOUNT_WITHOUT_PERSON = "This account has no person in InfoMapper.";
