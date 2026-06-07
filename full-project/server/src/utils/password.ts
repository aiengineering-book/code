// #book-ref ch04-fullstack-basics/server/src/utils/password.ts

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12; // Higher = more secure but slower; 12 is a reasonable balance

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
