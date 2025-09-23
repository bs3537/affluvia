import fs from "fs/promises";
import fsSync from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { execFile } from "node:child_process";

function resolveBinarySync(cmd: string): string | null {
  const pathEnv = process.env.PATH || "";
  const sep = process.platform === "win32" ? ";" : ":";
  const PATHS = ["/opt/homebrew/bin", "/usr/local/bin", ...pathEnv.split(sep).filter(Boolean)];
  for (const dir of PATHS) {
    const full = path.join(dir, cmd);
    try {
      fsSync.accessSync(full, fsSync.constants.X_OK);
      return full;
    } catch {}
  }
  return null;
}

function execFileAsync(cmd: string, args: string[], cwd?: string): Promise<{ code: number }>{
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, { cwd }, (error) => {
      if (error) return reject(error);
      resolve({ code: 0 });
    });
  });
}

async function mkdirTmp(prefix = "affluvia-ocr-"): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function byPageNumber(a: string, b: string): number {
  const ra = /-(\d+)\.png$/.exec(a);
  const rb = /-(\d+)\.png$/.exec(b);
  const na = ra ? parseInt(ra[1], 10) : 0;
  const nb = rb ? parseInt(rb[1], 10) : 0;
  return na - nb;
}

async function getCache(hash: string): Promise<string | null> {
  try {
    const { cacheService } = await import("./cache.service");
    const hit = await cacheService.get<string>("ocr", { hash });
    return hit || null;
  } catch {
    return null;
  }
}

async function setCache(hash: string, text: string): Promise<void> {
  try {
    const { cacheService } = await import("./cache.service");
    // Cache for 24 hours
    await cacheService.set<string>("ocr", { hash }, text, 24 * 60 * 60);
  } catch {}
}

type OcrOptions = {
  maxPages?: number;
  dpi?: number;
  concurrency?: number;
  budgetMs?: number;
  whitelist?: string;
};

function now() { return Date.now(); }

export async function ocrFirstTwentyPages(buffer: Buffer, options: OcrOptions = {}): Promise<string> {
  const tStart = now();
  const maxPages = Math.max(1, Math.min(100, options.maxPages ?? Number(process.env.OCR_MAX_PAGES || 20)));
  const dpi = Math.max(72, Math.min(600, options.dpi ?? Number(process.env.OCR_DPI || 150)));
  const concurrency = Math.max(1, Math.min(16, options.concurrency ?? Number(process.env.OCR_CONCURRENCY || 5)));
  const budgetMs = Math.max(2000, Math.min(120000, options.budgetMs ?? Number(process.env.OCR_BUDGET_MS || 15000)));
  const whitelist = options.whitelist || "0123456789$,-.%()abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ";
  const earlyExitPages = Math.max(3, Math.min(20, Number(process.env.OCR_EARLY_EXIT_PAGES || 6)));

  if (!buffer || buffer.byteLength === 0) return "";

  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const cached = await getCache(hash);
  if (cached) {
    console.info(`[OCR] cache hit, bytes=${buffer.byteLength}, hash=${hash.slice(0,8)}`);
    return cached;
  }

  const pdftoppm = resolveBinarySync("pdftoppm") || "pdftoppm";
  const tesseractBin = resolveBinarySync("tesseract") || "tesseract";

  const tmpDir = await mkdirTmp();
  const pdfPath = path.join(tmpDir, "input.pdf");
  await fs.writeFile(pdfPath, buffer);

  try {
    // Born-digital fast path: try pdftotext -layout first; if substantial text, skip OCR entirely
    try {
      const pdftotext = resolveBinarySync("pdftotext") || "pdftotext";
      const tTxt0 = now();
      const text = await new Promise<string>((resolve, reject) => {
        const args = ["-layout", "-enc", "UTF-8", pdfPath, "-"];
        const child = execFile(pdftotext, args, { cwd: tmpDir, maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
          if (err) return reject(err);
          resolve((stdout || "").toString());
        });
        child.on("error", reject);
      });
      const tTxt1 = now();
      const norm = (text || "").replace(/\s+/g, " ").trim();
      if (norm.length >= 1000) {
        console.info(`[PDF] pdftotext fast path used, ms=${tTxt1 - tTxt0}, chars=${norm.length}`);
        await setCache(hash, norm);
        return norm;
      }
    } catch (_) {}

    // Convert first N pages to PNG (grayscale for speed)
    const tCairo0 = now();
    await execFileAsync(pdftoppm, ["-png", "-gray", "-r", String(dpi), "-f", "1", "-l", String(maxPages), pdfPath, "page"], tmpDir);
    const tCairo1 = now();

    const files = (await fs.readdir(tmpDir))
      .filter((f) => /^page-\d+\.png$/.test(f))
      .map((f) => path.join(tmpDir, f))
      .sort(byPageNumber);

    if (files.length === 0) {
      console.warn("[OCR] pdftoppm produced no images");
      return "";
    }

    async function recognize(img: string): Promise<string> {
      const args: string[] = [img, "stdout", "-l", "eng", "--oem", "1", "--psm", "6",
        "-c", `tessedit_char_whitelist=${whitelist}`,
        "-c", `preserve_interword_spaces=1`,
        "-c", `user_defined_dpi=${dpi}`
      ];
      const tessData = process.env.TESSDATA_PREFIX;
      if (tessData && tessData !== "undefined") {
        args.push("--tessdata-dir", tessData);
      }
      return new Promise((resolve, reject) => {
        const child = execFile(tesseractBin, args, { cwd: tmpDir, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
          if (err) return reject(err);
          resolve((stdout || "").toString());
        });
        child.on("error", reject);
      });
    }

    let combined = "";
    let started = 0;
    let completed = 0;
    const tOcr0 = now();
    let earlyExit = false;
    let extractFn: ((txt: string) => any) | null = null;

    // Simple concurrency pool
    async function worker(): Promise<void> {
      while (started < files.length) {
        const elapsed = now() - tStart;
        if (elapsed >= budgetMs || earlyExit) break;
        const idx = started++;
        const img = files[idx];
        try {
          const text = await recognize(img);
          combined += (text || "") + "\n";
          // Early-exit heuristic: once enough pages processed, check if we already have core fields
          if (!earlyExit && completed + 1 >= earlyExitPages) {
            try {
              if (!extractFn) {
                const mod: any = await import("./tax-return-extractors");
                extractFn = mod.extract1040Fields as (txt: string) => any;
              }
              const ex = extractFn!(combined);
              const gotAGI = Number.isFinite(ex?.adjustedGrossIncome);
              const gotTaxable = Number.isFinite(ex?.taxableIncome);
              const gotTotalTax = Number.isFinite(ex?.federalTaxesPaid);
              if ((gotAGI && gotTaxable) || (gotAGI && gotTotalTax) || (gotTaxable && gotTotalTax)) {
                earlyExit = true;
              }
            } catch {}
          }
        } catch (err: any) {
          console.warn("[OCR] tesseract error on", path.basename(img), ":", err?.message || err);
        } finally {
          completed++;
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, files.length) }, () => worker());
    await Promise.all(workers);

    const tOcr1 = now();
    const elapsed = tOcr1 - tStart;
    const ocrElapsed = tOcr1 - tOcr0;
    const convertElapsed = tCairo1 - tCairo0;
    const pagesProcessed = completed;
    const out = combined.trim();
    console.info(`[OCR] pages=${files.length} processed=${pagesProcessed} earlyExit=${earlyExit} dpi=${dpi} gray concurrency=${concurrency} budgetMs=${budgetMs} convertMs=${convertElapsed} ocrMs=${ocrElapsed} elapsed=${elapsed} chars=${out.length} bin.tesseract=${!!tesseractBin}`);

    if (out.length > 0) {
      await setCache(hash, out);
      return out;
    }

    // Built-in pdf-parse fallback if OCR produced no text
    try {
      const { extractPdfText } = await import("./pdf-text-extractor");
      const parsed = await extractPdfText(buffer);
      if (parsed && parsed.length > 0) {
        console.info("[OCR] using pdf-parse fallback (OCR returned 0 chars)");
        return parsed;
      }
    } catch (e: any) {
      console.warn("[OCR] pdf-parse fallback failed:", e?.message || e);
    }
    return "";
  } catch (err: any) {
    console.warn("[OCR] engine failed:", err?.message || err);
    // Final fallback: try pdf-parse directly if OCR pipeline failed
    try {
      const { extractPdfText } = await import("./pdf-text-extractor");
      const parsed = await extractPdfText(buffer);
      if (parsed && parsed.length > 0) {
        console.info("[OCR] using pdf-parse fallback after engine failure");
        return parsed;
      }
    } catch (e: any) {
      console.warn("[OCR] pdf-parse fallback after failure also failed:", e?.message || e);
    }
    return "";
  } finally {
    // Best-effort cleanup
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
}
