import puppeteerCore from "puppeteer-core";
import path from "path";
import fs from "fs";

const OUTPUT_DIR = path.resolve(process.cwd(), "output");

function getUniqueFilePath(dir: string, fileName: string): string {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let filePath = path.join(dir, fileName);
  let counter = 1;

  while (fs.existsSync(filePath)) {
    filePath = path.join(dir, `${base}_${counter}${ext}`);
    counter++;
  }

  return filePath;
}

async function getBrowser() {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL) {
    const chromium = await import("@sparticuz/chromium");
    return puppeteerCore.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });
  }
  // Local dev: use puppeteer's bundled Chromium
  const localPuppeteer = await import("puppeteer");
  return localPuppeteer.default.launch({ headless: true });
}

export async function generatePDFBuffer(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/** @deprecated Use generatePDFBuffer for Vercel. Kept for local CLI usage. */
export async function generatePDF(
  html: string,
  fileName: string
): Promise<string> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const filePath = getUniqueFilePath(OUTPUT_DIR, fileName);
  const browser = await getBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: filePath,
      preferCSSPageSize: true,
      printBackground: true,
    });
  } finally {
    await browser.close();
  }

  return filePath;
}
