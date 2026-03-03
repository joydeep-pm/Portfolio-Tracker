const test = require("node:test");
const assert = require("node:assert/strict");

const { assemblePortfolioSnapshot } = require("../api/_lib/portfolioAssembler");

test("assembler avoids double-counting CNC position duplicate against holdings", () => {
  const snapshot = assemblePortfolioSnapshot({
    holdings: [
      {
        tradingsymbol: "INFY",
        exchange: "NSE",
        quantity: 10,
        average_price: 1000,
        last_price: 1100,
        product: "CNC",
      },
    ],
    positions: [
      {
        tradingsymbol: "INFY",
        exchange: "NSE",
        quantity: 10,
        average_price: 1000,
        last_price: 1110,
        product: "CNC",
      },
    ],
    quotesByKey: {},
    returnsByKey: {
      "NSE:INFY": { "1D": 1, "1W": 2, "1M": 3, "6M": 4, YTD: 5 },
    },
  });

  assert.equal(snapshot.rows.length, 1);
  assert.equal(snapshot.rows[0].quantity, 10);
  assert.equal(snapshot.rows[0].currentValue, 11000);
});

test("assembler uses holding last_price when quote is unavailable", () => {
  const snapshot = assemblePortfolioSnapshot({
    holdings: [
      {
        tradingsymbol: "TCS",
        exchange: "NSE",
        quantity: 5,
        average_price: 3000,
        last_price: 3150,
        product: "CNC",
      },
    ],
    positions: [],
    quotesByKey: {},
    returnsByKey: {
      "NSE:TCS": { "1D": 1, "1W": 2, "1M": 3, "6M": 4, YTD: 5 },
    },
  });

  assert.equal(snapshot.rows[0].lastPrice, 3150);
  assert.equal(snapshot.rows[0].currentValue, 15750);
  assert.equal(snapshot.rows[0].investedValue, 15000);
});
