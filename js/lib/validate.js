export const USERS = ['S', 'I'];
export const PASSWORD = 'SI96305';

export function checkLogin(username, password) {
  const name = String(username ?? '').trim().toLowerCase();
  const user = USERS.find((u) => u.toLowerCase() === name);
  if (!user) return { ok: false, error: 'Unknown username. Use S or I.' };
  if (String(password ?? '') !== PASSWORD) return { ok: false, error: 'Wrong password. Try again.' };
  return { ok: true, user };
}
