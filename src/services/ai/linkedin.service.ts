import puppeteer from "puppeteer";

export async function scrapeLinkedInProfile(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });

    const title = await page.title();
    const content = await page.evaluate(() => {
      const g = globalThis as Record<string, unknown>;
      const doc = g.document as { body: { innerText: string } };
      return doc.body.innerText;
    });

    if (
      title.toLowerCase().includes("sign in") ||
      title.toLowerCase().includes("login") ||
      content.includes("Security Verification") ||
      content.includes("Sign in") ||
      content.includes("Join LinkedIn") ||
      content.length < 500
    ) {
      throw new Error("AUTHWALL");
    }

    return content;
  } finally {
    await browser.close();
  }
}
