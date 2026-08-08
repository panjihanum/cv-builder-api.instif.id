import { createMiddleware } from "hono/factory";

/**
 * Keep this host out of search engines.
 *
 * `instif.id/src/data/sites.ts` lists the `*-api` hosts under EXCLUDED_HOSTS
 * and states that each one "also sends X-Robots-Tag: noindex, which is what
 * actually keeps them out of search". That was documentation of an intent, not
 * of a fact: an audit on 2026-08-08 found every `*-api` host answering
 * Googlebot with a 200 and indexable HTML, and no such header anywhere.
 *
 * These hosts serve a human-readable landing page at `/`, so a crawler that
 * reaches one gets a real document rather than JSON it would ignore.
 *
 * robots.txt cannot carry this on its own. Cloudflare prepends a managed
 * `User-agent: * / Allow: /` block to robots.txt on these domains, so the file
 * argues with itself; and robots.txt only asks a crawler not to FETCH a page,
 * which does not stop the URL being indexed from an external link. The response
 * header is the part that actually removes a page from the index, so it is set
 * on every response, including errors and static files.
 */
export const noIndex = createMiddleware(async (c, next) => {
  await next();
  c.header("X-Robots-Tag", "noindex, nofollow, noarchive");
});

/**
 * The robots.txt body served by this host.
 *
 * Belt and braces next to the header above: it discourages the fetch, while
 * `X-Robots-Tag` is what guarantees the removal. Cloudflare may still prepend
 * its own managed block to what is returned here.
 */
export const ROBOTS_TXT = "User-agent: *\nDisallow: /\n";
