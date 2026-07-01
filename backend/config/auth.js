const DEFAULT_JWT_EXPIRES_IN = '7d';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }

    console.warn('[AUTH] JWT_SECRET is missing. Using development-only secret.');
    return 'dev_only_pos_secret_change_me';
  }

  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }

  return secret;
}

export function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN;
}
