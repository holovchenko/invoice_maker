import { toWords } from "number-to-words";

const CURRENCY_EN = "euro";
const CURRENCY_EN_PLURAL = "euros";
const CURRENCY_UA = "євро";

export const amountToWordsEN = (amount: number): string => {
  const words = toWords(amount).replace(/,/g, "");
  const currency = amount === 1 ? CURRENCY_EN : CURRENCY_EN_PLURAL;
  return `${words} ${currency}`;
};

const UA_ONES_NEUTER: ReadonlyArray<string> = [
  "",
  "одне",
  "два",
  "три",
  "чотири",
  "п'ять",
  "шість",
  "сім",
  "вісім",
  "дев'ять",
];

const UA_ONES_FEMININE: ReadonlyArray<string> = [
  "",
  "одна",
  "дві",
  "три",
  "чотири",
  "п'ять",
  "шість",
  "сім",
  "вісім",
  "дев'ять",
];

const UA_ONES_MASCULINE: ReadonlyArray<string> = [
  "",
  "один",
  "два",
  "три",
  "чотири",
  "п'ять",
  "шість",
  "сім",
  "вісім",
  "дев'ять",
];

const UA_TEENS: ReadonlyArray<string> = [
  "десять",
  "одинадцять",
  "дванадцять",
  "тринадцять",
  "чотирнадцять",
  "п'ятнадцять",
  "шістнадцять",
  "сімнадцять",
  "вісімнадцять",
  "дев'ятнадцять",
];

const UA_TENS: ReadonlyArray<string> = [
  "",
  "",
  "двадцять",
  "тридцять",
  "сорок",
  "п'ятдесят",
  "шістдесят",
  "сімдесят",
  "вісімдесят",
  "дев'яносто",
];

const UA_HUNDREDS: ReadonlyArray<string> = [
  "",
  "сто",
  "двісті",
  "триста",
  "чотириста",
  "п'ятсот",
  "шістсот",
  "сімсот",
  "вісімсот",
  "дев'ятсот",
];

type Gender = "masculine" | "feminine" | "neuter";

const getOnesWord = (n: number, gender: Gender): string => {
  if (gender === "feminine") {
    return UA_ONES_FEMININE[n] ?? "";
  }
  if (gender === "neuter") {
    return UA_ONES_NEUTER[n] ?? "";
  }
  return UA_ONES_MASCULINE[n] ?? "";
};

const getThousandSuffix = (n: number): string => {
  const lastTwo = n % 100;
  const lastOne = n % 10;

  if (lastTwo >= 11 && lastTwo <= 19) {
    return "тисяч";
  }
  if (lastOne === 1) {
    return "тисяча";
  }
  if (lastOne >= 2 && lastOne <= 4) {
    return "тисячі";
  }
  return "тисяч";
};

const convertHundredsUA = (n: number, gender: Gender): string => {
  const parts: Array<string> = [];

  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  const tens = Math.floor(remainder / 10);
  const ones = remainder % 10;

  if (hundreds > 0) {
    parts.push(UA_HUNDREDS[hundreds] ?? "");
  }

  if (remainder >= 10 && remainder <= 19) {
    parts.push(UA_TEENS[remainder - 10] ?? "");
    return parts.filter((p) => p.length > 0).join(" ");
  }

  if (tens >= 2) {
    parts.push(UA_TENS[tens] ?? "");
  }

  if (ones > 0) {
    parts.push(getOnesWord(ones, gender));
  }

  return parts.filter((p) => p.length > 0).join(" ");
};

export const amountToWordsUA = (amount: number): string => {
  if (amount === 0) {
    return `нуль ${CURRENCY_UA}`;
  }

  const parts: Array<string> = [];

  const thousands = Math.floor(amount / 1000);
  const remainder = amount % 1000;

  if (thousands > 0) {
    const thousandsWords = convertHundredsUA(thousands, "feminine");
    const suffix = getThousandSuffix(thousands);
    parts.push(`${thousandsWords} ${suffix}`);
  }

  if (remainder > 0) {
    const remainderWords = convertHundredsUA(remainder, "neuter");
    parts.push(remainderWords);
  }

  parts.push(CURRENCY_UA);

  return parts.join(" ");
};
