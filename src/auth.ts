/**
 * Dashboard authentication.
 *
 * SECURITY MODEL: the repository is public, so the password itself is NEVER
 * stored anywhere in the codebase. Only a random salt and a PBKDF2-SHA256
 * hash (150,000 iterations) are embedded — the password cannot be derived
 * from them. Verification happens locally in the browser via WebCrypto.
 *
 * To change the password, run:
 *   node -e "const c=require('crypto');const p=process.argv[1];const s=c.randomBytes(16).toString('hex');console.log('SALT',s);console.log('HASH',c.pbkdf2Sync(p,Buffer.from(s,'hex'),150000,32,'sha256').toString('hex'))" 'NewPassword'
 * and paste the new SALT/HASH below.
 */

export const AUTH_USER = 'HeliStudio';
const SALT_HEX = 'b62cf4f83d98499d551df0b1965a46c7';
const HASH_HEX = 'e58610afe69f6b4cb9a51cad18d4e19fe43307b74a0f9595086919a2737f63b7';
const ITERATIONS = 150000;

const SESSION_KEY = 'heli_dash_session_v1';

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  if (username.trim() !== AUTH_USER) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: hexToBytes(SALT_HEX) as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
      key,
      256
    );
    return bytesToHex(bits) === HASH_HEX;
  } catch {
    return false;
  }
}

export function isAuthed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1' || localStorage.getItem(SESSION_KEY) === '1';
  } catch { return false; }
}

export function setAuthed(remember: boolean) {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
    if (remember) localStorage.setItem(SESSION_KEY, '1');
  } catch { /* ignore */ }
}

export function logout() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}
