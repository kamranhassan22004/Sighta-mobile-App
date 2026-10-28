const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client();

async function verifyGoogleToken(idToken) {
  const audience = process.env.GOOGLE_WEB_CLIENT_ID;
  if (!audience) {
    const error = new Error("Google sign-in is not configured on the server.");
    error.status = 503;
    throw error;
  }
  try {
    const ticket = await client.verifyIdToken({ idToken, audience });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true ||
        !["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) {
      throw new Error("Unverified identity");
    }
    return payload;
  } catch {
    const error = new Error("Google identity could not be verified. Please sign in again.");
    error.status = 401;
    throw error;
  }
}
module.exports = { verifyGoogleToken };
