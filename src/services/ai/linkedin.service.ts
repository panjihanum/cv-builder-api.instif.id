import puppeteer from "puppeteer";

/** Minimum character count untuk konten dianggap relevan/valid. */
const MIN_CONTENT_LENGTH = 300;

export class ScrapeError extends Error {
  constructor(
    public readonly code: "AUTHWALL" | "EMPTY_CONTENT" | "FETCH_FAILED",
    message: string
  ) {
    super(message);
    this.name = "ScrapeError";
  }
}

/**
 * Scrape konten teks dari URL apa saja menggunakan Puppeteer headless.
 *
 * @throws {ScrapeError} AUTHWALL — LinkedIn/site memblokir dengan login wall
 * @throws {ScrapeError} EMPTY_CONTENT — halaman berhasil dimuat tapi konten terlalu pendek/kosong
 * @throws {ScrapeError} FETCH_FAILED — error jaringan, timeout, atau halaman error (4xx/5xx)
 */
export async function scrapeUrl(url: string): Promise<string> {
  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  };

  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    let httpStatus = 200;
    page.on("response", (response) => {
      if (response.url() === url || response.url().startsWith(url)) {
        httpStatus = response.status();
      }
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });

    const title = await page.title();
    const content = await page.evaluate(() => {
      const g = globalThis as Record<string, unknown>;
      const doc = g.document as { body: { innerText: string } };
      return doc.body ? doc.body.innerText : "";
    });

    // Detect HTTP error pages or LinkedIn block (999/403/401)
    if (httpStatus >= 400 || httpStatus === 999) {
      throw new ScrapeError(
        "AUTHWALL",
        `Halaman mengembalikan status HTTP ${httpStatus}`
      );
    }

    // Detect LinkedIn/auth walls
    const isAuthWall =
      title.toLowerCase().includes("sign in") ||
      title.toLowerCase().includes("login") ||
      content.includes("Security Verification") ||
      content.includes("Sign in") ||
      content.includes("Join LinkedIn") ||
      content.includes("Log in or sign up") ||
      content.includes("authwall");

    if (isAuthWall) {
      throw new ScrapeError(
        "AUTHWALL",
        "Halaman memerlukan login untuk diakses"
      );
    }

    // Detect empty / irrelevant content
    if (content.trim().length < MIN_CONTENT_LENGTH) {
      throw new ScrapeError(
        "EMPTY_CONTENT",
        "Konten halaman terlalu pendek atau tidak dapat dibaca"
      );
    }

    return content;
  } catch (err) {
    if (err instanceof ScrapeError) throw err;

    // Puppeteer timeout / network errors
    const message =
      err instanceof Error ? err.message : "Gagal mengakses halaman";
    throw new ScrapeError("FETCH_FAILED", message);
  } finally {
    await browser.close();
  }
}

/**
 * @deprecated Gunakan `scrapeUrl()` sebagai gantinya.
 * Alias untuk backward-compat dengan `parse-linkedin` endpoint yang sudah ada.
 */
export async function scrapeLinkedInProfile(url: string): Promise<string> {
  try {
    return await scrapeUrl(url);
  } catch (err) {
    if (err instanceof ScrapeError) {
      throw new Error("AUTHWALL", { cause: err });
    }
    throw err;
  }
}
