// #book-ref ch04-password-utils
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12; // 越大越安全，也越慢；12 是合理的平衡点

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
// #endbook-ref
