/*
 * A soft, client-side dev gate — NOT real security.
 *
 * There's no backend, so this check runs entirely in the browser: the password
 * is compared against a stored SHA-256 hash (so the literal string isn't in the
 * repo), but a determined visitor can still read the bundle or bypass the check
 * in dev tools. It's here to keep casual visitors out of a dev build, nothing
 * more. Real auth needs a server (or a hosted auth provider).
 *
 * Dev credentials: user "dev", password "bramwell2026". Change the user below
 * and drop in a new hash (see the note) to rotate them.
 */

export const DEV_USER = "dev";

// SHA-256 of the dev password. To change it:
//   node -e "console.log(require('crypto').createHash('sha256').update('NEWPASS').digest('hex'))"
const PASS_HASH = "98b79f2a23a56714b07b1da8eff4e4ec782143d05f505195a55f8dc21dbfaf3d";

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** True when the username and password match the dev credentials. */
export async function checkLogin(user: string, pass: string): Promise<boolean> {
  if (user.trim().toLowerCase() !== DEV_USER) return false;
  try {
    return (await sha256Hex(pass)) === PASS_HASH;
  } catch {
    return false; // crypto.subtle needs a secure context (https/localhost)
  }
}
