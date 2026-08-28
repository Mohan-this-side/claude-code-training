import { describe, expect, it } from "vitest"
import {
  isCardStatus,
  isValidLuhn,
  issueNumber,
  luhnCheckDigit,
  maskNumber,
  MAX_SPEND_LIMIT,
  nextStatus,
  spendPercent,
  TEST_BIN,
  validateIssueInput,
} from "./cards"

const MERCHANT_IDS = ["mch_01", "mch_02"]

/** Deterministic stand-in for Math.random, so generated numbers are stable. */
function sequence(values: number[]): () => number {
  let index = 0
  return () => values[index++ % values.length]
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    nickname: "Ad spend — Meta",
    merchantId: "mch_01",
    spendLimit: 25000,
    currency: "USD",
    category: "advertising",
    ...overrides,
  }
}

describe("luhnCheckDigit", () => {
  it("computes the digit that makes a known number valid", () => {
    // 4242424242424242 is the canonical test number; its body checks to 2.
    expect(luhnCheckDigit("424242424242424")).toBe(2)
  })

  it("returns a single digit for any body", () => {
    for (const body of ["4242", "424200000000000", "4242111122223"]) {
      const digit = luhnCheckDigit(body)
      expect(digit).toBeGreaterThanOrEqual(0)
      expect(digit).toBeLessThanOrEqual(9)
    }
  })
})

describe("isValidLuhn", () => {
  it("accepts the canonical test number", () => {
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects a number with the wrong check digit", () => {
    expect(isValidLuhn("4242424242424243")).toBe(false)
  })

  it("rejects anything that is not digits", () => {
    expect(isValidLuhn("4242-4242-4242-4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("issueNumber", () => {
  it("always starts with the 4242 test BIN", () => {
    const random = sequence([0.1, 0.9, 0.5, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6, 0.0])
    for (let i = 0; i < 50; i++) {
      expect(issueNumber(random).startsWith(TEST_BIN)).toBe(true)
    }
  })

  it("produces sixteen digits", () => {
    const random = sequence([0.42])
    expect(issueNumber(random)).toHaveLength(16)
  })

  it("produces a number that passes its own Luhn check", () => {
    const random = sequence([0.13, 0.77, 0.05, 0.91, 0.44, 0.68, 0.22, 0.36])
    for (let i = 0; i < 50; i++) {
      expect(isValidLuhn(issueNumber(random))).toBe(true)
    }
  })

  it("is deterministic for a given random source", () => {
    expect(issueNumber(sequence([0.5]))).toBe(issueNumber(sequence([0.5])))
  })
})

describe("maskNumber", () => {
  it("shows only the last four", () => {
    expect(maskNumber("4242")).toBe("•••• 4242")
  })

  it("never contains more than four digits", () => {
    expect(maskNumber("1234").replace(/\D/g, "")).toHaveLength(4)
  })
})

describe("nextStatus", () => {
  it("freezes an active card and thaws a frozen one", () => {
    expect(nextStatus("active", "frozen")).toBe("frozen")
    expect(nextStatus("frozen", "active")).toBe("active")
  })

  it("cancels from either active or frozen", () => {
    expect(nextStatus("active", "cancelled")).toBe("cancelled")
    expect(nextStatus("frozen", "cancelled")).toBe("cancelled")
  })

  it("treats cancelled as terminal — nothing comes back", () => {
    expect(nextStatus("cancelled", "active")).toBeNull()
    expect(nextStatus("cancelled", "frozen")).toBeNull()
    expect(nextStatus("cancelled", "cancelled")).toBeNull()
  })

  it("rejects a no-op transition rather than reporting success", () => {
    expect(nextStatus("active", "active")).toBeNull()
    expect(nextStatus("frozen", "frozen")).toBeNull()
  })
})

describe("isCardStatus", () => {
  it("accepts the three real statuses", () => {
    expect(isCardStatus("active")).toBe(true)
    expect(isCardStatus("frozen")).toBe(true)
    expect(isCardStatus("cancelled")).toBe(true)
  })

  it("rejects anything else a client might send", () => {
    expect(isCardStatus("deleted")).toBe(false)
    expect(isCardStatus("")).toBe(false)
    expect(isCardStatus(undefined)).toBe(false)
    expect(isCardStatus(7)).toBe(false)
  })
})

describe("validateIssueInput", () => {
  it("accepts a well-formed card", () => {
    const result = validateIssueInput(validBody(), MERCHANT_IDS)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.spendLimit).toBe(25000)
      expect(result.value.currency).toBe("USD")
      expect(result.value.category).toBe("advertising")
    }
  })

  it("rejects a missing merchant", () => {
    expect(validateIssueInput(validBody({ merchantId: "" }), MERCHANT_IDS).ok).toBe(false)
    expect(validateIssueInput(validBody({ merchantId: undefined }), MERCHANT_IDS).ok).toBe(false)
  })

  it("rejects a merchant that does not exist, not just a blank one", () => {
    const result = validateIssueInput(validBody({ merchantId: "mch_99" }), MERCHANT_IDS)
    expect(result.ok).toBe(false)
  })

  it("rejects a zero or negative limit", () => {
    expect(validateIssueInput(validBody({ spendLimit: 0 }), MERCHANT_IDS).ok).toBe(false)
    expect(validateIssueInput(validBody({ spendLimit: -100 }), MERCHANT_IDS).ok).toBe(false)
  })

  it("rejects a limit above 5,000,000 minor units but allows exactly that", () => {
    expect(
      validateIssueInput(validBody({ spendLimit: MAX_SPEND_LIMIT + 1 }), MERCHANT_IDS).ok,
    ).toBe(false)
    expect(
      validateIssueInput(validBody({ spendLimit: MAX_SPEND_LIMIT }), MERCHANT_IDS).ok,
    ).toBe(true)
  })

  it("rejects a float limit, because money is integer minor units", () => {
    expect(validateIssueInput(validBody({ spendLimit: 250.5 }), MERCHANT_IDS).ok).toBe(false)
  })

  it("rejects a limit sent as a string", () => {
    expect(validateIssueInput(validBody({ spendLimit: "25000" }), MERCHANT_IDS).ok).toBe(false)
  })

  it("rejects a currency outside USD, EUR, GBP", () => {
    expect(validateIssueInput(validBody({ currency: "JPY" }), MERCHANT_IDS).ok).toBe(false)
    expect(validateIssueInput(validBody({ currency: "usd" }), MERCHANT_IDS).ok).toBe(false)
  })

  it("rejects an empty nickname", () => {
    expect(validateIssueInput(validBody({ nickname: "   " }), MERCHANT_IDS).ok).toBe(false)
  })

  it("treats an absent category as none rather than an error", () => {
    const result = validateIssueInput(validBody({ category: null }), MERCHANT_IDS)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.category).toBeNull()
  })

  it("rejects a category that is not on the allowlist", () => {
    expect(validateIssueInput(validBody({ category: "weapons" }), MERCHANT_IDS).ok).toBe(false)
  })

  it("rejects a body that is not an object", () => {
    expect(validateIssueInput(null, MERCHANT_IDS).ok).toBe(false)
    expect(validateIssueInput("card", MERCHANT_IDS).ok).toBe(false)
  })
})

describe("spendPercent", () => {
  it("reports whole percentages", () => {
    expect(spendPercent({ spent: 12500, spendLimit: 25000 })).toBe(50)
  })

  it("clamps above the limit rather than reporting over 100", () => {
    expect(spendPercent({ spent: 30000, spendLimit: 25000 })).toBe(100)
  })

  it("returns zero for a zero limit instead of dividing by it", () => {
    expect(spendPercent({ spent: 100, spendLimit: 0 })).toBe(0)
  })

  it("crosses the 80% threshold where the bar turns amber", () => {
    expect(spendPercent({ spent: 20000, spendLimit: 25000 })).toBe(80)
    expect(spendPercent({ spent: 20250, spendLimit: 25000 })).toBe(81)
  })
})
