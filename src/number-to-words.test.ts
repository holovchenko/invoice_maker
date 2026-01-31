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
});
