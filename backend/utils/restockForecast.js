const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const divide = (value, days) => (days > 0 ? Number(value || 0) / days : 0);

export function calculateRestockForecast(input) {
  const currentStock = Math.max(0, Number(input.currentStock || 0));
  const sold7Days = Math.max(0, Number(input.sold7Days || 0));
  const sold30Days = Math.max(0, Number(input.sold30Days || 0));
  const sold90Days = Math.max(0, Number(input.sold90Days || 0));
  const productAgeDays = Math.max(1, Number(input.productAgeDays || 1));
  const actualDays7 = Math.max(1, Math.min(7, productAgeDays));
  const actualDays30 = Math.max(1, Math.min(30, productAgeDays));
  const actualDays90 = Math.max(1, Math.min(90, productAgeDays));
  const rate7 = divide(sold7Days, actualDays7);
  const rate30 = divide(sold30Days, actualDays30);
  const rate90 = divide(sold90Days, actualDays90);
  const forecastPerDayRaw = 0.5 * rate7 + 0.3 * rate30 + 0.2 * rate90;
  const safetyStock = Math.ceil(forecastPerDayRaw * input.safetyDays);
  const forecastQtyTarget = Math.ceil(forecastPerDayRaw * input.targetDays);
  const reorderPoint = Math.ceil(forecastPerDayRaw * input.leadTimeDays + safetyStock);
  const suggestedQuantity = Math.max(0, Math.ceil(
    forecastPerDayRaw * input.targetDays + safetyStock - currentStock
  ));

  return {
    actualDays7,
    actualDays30,
    actualDays90,
    rate7: round(rate7),
    rate30: round(rate30),
    rate90: round(rate90),
    forecastPerDay: round(forecastPerDayRaw),
    forecastQtyTarget,
    safetyStock,
    reorderPoint,
    suggestedQuantity,
    daysCover: forecastPerDayRaw > 0 ? round(currentStock / forecastPerDayRaw, 1) : null
  };
}

export function classifyRestockPriority({ currentStock, sold7Days, sold30Days, sold90Days, forecastQtyTarget, reorderPoint, daysCover, leadTimeDays }) {
  const hasAnySales = sold90Days > 0;
  const reliableDemand = forecastQtyTarget >= 5 || sold7Days > 0 || sold30Days >= 3;
  const weakDemand = forecastQtyTarget < 3 && sold30Days < 2 && sold90Days < 5;
  const shouldReorder = currentStock <= reorderPoint;

  if (!hasAnySales) return 'insufficient';
  if (weakDemand) return currentStock <= 0 ? 'medium' : 'low';
  if (reliableDemand && shouldReorder && (currentStock <= 0 || daysCover <= leadTimeDays)) return 'high';
  if (shouldReorder || (daysCover !== null && daysCover <= leadTimeDays + 7)) return 'medium';
  return 'low';
}
