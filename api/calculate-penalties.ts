import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedEmail } from "../src/api-helpers.js";
import { calculatePenalty } from "../src/penalty.js";
import type { PenaltyInput } from "../src/penalty.js";
import { fetchHolidaysForRange } from "../src/holidays.js";
import { formatAmount, formatDate } from "../src/format.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = await getAuthenticatedEmail(req);
  if (!email) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { penalties: penaltyInputs = [] } = req.body;

    const years = new Set<number>();
    for (const p of penaltyInputs) {
      const invoiceDate = new Date(p.invoiceDate);
      years.add(invoiceDate.getFullYear());
      years.add(invoiceDate.getFullYear() + 1);
      years.add(new Date(p.paymentReceivedDate).getFullYear());
    }
    const sortedYears = [...years].sort((a, b) => a - b);
    const holidays = sortedYears.length > 0
      ? await fetchHolidaysForRange(sortedYears[0], sortedYears[sortedYears.length - 1])
      : [];

    const results = penaltyInputs.map((p: PenaltyInput) => {
      const result = calculatePenalty(p, holidays);
      return {
        invoiceNo: result.invoiceNo,
        delayDays: result.delayDays,
        penaltyAmount: formatAmount(result.penaltyAmount),
        dueDate: formatDate(result.dueDate),
        actualPaymentDate: formatDate(result.actualPaymentDate),
      };
    });

    return res.status(200).json({ penalties: results });
  } catch (error) {
    console.error(`[calculate-penalties] error for ${email}:`, error);
    return res.status(500).json({ error: "Failed to calculate penalties" });
  }
}
