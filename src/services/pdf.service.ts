import puppeteer, { type Browser, type PaperFormat } from "puppeteer";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browserPromise;
}

/** Vertical whitespace applied to the top and bottom of every page so content
 *  never touches the page edge (including at inner page breaks). */
const PAGE_VERTICAL_MARGIN = "12mm";

/** Resolve the Puppeteer page margin for a template. Full-bleed templates print
 *  edge-to-edge (their sidebar/banner reaches every edge); plain single-column
 *  templates get a top/bottom margin — left/right stays 0 because each template
 *  supplies its own horizontal padding. */
export function resolvePdfMargin(fullBleed: boolean): {
  top: string;
  bottom: string;
  left: string;
  right: string;
} {
  const vertical = fullBleed ? "0" : PAGE_VERTICAL_MARGIN;
  return { top: vertical, bottom: vertical, left: "0", right: "0" };
}

export async function renderPdf(
  html: string,
  format: PaperFormat = "A4",
  fullBleed = false
): Promise<Uint8Array> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load" });
    // Left/right margin is always 0 so full-bleed sidebars reach the edge and
    // single-column templates control horizontal padding themselves. The
    // top/bottom margin gives every page (not just the first/last) its A4
    // whitespace; the document's own vertical body padding is reset to 0 in
    // documentShell so it isn't doubled.
    return await page.pdf({
      format,
      printBackground: true,
      margin: resolvePdfMargin(fullBleed),
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
