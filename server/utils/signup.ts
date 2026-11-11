import { normalizePhoneNumber } from '../services/linq';

export type BuyerSignupInput = {
  name: string;
  email: string;
  password: string;
  phone?: string | null;
};

export class SignupInputError extends Error {}

export function parseBuyerSignupInput(payload: unknown): BuyerSignupInput {
  const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';

  if (name.length < 2) throw new SignupInputError('Enter your full name');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new SignupInputError('Enter a valid email address');
  if (password.length < 8) throw new SignupInputError('Password must be at least 8 characters');

  let phone: string | null = null;
  if (rawPhone) {
    phone = normalizePhoneNumber(rawPhone);
    if (!phone || phone.length < 8) {
      throw new SignupInputError('Enter a valid mobile phone number');
    }
  }

  return { name, email, password, phone };
}

export function isUniqueSignupConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
}