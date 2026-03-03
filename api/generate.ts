import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedEmail } from "../src/api-helpers.js";
import { kvGet, kvIncr } from "../src/kv.js";
import { renderInvoiceHTML } from "../src/template.js";
import { generatePDFBuffer } from "../src/pdf-generator.js";
import { calculatePenalty } from "../src/penalty.js";
import type { PenaltyInput, PenaltyResult } from "../src/penalty.js";
import { addBusinessDays } from "../src/business-days.js";
import { fetchHolidaysForRange } from "../src/holidays.js";
import { formatAmount, formatDate, generateFileName } from "../src/format.js";
import { amountToWordsEN, amountToWordsUA } from "../src/number-to-words.js";
import type { SupplierConfig, CustomerConfig } from "../src/config.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = await getAuthenticatedEmail(req);
  if (!email) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Support both JSON and form-encoded bodies
    const requestBody = req.body._json ? JSON.parse(req.body._json) : req.body;
    const { date, hours, rate, invoiceNumber: customInvoiceNumber, penalties: penaltyInputs = [] } = requestBody;
    const invoiceDate = new Date(date);
    const serviceAmount = hours * rate;

    // Load configs from KV
    const supplier = await kvGet<SupplierConfig>(`supplier:${email}`);
    if (!supplier) {
      return res.status(400).json({ error: "Supplier settings not configured. Go to Settings first." });
    }
    const customer = await kvGet<CustomerConfig>("customer");
    if (!customer) {
      return res.status(500).json({ error: "Customer config not set" });
    }

    // Invoice number: use custom or auto-increment
    let invoiceNumber: string;
    if (customInvoiceNumber) {
      invoiceNumber = String(customInvoiceNumber);
    } else {
      const counterKey = `counter:${email}`;
      const next = await kvIncr(counterKey);
      invoiceNumber = String(next);
    }

    // Collect years for holidays
    const years = new Set<number>();
    years.add(invoiceDate.getFullYear());
    const estimatedEndDate = new Date(invoiceDate);
    estimatedEndDate.setDate(estimatedEndDate.getDate() + 30);
    years.add(estimatedEndDate.getFullYear());
    for (const p of penaltyInputs) {
      const pInvoiceDate = new Date(p.invoiceDate);
      years.add(pInvoiceDate.getFullYear());
      years.add(pInvoiceDate.getFullYear() + 1);
      years.add(new Date(p.paymentReceivedDate).getFullYear());
    }
    const sortedYears = [...years].sort((a, b) => a - b);
    const holidays = await fetchHolidaysForRange(sortedYears[0], sortedYears[sortedYears.length - 1]);

    const paymentDueDate = addBusinessDays(invoiceDate, 20, holidays);

    const penaltyResults = penaltyInputs.map(
      (p: PenaltyInput) => calculatePenalty(p, holidays),
    );
    const validPenalties = penaltyResults.filter(
      (p: PenaltyResult) => p.delayDays > 0,
    );
    const penaltyTotal = validPenalties.reduce(
      (sum: number, p: PenaltyResult) => sum + p.penaltyAmount, 0,
    );
    const grandTotal = Math.round((serviceAmount + penaltyTotal) * 100) / 100;

    const data = {
      invoiceNumber,
      invoiceDate: formatDate(invoiceDate),
      hours,
      rate: formatAmount(rate),
      serviceAmount: formatAmount(serviceAmount),
      totalAmount: formatAmount(grandTotal),
      totalWordsEN: amountToWordsEN(grandTotal),
      totalWordsUA: amountToWordsUA(grandTotal),
      paymentDueDate: formatDate(paymentDueDate),
      penalties: validPenalties.map((p: PenaltyResult) => ({
        invoiceNo: p.invoiceNo,
        delayDays: p.delayDays,
        penaltyAmount: formatAmount(p.penaltyAmount),
        dueDate: formatDate(p.dueDate),
        actualPaymentDate: formatDate(p.actualPaymentDate),
      })),
    };

    const html = renderInvoiceHTML(data, supplier, customer);
    const pdfBuffer = await generatePDFBuffer(html);
    const fileName = generateFileName(invoiceDate, supplier.surname, supplier.customerShort);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    return res.status(500).json({ error: "Failed to generate PDF" });
  }
}
