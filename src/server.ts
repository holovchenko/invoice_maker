import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { addBusinessDays } from "./business-days.js";
import { fetchHolidaysForRange } from "./holidays.js";
import { amountToWordsEN, amountToWordsUA } from "./number-to-words.js";
import {
  formatAmount,
  formatDate,
  generateFileName,
} from "./format.js";
import { nextInvoiceNumber } from "./counter.js";
import { renderInvoiceHTML } from "./template.js";
import { generatePDF } from "./pdf-generator.js";
import { loadSupplierConfig, loadCustomerConfig } from "./config.js";
import { calculatePenalty } from "./penalty.js";
import type { PenaltyInput, PenaltyResult } from "./penalty.js";

const supplierConfig = loadSupplierConfig();
const customerConfig = loadCustomerConfig();

const app = express();
const PORT = 3000;

app.use(express.json());
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/generate", async (req, res) => {
  try {
    const { date, hours, rate, penalties: penaltyInputs = [] } = req.body;
    const invoiceDate = new Date(date);
    const serviceAmount = hours * rate;
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
    const holidays = await fetchHolidaysForRange(
      sortedYears[0],
      sortedYears[sortedYears.length - 1],
    );
    const paymentDueDate = addBusinessDays(invoiceDate, 20, holidays);

    const penaltyResults = penaltyInputs.map(
      (p: PenaltyInput) => calculatePenalty(p, holidays),
    );
    const validPenalties = penaltyResults.filter(
      (p: PenaltyResult) => p.delayDays > 0,
    );

    const penaltyTotal = validPenalties.reduce(
      (sum: number, p: PenaltyResult) => sum + p.penaltyAmount,
      0,
    );
    const grandTotal = Math.round((serviceAmount + penaltyTotal) * 100) / 100;

    const data = {
      invoiceNumber: nextInvoiceNumber(),
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

    const html = renderInvoiceHTML(data, supplierConfig, customerConfig);
    const fileName = generateFileName(
      invoiceDate,
      supplierConfig.surname,
      supplierConfig.customerShort,
    );
    const filePath = await generatePDF(html, fileName);
    const actualFileName = path.basename(filePath);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${actualFileName}`);
    res.sendFile(filePath);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.post("/api/calculate-penalties", async (req, res) => {
  try {
    const { penalties: penaltyInputs = [] } = req.body;
    const years = new Set<number>();
    for (const p of penaltyInputs) {
      const invoiceDate = new Date(p.invoiceDate);
      years.add(invoiceDate.getFullYear());
      years.add(invoiceDate.getFullYear() + 1);
      const receivedDate = new Date(p.paymentReceivedDate);
      years.add(receivedDate.getFullYear());
    }
    const sortedYears = [...years].sort((a, b) => a - b);
    const holidays = sortedYears.length > 0
      ? await fetchHolidaysForRange(sortedYears[0], sortedYears[sortedYears.length - 1])
      : [];

    const results = penaltyInputs.map((p: PenaltyInput) => {
      const result = calculatePenalty(p, holidays);
      return {
        invoiceNo: result.invoiceNo,
        dueDate: formatDate(result.dueDate),
        actualPaymentDate: formatDate(result.actualPaymentDate),
        delayDays: result.delayDays,
        penaltyAmount: result.penaltyAmount,
      };
    });

    res.json({ penalties: results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Invoice maker running at http://localhost:${PORT}`);
});
