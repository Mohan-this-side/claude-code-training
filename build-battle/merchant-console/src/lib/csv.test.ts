import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFilename,
  parseColumns,
  toCsv,
} from "./csv"

/**
 * The export is the file ops hands to a merchant, so a broken cell is a
 * support ticket rather than a stack trace. These tests pin the escaping and
 * the column contract; NWP-101 changes which columns ship, not how a cell is
 * written, and these should still pass afterwards.
 */

const payment: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 25000,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

describe("toCsv", () => {
  it("writes a header row followed by one row per payment", () => {
    const lines = toCsv([payment]).split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(","))
  })

  it("writes only the requested columns, in the order given", () => {
    expect(toCsv([payment], ["id", "amount"])).toBe(
      ["id,amount", "pay_0001,250.00"].join("\n"),
    )
  })

  it("quotes cells containing a comma, so a description does not split", () => {
    const commas = { ...payment, description: "Order 1180, rush, gift wrap" }
    expect(toCsv([commas], ["description"])).toBe(
      ["description", '"Order 1180, rush, gift wrap"'].join("\n"),
    )
  })

  it("doubles embedded quotes rather than dropping them", () => {
    const quoted = { ...payment, description: 'Order "rush"' }
    expect(toCsv([quoted], ["description"])).toBe(
      ["description", '"Order ""rush"""'].join("\n"),
    )
  })

  it("keeps a newline inside a description in one quoted cell", () => {
    const multiline = { ...payment, description: "Order 1180\nsecond line" }
    const body = toCsv([multiline], ["description"]).split("\n").slice(1).join("\n")
    expect(body).toBe('"Order 1180\nsecond line"')
  })

  it("resolves the merchant name, and falls back to the id when unknown", () => {
    expect(toCsv([payment], ["merchant"])).toContain("Lumen Coffee Roasters")
    const orphan = { ...payment, merchantId: "mch_missing" }
    expect(toCsv([orphan], ["merchant"])).toContain("mch_missing")
  })

  it("writes an empty cell for a payment with no card", () => {
    const bank: Payment = {
      ...payment,
      method: "bank_transfer",
      cardBrand: null,
      last4: null,
    }
    expect(toCsv([bank], ["card_brand", "last4"])).toBe(
      ["card_brand,last4", ","].join("\n"),
    )
  })

  it("emits a header even with no rows", () => {
    expect(toCsv([], ["id"])).toBe("id")
  })

  it("writes a subset in the order asked for, not the canonical order", () => {
    // currency before amount, and status last, is the reverse of EXPORT_COLUMNS.
    expect(toCsv([payment], ["status", "currency", "amount"])).toBe(
      ["status,currency,amount", "captured,USD,250.00"].join("\n"),
    )
  })

  it("writes the amount as bare minor units, with currency in its own column", () => {
    // No symbol and no thousands separator, so the cell never needs quoting
    // and a spreadsheet reads it as a number.
    const large = { ...payment, amount: 123456789 }
    expect(toCsv([large], ["amount", "currency"])).toBe(
      ["amount,currency", "1234567.89,USD"].join("\n"),
    )
  })

  it("keeps the cents on amounts that need padding, and on negatives", () => {
    const cases: [number, string][] = [
      [5, "0.05"],
      [250, "2.50"],
      [-1999, "-19.99"],
      [0, "0.00"],
    ]
    for (const [amount, expected] of cases) {
      expect(toCsv([{ ...payment, amount }], ["amount"])).toBe(
        ["amount", expected].join("\n"),
      )
    }
  })
})

describe("DEFAULT_EXPORT_COLUMNS", () => {
  it("leaves the card last four out, because most files go to a merchant", () => {
    expect(DEFAULT_EXPORT_COLUMNS).not.toContain("last4")
    expect(EXPORT_COLUMNS).toContain("last4")
  })

  it("keeps every other column, in the canonical order", () => {
    expect(DEFAULT_EXPORT_COLUMNS).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
  })
})

describe("parseColumns", () => {
  it("keeps the order the client asked for", () => {
    expect(parseColumns("currency,id,amount")).toEqual([
      "currency",
      "id",
      "amount",
    ])
  })

  it("drops names that are not columns rather than passing them along", () => {
    expect(parseColumns("id,merchant_secret,amount")).toEqual(["id", "amount"])
    expect(parseColumns("id,../../etc/passwd,amount")).toEqual(["id", "amount"])
    expect(parseColumns("id,amount; DROP TABLE payments")).toEqual(["id"])
  })

  it("tolerates whitespace around names", () => {
    expect(parseColumns(" id , amount ")).toEqual(["id", "amount"])
  })

  it("collapses duplicates to one column", () => {
    expect(parseColumns("id,id,amount,id")).toEqual(["id", "amount"])
  })

  it("returns nothing when the selection is empty or entirely unknown", () => {
    // The route turns each of these into a 400 rather than an empty file.
    expect(parseColumns("")).toEqual([])
    expect(parseColumns(null)).toEqual([])
    expect(parseColumns(undefined)).toEqual([])
    expect(parseColumns(",,,")).toEqual([])
    expect(parseColumns("nope,also_nope")).toEqual([])
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope, so ops can tell two files apart", () => {
    const date = new Date("2026-08-13T10:00:00.000Z")
    expect(exportFilename(date, "disputed")).toBe(
      "payments-disputed-2026-08-13.csv",
    )
    expect(exportFilename(date, "all")).toBe("payments-all-2026-08-13.csv")
    expect(exportFilename(date, "filtered")).toBe(
      "payments-filtered-2026-08-13.csv",
    )
  })

  it("refuses a scope that would reshape the filename", () => {
    // Callers pass an allowlisted value; this is the second line of defence.
    const date = new Date("2026-08-13T10:00:00.000Z")
    expect(exportFilename(date, "../../etc/passwd")).toBe(
      "payments-2026-08-13.csv",
    )
    expect(exportFilename(date, "a b")).toBe("payments-2026-08-13.csv")
  })
})
