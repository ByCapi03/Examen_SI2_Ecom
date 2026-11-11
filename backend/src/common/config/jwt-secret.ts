/** Secreto de los JWT. En producción es obligatorio: sin él cualquiera podría firmar sesiones. */
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET es obligatorio cuando NODE_ENV=production');
  return 'defaultSecret';
}
