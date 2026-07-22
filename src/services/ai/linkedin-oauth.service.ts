import crypto from "node:crypto";
import { HttpError } from "@/lib/httpError.js";
import { getSetting } from "@/services/settings.service.js";
import * as claudeService from "@/services/ai/claude.service.js";
import type { CvData } from "@/lib/cvData.js";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const STATE_TTL_MS = 15 * 60 * 1000; // 15 menit

export interface LinkedInConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  isConfigured: boolean;
}

export interface LinkedInProfile {
  sub: string;
  name: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  email?: string;
  locale?: string;
}

/** Format rahasia internal untuk HMAC signing parameter state. */
function getSecretKey(): string {
  return process.env.ENCRYPTION_KEY || "linkedin-oauth-secret-key-fallback";
}

export async function getLinkedInConfig(): Promise<LinkedInConfig> {
  const clientId =
    (await getSetting("linkedin.clientId")) ||
    (await getSetting("linkedin_client_id")) ||
    "";
  const clientSecret =
    (await getSetting("linkedin.clientSecret")) ||
    (await getSetting("linkedin_client_secret")) ||
    "";
  const redirectUri =
    (await getSetting("linkedin.redirectUri")) ||
    (await getSetting("linkedin_redirect_uri")) ||
    (await getSetting("linkedin.callbackUrl")) ||
    (await getSetting("linkedin_callback_url")) ||
    "";
  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    redirectUri: redirectUri.trim(),
    isConfigured: clientId.trim().length > 0 && clientSecret.trim().length > 0,
  };
}

function resolveRedirectUri(configUri: string, clientUri?: string): string {
  const isInvalidOrWebhook = (url?: string) =>
    !url || url.toLowerCase().includes("webhook");

  if (clientUri && !isInvalidOrWebhook(clientUri)) {
    return clientUri.trim().replace(/\/+$/, "");
  }
  if (configUri && !isInvalidOrWebhook(configUri)) {
    return configUri.trim().replace(/\/+$/, "");
  }
  return "https://cv-builder.instif.id/auth/linkedin/callback";
}

/** Membikin parameter `state` ber-HMAC untuk cegah serangan CSRF. */
export function generateLinkedInState(userId: string): string {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = `${userId}:${timestamp}:${nonce}`;
  const hmac = crypto
    .createHmac("sha256", getSecretKey())
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

/** Memverifikasi keabsahan & kadaluarsa parameter `state`. */
export function verifyLinkedInState(
  state: string,
  expectedUserId: string
): boolean {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf-8");
    const parts = raw.split(":");
    if (parts.length !== 4) return false;
    const [userId, timestampStr, nonce, hmac] = parts;
    if (userId !== expectedUserId) return false;

    const timestamp = Number(timestampStr);
    if (isNaN(timestamp) || Date.now() - timestamp > STATE_TTL_MS) return false;

    const payload = `${userId}:${timestampStr}:${nonce}`;
    const expectedHmac = crypto
      .createHmac("sha256", getSecretKey())
      .update(payload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(hmac, "hex"),
      Buffer.from(expectedHmac, "hex")
    );
  } catch {
    return false;
  }
}

/** Membikin URL Otorisasi resmi LinkedIn. */
export async function getLinkedInAuthUrl(
  userId: string,
  redirectUri: string
): Promise<string> {
  const config = await getLinkedInConfig();
  if (!config.isConfigured) {
    throw new HttpError(
      503,
      "Integrasi resmi LinkedIn OAuth belum dikonfigurasi oleh admin. Silakan gunakan opsi Copy-Paste."
    );
  }

  const effectiveRedirectUri = resolveRedirectUri(
    config.redirectUri,
    redirectUri
  );
  const state = generateLinkedInState(userId);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: effectiveRedirectUri,
    state,
    scope: "openid profile email",
  });

  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

/** Menukar `authorization code` dengan `access_token` dari LinkedIn API. */
export async function exchangeCodeForAccessToken(
  code: string,
  redirectUri: string
): Promise<string> {
  const config = await getLinkedInConfig();
  if (!config.isConfigured) {
    throw new HttpError(503, "Kredensial LinkedIn OAuth belum dikonfigurasi");
  }

  const effectiveRedirectUri = resolveRedirectUri(
    config.redirectUri,
    redirectUri
  );
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: effectiveRedirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    throw new HttpError(
      400,
      `Gagal mengautentikasi dengan LinkedIn: ${
        errorJson.error_description || res.statusText
      }`
    );
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new HttpError(400, "Tidak mendapatkan access token dari LinkedIn");
  }

  return json.access_token;
}

/** Mengambil profil resmi user dari API UserInfo LinkedIn. */
export async function fetchLinkedInProfile(
  accessToken: string
): Promise<LinkedInProfile> {
  const res = await fetch(LINKEDIN_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new HttpError(400, "Gagal mengambil data profil dari API LinkedIn");
  }

  const json = (await res.json()) as {
    sub: string;
    name: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    email?: string;
    locale?: { country: string; language: string };
  };

  return {
    sub: json.sub,
    name: json.name,
    givenName: json.given_name,
    familyName: json.family_name,
    picture: json.picture,
    email: json.email,
  };
}

/** Memproses OAuth Callback resmi LinkedIn dan mengonversi profil ke struktur CvData via Claude. */
export async function processLinkedInOAuth(
  userId: string,
  code: string,
  state: string,
  redirectUri: string
): Promise<{
  data: CvData;
  inputTokens: number;
  outputTokens: number;
  model: string;
}> {
  console.log(
    `[LinkedIn OAuth Step 1] Verifying state token for user ${userId}...`
  );
  if (!verifyLinkedInState(state, userId)) {
    console.warn(
      `[LinkedIn OAuth Step 1 Failed] State token mismatch or expired. State: ${state}`
    );
    throw new HttpError(
      400,
      "Sesi otorisasi LinkedIn tidak valid atau telah kadaluarsa (CSRF token mismatch). Silakan coba lagi."
    );
  }

  console.log(
    `[LinkedIn OAuth Step 2] Exchanging authorization code for access token...`
  );
  const accessToken = await exchangeCodeForAccessToken(code, redirectUri);
  console.log(`[LinkedIn OAuth Step 2 Done] Access token acquired.`);

  console.log(
    `[LinkedIn OAuth Step 3] Fetching user profile from LinkedIn API...`
  );
  const profile = await fetchLinkedInProfile(accessToken);
  console.log(
    `[LinkedIn OAuth Step 3 Done] Profile fetched for: ${profile.name} (${profile.email || "no-email"}).`
  );

  // Catatan: LinkedIn OpenID Connect (scope: openid profile email) hanya mengembalikan
  // data dasar: nama, email, foto, dan locale. Data pengalaman kerja, pendidikan, dan
  // keahlian TIDAK tersedia melalui endpoint ini karena memerlukan LinkedIn Partner Access.
  //
  // Jangan sertakan `profile.sub` (ID internal OAuth) ke teks AI karena akan
  // diinterpretasikan sebagai public LinkedIn profile ID → URL yang salah.
  const profileText = [
    `Nama Lengkap: ${profile.name}`,
    profile.givenName ? `Nama Depan: ${profile.givenName}` : "",
    profile.familyName ? `Nama Belakang: ${profile.familyName}` : "",
    profile.email ? `Email: ${profile.email}` : "",
    profile.locale
      ? `Preferensi Bahasa LinkedIn: ${JSON.stringify(profile.locale)}`
      : "",
    "",
    "CATATAN PENTING: Data ini hanya berasal dari API dasar LinkedIn (OpenID Connect).",
    "API ini hanya menyediakan nama, email, dan preferensi bahasa — BUKAN pengalaman kerja, pendidikan, atau keahlian.",
    "Jangan mengarang data pengalaman, pendidikan, atau keahlian yang tidak ada.",
    "Jangan membuat link LinkedIn dari data ini karena tidak ada URL profil publik yang tersedia.",
    "Isi hanya field personal.fullName, personal.email, dan personal.language saja dari data di atas.",
  ]
    .filter(Boolean)
    .join("\n");

  console.log(
    `[LinkedIn OAuth Step 4] Calling Claude AI to extract CV data...`
  );
  const extracted = await claudeService.extractCvData(profileText);
  console.log(
    `[LinkedIn OAuth Step 4 Done] CV data extracted using model '${extracted.model}'.`
  );

  // Override data personal langsung dari LinkedIn API (lebih akurat daripada hasil AI).
  // AI hanya digunakan untuk mengisi field seperti language inference.
  const mergedData: CvData = {
    ...extracted.data,
    personal: {
      ...extracted.data.personal,
      // Gunakan data resmi dari LinkedIn API, bukan tebakan AI
      fullName: profile.name || extracted.data.personal.fullName,
      email: profile.email || extracted.data.personal.email,
      // Set foto profil langsung dari URL LinkedIn (bukan dari AI)
      photoUrl: profile.picture || extracted.data.personal.photoUrl,
      // Hapus semua link yang mungkin di-generate AI secara salah
      // (tidak ada data URL profil LinkedIn publik dari OpenID endpoint)
      links: extracted.data.personal.links.filter((link) => {
        const url = link.url?.toLowerCase() ?? "";
        // Buang link LinkedIn palsu yang dibuat dari ID internal OAuth
        const isLinkedInLink = url.includes("linkedin.com");
        if (!isLinkedInLink) return true;
        // Pertahankan hanya jika URL-nya adalah format slug yang valid
        // (bukan ID acak seperti HzoNCqauun yang berasal dari sub)
        const linkedinPath = url
          .replace(/^https?:\/\/[^/]+\/in\//, "")
          .split("?")[0];
        // LinkedIn vanity URL hanya berisi huruf, angka, dan tanda hubung, minimal 3 char
        const isValidSlug = /^[a-z0-9-]{3,100}$/i.test(linkedinPath);
        return isLinkedInLink && isValidSlug;
      }),
    },
    // Pastikan section yang tidak ada dari API dibiarkan kosong (bukan dikarang AI)
    experience: extracted.data.experience,
    education: extracted.data.education,
    skills: extracted.data.skills,
    projects: extracted.data.projects,
    certifications: extracted.data.certifications,
    languages: extracted.data.languages,
    customSections: extracted.data.customSections,
  };

  console.log(
    `[LinkedIn OAuth Step 5] Personal data merged from LinkedIn API: name="${mergedData.personal.fullName}", email="${mergedData.personal.email}", photoUrl="${mergedData.personal.photoUrl ? "set" : "empty"}"`
  );

  return { ...extracted, data: mergedData };
}
