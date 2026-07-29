(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PortfolioEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const EPSILON = 1e-10;

  function finite(value, fallback = null) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeSymbol(value) {
    return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  function normalizeCurrency(value) {
    return String(value || "USD").trim().toUpperCase().slice(0, 5);
  }

  function normalizeUnit(value) {
    return String(value || "unit").trim().toLowerCase() || "unit";
  }

  function assetKey(record) {
    return [
      String(record.assetType || "OTHER").trim().toUpperCase(),
      normalizeSymbol(record.symbol),
      normalizeCurrency(record.currency),
      normalizeUnit(record.unit),
    ].join("|");
  }

  function normalizedTransaction(transaction) {
    return {
      id: String(transaction.id || ""),
      createdAt: String(transaction.createdAt || ""),
      date: String(transaction.date || ""),
      assetType: String(transaction.assetType || "OTHER").trim().toUpperCase(),
      symbol: normalizeSymbol(transaction.symbol),
      name: String(transaction.name || transaction.symbol || "").trim(),
      currency: normalizeCurrency(transaction.currency),
      unit: normalizeUnit(transaction.unit),
      side: String(transaction.side || "BUY").trim().toUpperCase(),
      quantity: finite(transaction.quantity),
      unitPrice: finite(transaction.unitPrice),
      fee: finite(transaction.fee, 0),
      notes: String(transaction.notes || "").trim(),
    };
  }

  function transactionErrors(transaction) {
    const errors = [];
    if (!transaction.id) errors.push("MISSING_ID");
    if (!transaction.date || Number.isNaN(new Date(`${transaction.date}T00:00:00Z`).getTime())) errors.push("INVALID_DATE");
    if (!transaction.symbol) errors.push("MISSING_SYMBOL");
    if (!["BUY", "SELL"].includes(transaction.side)) errors.push("INVALID_SIDE");
    if (!(transaction.quantity > 0)) errors.push("INVALID_QUANTITY");
    if (!(transaction.unitPrice >= 0)) errors.push("INVALID_UNIT_PRICE");
    if (!(transaction.fee >= 0)) errors.push("INVALID_FEE");
    return errors;
  }

  function resolveMarketPrice(position, marketPrices) {
    const candidates = [position.key, position.symbol, normalizeSymbol(position.providerSymbol)];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const raw = marketPrices[candidate];
      if (raw === undefined || raw === null) continue;
      if (typeof raw === "number") return { price: finite(raw), date: null, source: "manual" };
      const price = finite(raw.price);
      if (price !== null) return { price, date: raw.date || null, source: raw.source || "manual" };
    }
    return { price: null, date: null, source: null };
  }

  function calculate(transactions, marketPrices = {}) {
    const normalized = (transactions || []).map(normalizedTransaction).sort((a, b) => {
      const dateOrder = a.date.localeCompare(b.date);
      if (dateOrder !== 0) return dateOrder;
      const createdOrder = a.createdAt.localeCompare(b.createdAt);
      if (createdOrder !== 0) return createdOrder;
      return a.id.localeCompare(b.id);
    });

    const positions = new Map();
    const errors = [];
    const ledger = [];

    for (const transaction of normalized) {
      const basicErrors = transactionErrors(transaction);
      if (basicErrors.length) {
        errors.push({ transactionId: transaction.id, codes: basicErrors });
        continue;
      }

      const key = assetKey(transaction);
      const position = positions.get(key) || {
        key,
        assetType: transaction.assetType,
        symbol: transaction.symbol,
        providerSymbol: transaction.symbol,
        name: transaction.name || transaction.symbol,
        currency: transaction.currency,
        unit: transaction.unit,
        quantity: 0,
        averageCost: 0,
        realizedPnl: 0,
        totalBuyCost: 0,
        totalSellProceeds: 0,
        totalFees: 0,
        transactionCount: 0,
      };

      let realizedForTransaction = 0;
      const gross = transaction.quantity * transaction.unitPrice;

      if (transaction.side === "BUY") {
        const acquisitionCost = gross + transaction.fee;
        const existingCost = position.quantity * position.averageCost;
        const newQuantity = position.quantity + transaction.quantity;
        position.averageCost = newQuantity > EPSILON ? (existingCost + acquisitionCost) / newQuantity : 0;
        position.quantity = newQuantity;
        position.totalBuyCost += acquisitionCost;
      } else {
        if (transaction.quantity > position.quantity + EPSILON) {
          errors.push({
            transactionId: transaction.id,
            codes: ["SELL_EXCEEDS_HOLDING"],
            availableQuantity: position.quantity,
            requestedQuantity: transaction.quantity,
            assetKey: key,
          });
          continue;
        }
        const netProceeds = gross - transaction.fee;
        realizedForTransaction = netProceeds - transaction.quantity * position.averageCost;
        position.realizedPnl += realizedForTransaction;
        position.totalSellProceeds += netProceeds;
        position.quantity -= transaction.quantity;
        if (Math.abs(position.quantity) <= EPSILON) {
          position.quantity = 0;
          position.averageCost = 0;
        }
      }

      position.name = transaction.name || position.name;
      position.totalFees += transaction.fee;
      position.transactionCount += 1;
      positions.set(key, position);
      ledger.push({ ...transaction, key, gross, realizedPnl: realizedForTransaction });
    }

    const holdings = [...positions.values()].map(position => {
      const quote = resolveMarketPrice(position, marketPrices);
      const remainingCost = position.quantity * position.averageCost;
      const marketValue = quote.price === null ? null : position.quantity * quote.price;
      const unrealizedPnl = marketValue === null ? null : marketValue - remainingCost;
      return {
        ...position,
        remainingCost,
        currentPrice: quote.price,
        currentPriceDate: quote.date,
        currentPriceSource: quote.source,
        marketValue,
        unrealizedPnl,
      };
    }).sort((a, b) => a.symbol.localeCompare(b.symbol));

    const totalsByCurrency = {};
    for (const holding of holdings) {
      const currency = holding.currency;
      const totals = totalsByCurrency[currency] || {
        currency,
        remainingCost: 0,
        marketValue: 0,
        unrealizedPnl: 0,
        realizedPnl: 0,
        fees: 0,
        missingMarketValueCount: 0,
      };
      totals.remainingCost += holding.remainingCost;
      totals.realizedPnl += holding.realizedPnl;
      totals.fees += holding.totalFees;
      if (holding.marketValue === null) {
        totals.missingMarketValueCount += holding.quantity > EPSILON ? 1 : 0;
      } else {
        totals.marketValue += holding.marketValue;
        totals.unrealizedPnl += holding.unrealizedPnl;
      }
      totalsByCurrency[currency] = totals;
    }

    return {
      holdings,
      openHoldings: holdings.filter(holding => holding.quantity > EPSILON),
      closedHoldings: holdings.filter(holding => holding.quantity <= EPSILON),
      ledger,
      errors,
      totalsByCurrency,
      isValid: errors.length === 0,
      costMethod: "WEIGHTED_AVERAGE",
    };
  }

  function validateAddition(transactions, transaction) {
    const candidate = normalizedTransaction(transaction);
    const result = calculate([...(transactions || []), candidate]);
    return result.errors.filter(error => error.transactionId === candidate.id);
  }

  return {
    EPSILON,
    assetKey,
    calculate,
    finite,
    normalizeCurrency,
    normalizeSymbol,
    normalizeUnit,
    normalizedTransaction,
    validateAddition,
  };
});
