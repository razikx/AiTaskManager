import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Extend Express Request interface to include authenticated user details
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

interface JWK {
  kty: string;
  use?: string;
  alg?: string;
  kid: string;
  crv?: string;
  x?: string;
  y?: string;
}

// Memory cache for JWKS keys to optimize request performance
let jwksCache: JWK[] | null = null;
let lastFetchedTime = 0;
let jwksFetchInFlight: Promise<JWK[]> | null = null; // In-flight lock to prevent thundering-herd duplicate fetches
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24-hour cache
const REFETCH_COOLDOWN = 5 * 60 * 1000; // 5-minute refetch cooldown

/**
 * Fetch JWKS keys from the Supabase endpoint
 */
async function fetchJWKS(jwksUrl: string, force = false): Promise<JWK[]> {
  const now = Date.now();
  if (jwksCache && !force && (now - lastFetchedTime < CACHE_TTL)) {
    return jwksCache;
  }

  if (force && (now - lastFetchedTime < REFETCH_COOLDOWN)) {
    // Keep using cache to prevent spamming the endpoint if cooldown hasn't expired
    return jwksCache || [];
  }

  // In-flight lock: share one pending fetch across concurrent requests
  if (jwksFetchInFlight) {
    return jwksFetchInFlight;
  }

  jwksFetchInFlight = (async () => {
    try {
      const response = await fetch(jwksUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch JWKS from ${jwksUrl}: ${response.statusText}`);
      }
      const data = (await response.json()) as { keys: JWK[] };
      jwksCache = data.keys;
      lastFetchedTime = Date.now();
      return jwksCache;
    } finally {
      jwksFetchInFlight = null;
    }
  })();

  return jwksFetchInFlight;
}

/**
 * Retrieves a public KeyObject matching the kid from JWKS URL
 */
async function getPublicKeyFromJWKS(jwksUrl: string, kid: string): Promise<crypto.KeyObject> {
  let keys = await fetchJWKS(jwksUrl);
  let jwk = keys.find((key) => key.kid === kid);

  // If key is not found, force a refetch (subject to the cooldown rate limit)
  if (!jwk) {
    keys = await fetchJWKS(jwksUrl, true);
    jwk = keys.find((key) => key.kid === kid);
  }

  if (!jwk) {
    throw new Error(`JWK with kid "${kid}" not found in JWKS.`);
  }

  return crypto.createPublicKey({
    key: jwk as any,
    format: 'jwk',
  });
}

/**
 * Express middleware to authenticate incoming client requests using local JWT signature checks.
 * Supports both standard HS256 (via shared secret) and ES256 (via static public key or dynamic JWKS URL).
 */
export async function authGuard(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  // 1. Check for presence and formatting of Bearer token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access denied. Authorization header with Bearer token is required.'
      }
    });
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;

  try {
    // 2. Perform stateless cryptographic verification of signature and expiration
    // Support both symmetric HS256 and asymmetric ES256 signing keys dynamically
    const decodedToken = jwt.decode(token, { complete: true }) as {
      header: { alg: string; kid?: string };
    } | null;

    const alg = decodedToken?.header?.alg || 'HS256';
    let decoded: {
      sub: string;
      email: string;
      role?: string;
    };

    if (alg === 'ES256') {
      const jwksUrl = process.env.SUPABASE_JWKS_URL;
      if (jwksUrl) {
        const kid = decodedToken?.header?.kid;
        if (!kid) {
          throw new Error('Token does not contain a Key ID (kid) header.');
        }
        const publicKey = await getPublicKeyFromJWKS(jwksUrl, kid);
        decoded = jwt.verify(token, publicKey, {
          algorithms: ['ES256']
        }) as typeof decoded;
      } else {
        // Fallback to static public key PEM if JWKS URL isn't configured
        const publicKey = process.env.SUPABASE_JWT_PUBLIC_KEY || jwtSecret;
        if (!publicKey) {
          throw new Error('Public key (SUPABASE_JWT_PUBLIC_KEY or SUPABASE_JWKS_URL) is required for ES256 verification.');
        }
        // Re-format single-line env variable public keys by converting '\n' back to true newlines
        const formattedKey = publicKey.includes('-----BEGIN')
          ? publicKey.replace(/\\n/g, '\n')
          : publicKey;

        decoded = jwt.verify(token, formattedKey, {
          algorithms: ['ES256']
        }) as typeof decoded;
      }
    } else {
      // Ensure secret is present in environment
      if (!jwtSecret) {
        throw new Error('SUPABASE_JWT_SECRET is missing from environment variables.');
      }
      try {
        decoded = jwt.verify(token, jwtSecret, {
          algorithms: ['HS256']
        }) as typeof decoded;
      } catch (rawError) {
        try {
          const decodedSecret = Buffer.from(jwtSecret, 'base64');
          decoded = jwt.verify(token, decodedSecret, {
            algorithms: ['HS256']
          }) as typeof decoded;
        } catch (base64Error) {
          throw rawError;
        }
      }
    }

    // Ensure user role is authenticated (prevent anon bypass)
    if (decoded.role !== 'authenticated') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access denied. Authenticated user role is required.'
        }
      });
    }

    // 3. Inject authenticated user payload into request context
    req.user = {
      id: decoded.sub,
      email: decoded.email
    };

    return next();
  } catch (err) {
    // 4. Reject expired or malformed tokens with 401 Unauthorized (standard HTTP semantics)
    const errorDetails = err instanceof Error ? err.message : 'Unknown error';
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is invalid, malformed, or expired.',
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      }
    });
  }
}
