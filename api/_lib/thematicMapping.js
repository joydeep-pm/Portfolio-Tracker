function instrumentKey(exchange, symbol) {
  return `${String(exchange || "NSE").toUpperCase()}:${String(symbol || "").toUpperCase()}`;
}

function normalizeThemeItem(item = {}) {
  return {
    indexId: String(item.indexId || ""),
    indexName: String(item.indexName || "UNMAPPED"),
    indexCategory: String(item.indexCategory || "unclassified"),
    sectorTag: String(item.sectorTag || "Unknown"),
    source: String(item.source || "unknown"),
  };
}

function mapHoldingsToThemes(rows = [], catalog = {}, asOf = new Date().toISOString()) {
  const mappings = [];
  const summaryByCategory = {};
  const themeCoverageByInstrument = {};

  const symbolToThemes = catalog.symbolToThemes || {};

  rows.forEach((row) => {
    const symbol = String(row.symbol || "").toUpperCase();
    const exchange = String(row.exchange || "NSE").toUpperCase();
    if (!symbol) return;

    const key = instrumentKey(exchange, symbol);
    const exact = Array.isArray(symbolToThemes[key]) ? symbolToThemes[key] : [];
    const nseFallback = Array.isArray(symbolToThemes[`NSE:${symbol}`]) ? symbolToThemes[`NSE:${symbol}`] : [];
    const themeItems = (exact.length ? exact : nseFallback).map(normalizeThemeItem);

    const resolved = themeItems.length
      ? themeItems
      : [
          {
            indexId: "unmapped",
            indexName: "UNMAPPED",
            indexCategory: "unclassified",
            sectorTag: "Unknown",
            source: "no-match",
          },
        ];

    themeCoverageByInstrument[key] = resolved.length;

    resolved.forEach((theme) => {
      mappings.push({
        symbol,
        exchange,
        index_category: theme.indexCategory,
        index_name: theme.indexName,
        index_id: theme.indexId,
        sector_tag: theme.sectorTag,
        source: theme.source,
        asOf,
      });

      if (!summaryByCategory[theme.indexCategory]) {
        summaryByCategory[theme.indexCategory] = {
          holdings: 0,
          mappings: 0,
        };
      }
      summaryByCategory[theme.indexCategory].mappings += 1;
    });
  });

  Object.keys(themeCoverageByInstrument).forEach((key) => {
    const firstMapping = mappings.find((item) => instrumentKey(item.exchange, item.symbol) === key);
    const category = firstMapping?.index_category || "unclassified";
    if (!summaryByCategory[category]) {
      summaryByCategory[category] = {
        holdings: 0,
        mappings: 0,
      };
    }
    summaryByCategory[category].holdings += 1;
  });

  return {
    mappings,
    summary: {
      totalMappings: mappings.length,
      totalHoldingsCovered: Object.keys(themeCoverageByInstrument).length,
      byCategory: summaryByCategory,
    },
  };
}

module.exports = {
  mapHoldingsToThemes,
  instrumentKey,
};
