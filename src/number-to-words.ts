import { toWords } from "number-to-words";

const CURRENCY_EN = "euro";
const CURRENCY_EN_PLURAL = "euros";
const CURRENCY_UA = "євро";

export const amountToWordsEN = (amount: number): string => {
  const euros = Math.floor(amount);
  const cents = Math.round((amount - euros) * 100);

  const euroWords = toWords(euros).replace(/,/g, "");
  const euroCurrency = euros === 1 ? CURRENCY_EN : CURRENCY_EN_PLURAL;

  if (cents === 0) {
    return `${euroWords} ${euroCurrency}`;
  }

  const centWords = toWords(cents).replace(/,/g, "");
  const centCurrency = cents === 1 ? "cent" : "cents";
  return `${euroWords} ${euroCurrency} and ${centWords} ${centCurrency}`;
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

const getCentSuffix = (n: number): string => {
  const lastTwo = n % 100;
  const lastOne = n % 10;
  if (lastTwo >= 11 && lastTwo <= 19) return "центів";
  if (lastOne === 1) return "цент";
  if (lastOne >= 2 && lastOne <= 4) return "центи";
  return "центів";
};

export const amountToWordsUA = (amount: number): string => {
  const euros = Math.floor(amount);
  const cents = Math.round((amount - euros) * 100);

  if (euros === 0 && cents === 0) {
    return `нуль ${CURRENCY_UA}`;
  }

  const parts: Array<string> = [];

  const thousands = Math.floor(euros / 1000);
  const remainder = euros % 1000;

  if (thousands > 0) {
    const thousandsWords = convertHundredsUA(thousands, "feminine");
    const suffix = getThousandSuffix(thousands);
    parts.push(`${thousandsWords} ${suffix}`);
  }

  if (remainder > 0) {
    const remainderWords = convertHundredsUA(remainder, "neuter");
    parts.push(remainderWords);
  }

  if (euros === 0) {
    parts.push(`нуль ${CURRENCY_UA}`);
  } else {
    parts.push(CURRENCY_UA);
  }

  if (cents > 0) {
    const centWords = convertHundredsUA(cents, "masculine");
    const centSuffix = getCentSuffix(cents);
    parts.push(`${centWords} ${centSuffix}`);
  }

  return parts.join(" ");
};
