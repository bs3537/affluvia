import fs from "fs/promises";
import path from "path";
import { toRenderContext, type WillForm, WillForm as WillFormSchema } from "@shared/will-types";
import {
  renderInstructions,
  renderWill,
  renderPersonalPropertyMemo,
  renderDigitalAssetsSheet,
  renderFuneralWishes,
  renderBeneficiaryMessages,
  renderAffidavit,
} from "./templates";

export type GeneratedDoc = { kind: string; filePath: string; urlPath: string };

export async function generateWillDocuments(baseDir: string, data: unknown): Promise<GeneratedDoc[]> {
  const parsed = WillFormSchema.parse(data as WillForm);
  const ctx = toRenderContext(parsed);

  await fs.mkdir(baseDir, { recursive: true });

  const docs: Array<[string, string]> = [
    ["instructions", renderInstructions(ctx)],
    ["last-will-and-testament", renderWill(ctx)],
    ["personal-property-memo", renderPersonalPropertyMemo(ctx)],
    ["digital-assets", renderDigitalAssetsSheet(ctx)],
    ["funeral-wishes", renderFuneralWishes(ctx)],
    ["beneficiary-messages", renderBeneficiaryMessages(ctx)],
    ["self-proving-affidavit", renderAffidavit(ctx)],
  ];

  const out: GeneratedDoc[] = [];
  for (const [slug, html] of docs) {
    const fname = `${slug}.html`;
    const fpath = path.join(baseDir, fname);
    await fs.writeFile(fpath, html, "utf8");
    out.push({ kind: slug, filePath: fpath, urlPath: toUrlPath(fpath) });
  }

  return out;
}

function toUrlPath(filePath: string): string {
  // Translate uploads dir to public /uploads URL
  const uploads = path.join(process.cwd(), "uploads");
  const rel = path.relative(uploads, filePath);
  return "/uploads/" + rel.split(path.sep).join("/");
}

// Generate a single combined PDF named "Will Packet.pdf" using Playwright (if available)
export async function generateCombinedPdfPacket(baseDir: string, data: unknown): Promise<{ filePath: string; urlPath: string } | null> {
  const parsed = WillFormSchema.parse(data as WillForm);
  const ctx = toRenderContext(parsed);

  await fs.mkdir(baseDir, { recursive: true });

  const parts: Array<[string, string]> = [
    ["Instructions", renderInstructions(ctx)],
    ["Last Will and Testament", renderWill(ctx)],
    ["Personal Property Memorandum", renderPersonalPropertyMemo(ctx)],
    ["Digital Assets & Accounts", renderDigitalAssetsSheet(ctx)],
    ["Funeral Wishes", renderFuneralWishes(ctx)],
    ["Messages to Beneficiaries", renderBeneficiaryMessages(ctx)],
    ["Self‑Proving Affidavit", renderAffidavit(ctx)],
  ];

  // Extract the body of each HTML and add a page break between sections
  const extractBody = (html: string) => {
    const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return m ? m[1] : html;
  };

  const baseCss = `
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: #111827; line-height: 1.45; }
    .section { page-break-after: always; }
  `;

  const combined = `<!doctype html><html><head><meta charset="utf-8"/><style>${baseCss}</style></head><body>
    ${parts
      .map(([title, html], idx) => `
        <div class="section">
          ${idx > 0 ? "" : ""}
          ${extractBody(html)}
        </div>
      `)
      .join("\n")}
  </body></html>`;

  try {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.setContent(combined, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "Letter", printBackground: true, margin: { top: "14mm", bottom: "16mm", left: "12mm", right: "12mm" } });
    await browser.close();

    const outPath = path.join(baseDir, `Will Packet.pdf`);
    await fs.writeFile(outPath, pdf);
    return { filePath: outPath, urlPath: toUrlPath(outPath) };
  } catch (err) {
    console.error("[WillRenderer] Combined PDF generation unavailable:", err);
    return null;
  }
}

// Generate individual PDF files for each document and return their paths
export async function generatePdfDocuments(baseDir: string, data: unknown): Promise<Array<{ name: string; filePath: string }>> {
  const parsed = WillFormSchema.parse(data as WillForm);
  const ctx = toRenderContext(parsed);
  await fs.mkdir(baseDir, { recursive: true });

  const parts: Array<{ name: string; html: string }> = [
    { name: "Instructions.pdf", html: renderInstructions(ctx) },
    { name: "Last Will and Testament.pdf", html: renderWill(ctx) },
    { name: "Personal Property Memorandum.pdf", html: renderPersonalPropertyMemo(ctx) },
    { name: "Digital Assets & Accounts.pdf", html: renderDigitalAssetsSheet(ctx) },
    { name: "Funeral Wishes.pdf", html: renderFuneralWishes(ctx) },
    { name: "Messages to Beneficiaries.pdf", html: renderBeneficiaryMessages(ctx) },
    { name: "Self‑Proving Affidavit.pdf", html: renderAffidavit(ctx) },
  ];

  const out: Array<{ name: string; filePath: string }> = [];
  try {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ deviceScaleFactor: 2 });
    for (const part of parts) {
      const page = await context.newPage();
      await page.setContent(part.html, { waitUntil: "load" });
      const pdf = await page.pdf({ format: "Letter", printBackground: true, margin: { top: "14mm", bottom: "16mm", left: "12mm", right: "12mm" } });
      const pdfPath = path.join(baseDir, part.name);
      await fs.writeFile(pdfPath, pdf);
      out.push({ name: part.name, filePath: pdfPath });
      await page.close();
    }
    await browser.close();
  } catch (err) {
    console.error("[WillRenderer] Per-document PDF generation unavailable:", err);
  }
  return out;
}
