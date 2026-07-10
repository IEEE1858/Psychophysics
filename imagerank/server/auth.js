// Participant auth (issue #31): a small, dependency-free layer for optional
// sign-in. Sessions are HMAC-signed bearer tokens (same spirit as the
// hand-rolled scrypt hashing in db.js — no jsonwebtoken), and Google sign-in
// uses the server-side authorization-code flow with Node's global fetch (no
// google-auth-library).
const { createHmac, randomBytes, timingSafeEqual } = require("node:crypto");

// Signing secret for session + OAuth-state tokens. Required in production; in
// dev we fall back to an ephemeral random secret so `npm run dev` works without
// setup (tokens simply don't survive a server restart).
const TOKEN_SECRET =
  process.env.AUTH_TOKEN_SECRET || randomBytes(32).toString("hex");
if (!process.env.AUTH_TOKEN_SECRET) {
  console.warn(
    "AUTH_TOKEN_SECRET is not set — using an ephemeral secret; sessions will not survive a restart."
  );
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || "";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payloadB64) {
  return createHmac("sha256", TOKEN_SECRET).update(payloadB64).digest("base64url");
}

// Compare two base64url signatures in constant time.
function signaturesMatch(a, b) {
  const bufA = Buffer.from(a, "base64url");
  const bufB = Buffer.from(b, "base64url");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// Encode an arbitrary JSON payload as "<payload>.<signature>". Used for both
// session tokens and OAuth state.
function encodeToken(payload) {
  const payloadB64 = base64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

// Verify signature + expiry and return the payload, or null if invalid.
function decodeToken(token) {
  if (typeof token !== "string" || !token.includes(".")) {
    return null;
  }
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature || !signaturesMatch(signature, sign(payloadB64))) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (payload.exp != null && Date.now() > payload.exp) {
    return null;
  }
  return payload;
}

function signToken(accountId) {
  const now = Date.now();
  return encodeToken({ sub: Number(accountId), iat: now, exp: now + SESSION_TTL_MS });
}

// Pull a bearer token off the Authorization header and return its accountId.
function accountIdFromRequest(req) {
  const header = req.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }
  const payload = decodeToken(match[1]);
  return payload && payload.sub != null ? Number(payload.sub) : null;
}

// Attaches req.accountId (or null) and always continues — for endpoints that
// behave differently when signed in but must still serve anonymous callers.
function optionalAuth(req, _res, next) {
  req.accountId = accountIdFromRequest(req);
  next();
}

// Gates an endpoint on a valid session.
function requireAuth(req, res, next) {
  const accountId = accountIdFromRequest(req);
  if (accountId == null) {
    return res.status(401).json({ error: "Authentication required." });
  }
  req.accountId = accountId;
  next();
}

// --- Google OAuth -----------------------------------------------------------

function googleConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

// A short-lived signed nonce carried through the OAuth round-trip (stateless
// CSRF protection — no server-side session or cookie needed).
function signOAuthState() {
  return encodeToken({ nonce: randomBytes(16).toString("hex"), exp: Date.now() + STATE_TTL_MS });
}

function verifyOAuthState(state) {
  return decodeToken(state) != null;
}

function buildGoogleAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Decode a JWT payload without verifying the signature. Safe here: the id_token
// is received directly from Google's token endpoint over TLS in the code
// exchange below, so its origin is already authenticated.
function decodeJwtPayload(jwt) {
  const parts = String(jwt).split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// Exchange an authorization code for the user's identity. Returns
// { sub, email, emailVerified, name } or throws.
async function exchangeCodeForProfile(code) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google token exchange failed (${response.status}): ${detail}`);
  }

  const tokens = await response.json();
  const claims = decodeJwtPayload(tokens.id_token);
  if (!claims || !claims.sub || !claims.email) {
    throw new Error("Google id_token missing sub/email claims.");
  }
  return {
    sub: String(claims.sub),
    email: String(claims.email),
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: claims.name ? String(claims.name) : null,
  };
}

module.exports = {
  signToken,
  optionalAuth,
  requireAuth,
  googleConfigured,
  signOAuthState,
  verifyOAuthState,
  buildGoogleAuthUrl,
  exchangeCodeForProfile,
};
