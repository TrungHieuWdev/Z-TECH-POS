import * as service from '../services/revenueReportService.js';
import { validateRevenueReportQuery } from '../validation/revenueReportValidation.js';

const handler = (serviceMethod) => async (req, res) => {
  try {
    const filters = validateRevenueReportQuery(req.query);
    res.json(await serviceMethod(filters));
  } catch (error) {
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể tải báo cáo doanh thu', ...(process.env.NODE_ENV === 'development' ? { error: error.message } : {}) });
  }
};

export const getSummary = handler(service.getSummary);
export const getTrend = handler(service.getTrend);
export const getCategories = handler(service.getCategories);
export const getPaymentMethods = handler(service.getPaymentMethods);
export const getHourly = handler(service.getHourly);
export const getStockAlerts = handler(service.getStockAlerts);
export const getProducts = handler(service.getProducts);
export async function getAiAnalysis(req, res) {
  try {
    const filters = validateRevenueReportQuery(req.query);
    res.json(await service.getAiAnalysis(filters, { requestedBy: req.user?.id }));
  } catch (error) {
    res.status(error.status || 500).json({ message: error.status ? error.message : 'KhÃ´ng thá»ƒ táº£i bÃ¡o cÃ¡o doanh thu', ...(process.env.NODE_ENV === 'development' ? { error: error.message } : {}) });
  }
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export async function exportRevenue(req, res) {
  try {
    const filters = validateRevenueReportQuery({ ...req.query, page: 1, limit: 100 });
    const rows = await service.getExportRows(filters);
    const headers = ['Mã sản phẩm', 'Tên sản phẩm', 'Danh mục', 'SL bán', 'Doanh thu gộp', 'Giảm giá', 'Doanh thu thuần', 'Giá vốn', 'Lợi nhuận gộp', 'Biên lợi nhuận (%)', 'SL hoàn trả'];
    const csv = [headers, ...rows.map((row) => [row.sku, row.name, row.categoryName, row.soldQuantity, row.grossRevenue, row.discount, row.netRevenue, row.cost, row.grossProfit, row.margin, row.returnedQuantity])]
      .map((row) => row.map(csvCell).join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bao-cao-doanh-thu-${filters.from}-${filters.to}.csv"`);
    res.send(`\ufeff${csv}`);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể xuất báo cáo doanh thu' });
  }
}
