import puppeteer, { type Browser, type PaperFormat } from "puppeteer";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
  }
  return browserPromise;
}

export async function renderPdf(
  html: string,
  format: PaperFormat = "A4"
): Promise<Uint8Array> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    // No page margin: each template renders edge-to-edge and supplies its own
    // padding, exactly like the on-screen preview. A Puppeteer margin here would
    // add whitespace around the whole document (a white border around full-bleed
    // sidebars) that the preview never shows.
    return await page.pdf({
      format,
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
  } finally {
    await page.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser.close();
}
