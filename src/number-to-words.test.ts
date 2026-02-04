import { describe, it, expect } from "vitest";
import { amountToWordsEN, amountToWordsUA } from "./number-to-words";

describe("amountToWordsEN", () => {
  it("converts 5162 to words", () => {
    expect(amountToWordsEN(5162)).toBe(
      "five thousand one hundred sixty-two euros"
    );
  });

  it("converts 1000 to words", () => {
    expect(amountToWordsEN(1000)).toBe("one thousand euros");
  });

  it("converts 1 to words", () => {
    expect(amountToWordsEN(1)).toBe("one euro");
  });

  it("converts 4872 to words", () => {
    expect(amountToWordsEN(4872)).toBe(
      "four thousand eight hundred seventy-two euros"
    );
  });

  it("converts amount with cents to words", () => {
    expect(amountToWordsEN(5044.24)).toBe(
      "five thousand forty-four euros and twenty-four cents"
    );
  });

  it("converts small amount with cents to words", () => {
    expect(amountToWordsEN(63.84)).toBe(
      "sixty-three euros and eighty-four cents"
    );
  });

  it("converts amount with one cent", () => {
    expect(amountToWordsEN(100.01)).toBe("one hundred euros and one cent");
  });

  it("preserves whole number behavior", () => {
    expect(amountToWordsEN(3360)).toBe("three thousand three hundred sixty euros");
  });
});

describe("amountToWordsUA", () => {
  it("converts 5162 to words", () => {
    expect(amountToWordsUA(5162)).toBe(
      "п'ять тисяч сто шістдесят два євро"
    );
  });

  it("converts 1000 to words", () => {
    expect(amountToWordsUA(1000)).toBe("одна тисяча євро");
  });

  it("converts 1 to words", () => {
    expect(amountToWordsUA(1)).toBe("одне євро");
  });

  it("converts 4872 to words", () => {
    expect(amountToWordsUA(4872)).toBe(
      "чотири тисячі вісімсот сімдесят два євро"
    );
  });

  it("converts 2 to words", () => {
    expect(amountToWordsUA(2)).toBe("два євро");
  });

  it("converts 21 to words", () => {
    expect(amountToWordsUA(21)).toBe("двадцять одне євро");
  });

  it("converts 100 to words", () => {
    expect(amountToWordsUA(100)).toBe("сто євро");
  });

  it("converts 10000 to words", () => {
    expect(amountToWordsUA(10000)).toBe("десять тисяч євро");
  });

  it("converts amount with cents to words", () => {
    expect(amountToWordsUA(5044.24)).toBe(
      "п'ять тисяч сорок чотири євро двадцять чотири центи"
    );
  });

  it("converts small amount with cents to words", () => {
    expect(amountToWordsUA(63.84)).toBe(
      "шістдесят три євро вісімдесят чотири центи"
    );
  });

  it("converts amount with one cent", () => {
    expect(amountToWordsUA(100.01)).toBe("сто євро один цент");
  });

  it("converts amount with 5 cents", () => {
    expect(amountToWordsUA(100.05)).toBe("сто євро п'ять центів");
  });

  it("preserves whole number behavior with cents", () => {
    expect(amountToWordsUA(3360)).toBe("три тисячі триста шістдесят євро");
  });
});
