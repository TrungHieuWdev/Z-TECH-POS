import ExcelJS from 'exceljs';
import * as service from '../services/revenueReportService.js';
import {
  validateAiReportHistoryId,
  validateAiReportHistoryQuery,
  validateRevenueReportQuery
} from '../validation/revenueReportValidation.js';

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
export const getCostReconciliation = handler(service.getCostReconciliation);
export async function getAiAnalysis(req, res) {
  try {
    const filters = validateRevenueReportQuery(req.query);
    res.json(await service.getAiAnalysis(filters, { requestedBy: req.user?.id }));
  } catch (error) {
    res.status(error.status || 500).json({ message: error.status ? error.message : 'Không thể tải phân tích AI', ...(process.env.NODE_ENV === 'development' ? { error: error.message } : {}) });
  }
}

export async function getAiAnalysisHistory(req, res) {
  try {
    const filters = validateAiReportHistoryQuery(req.query);
    res.json(await service.getAiAnalysisHistory(filters));
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.status ? error.message : 'Không thể tải lịch sử phân tích AI',
      ...(process.env.NODE_ENV === 'development' ? { error: error.message } : {})
    });
  }
}

export async function getAiAnalysisHistoryItem(req, res) {
  try {
    const id = validateAiReportHistoryId(req.params.id);
    res.json(await service.getAiAnalysisHistoryItem(id));
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.status ? error.message : 'Không thể tải kết quả phân tích AI',
      ...(process.env.NODE_ENV === 'development' ? { error: error.message } : {})
    });
  }
}

export async function deleteAiAnalysisHistoryItem(req, res) {
  try {
    const id = validateAiReportHistoryId(req.params.id);
    res.json(await service.deleteAiAnalysisHistoryItem(id));
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.status ? error.message : 'Không thể xóa lịch sử phân tích AI',
      ...(process.env.NODE_ENV === 'development' ? { error: error.message } : {})
    });
  }
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

const excelColors = {
  navy: 'FF0F172A',
  cyan: 'FF0891B2',
  lightCyan: 'FFE6F7FA',
  lightSlate: 'FFF1F5F9',
  white: 'FFFFFFFF',
  border: 'FFCBD5E1'
};

function styleExcelHeader(row) {
  row.height = 25;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: excelColors.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: excelColors.cyan } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: excelColors.border } },
      left: { style: 'thin', color: { argb: excelColors.border } },
      bottom: { style: 'thin', color: { argb: excelColors.border } },
      right: { style: 'thin', color: { argb: excelColors.border } }
    };
  });
}

function addExcelDataSheet(workbook, name, columns, rows) {
  const worksheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  worksheet.columns = columns;
  worksheet.addRows(rows);
  styleExcelHeader(worksheet.getRow(1));
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: columns.length }
  };

  columns.forEach((column, index) => {
    const excelColumn = worksheet.getColumn(index + 1);
    if (column.numFmt) excelColumn.numFmt = column.numFmt;
    excelColumn.alignment = {
      vertical: 'middle',
      horizontal: column.align || (column.numFmt ? 'right' : 'left'),
      wrapText: true
    };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 22;
    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: 'hair', color: { argb: excelColors.border } }
      };
    });
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  return worksheet;
}

function createRevenueWorkbook(filters, data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Z-TECH POS';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const summary = workbook.addWorksheet('Tổng quan', {
    views: [{ state: 'frozen', ySplit: 7 }]
  });
  summary.columns = [
    { width: 26 }, { width: 23 }, { width: 21 }, { width: 22 }, { width: 22 }, { width: 22 }
  ];
  summary.mergeCells('A1:F1');
  summary.getCell('A1').value = 'BÁO CÁO TỔNG QUAN KINH DOANH';
  summary.getCell('A1').font = { size: 18, bold: true, color: { argb: excelColors.white } };
  summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: excelColors.navy } };
  summary.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  summary.getRow(1).height = 36;
  summary.mergeCells('A2:F2');
  summary.getCell('A2').value = `Kỳ dữ liệu: ${filters.from} đến ${filters.to}`;
  summary.getCell('A2').font = { italic: true, color: { argb: 'FF475569' } };
  summary.getCell('A2').alignment = { horizontal: 'center' };

  const options = data.summary.filterOptions || {};
  const categoryName = options.categories?.find((item) => Number(item.id) === Number(filters.categoryId))?.name || 'Tất cả danh mục';
  const employeeName = options.employees?.find((item) => Number(item.id) === Number(filters.employeeId))?.name || 'Tất cả nhân viên';
  const paymentLabels = { cash: 'Tiền mặt', card: 'Thẻ', transfer: 'Chuyển khoản', e_wallet: 'Ví điện tử', other: 'Khác' };
  const statusLabels = { all: 'Tất cả trạng thái', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
  summary.addRow([]);
  summary.addRow(['Bộ lọc', 'Danh mục', categoryName, 'Nhân viên', employeeName, '']);
  summary.addRow(['', 'Thanh toán', paymentLabels[filters.paymentMethod] || 'Tất cả phương thức', 'Trạng thái', statusLabels[filters.orderStatus] || filters.orderStatus, '']);
  summary.addRow(['', 'So sánh kỳ trước', filters.compare ? 'Có' : 'Không', '', '', '']);
  summary.getRows(4, 3).forEach((row) => {
    row.eachCell((cell, columnNumber) => {
      if (columnNumber === 1 || columnNumber === 2 || columnNumber === 4) cell.font = { bold: true, color: { argb: excelColors.navy } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: excelColors.lightSlate } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  });

  const metrics = data.summary.metrics || {};
  summary.addRow([]);
  const metricHeader = summary.addRow(['Chỉ số KPI', 'Giá trị', 'Đơn vị', 'So với kỳ trước', 'Ghi chú', '']);
  styleExcelHeader(metricHeader);
  const metricRows = [
    ['Doanh thu thuần', Number(metrics.netRevenue || 0), 'VNĐ', metrics.changes?.netRevenue ?? '', 'Doanh thu sau giảm giá và hoàn trả'],
    ['Giá vốn hàng bán', metrics.cost == null ? null : Number(metrics.cost), 'VNĐ', metrics.changes?.cost ?? '', metrics.costDataComplete ? 'Giá vốn của đơn hoàn thành' : 'Chưa đủ dữ liệu giá vốn'],
    ['Lợi nhuận gộp', metrics.grossProfit == null ? null : Number(metrics.grossProfit), 'VNĐ', metrics.changes?.grossProfit ?? '', metrics.costDataComplete ? 'Doanh thu thuần trừ giá vốn' : 'Chưa đủ dữ liệu giá vốn'],
    ['Đơn hoàn thành', Number(metrics.completedOrders || 0), 'Đơn', metrics.changes?.completedOrders ?? '', 'Số hóa đơn hoàn thành'],
    ['Giá trị trung bình/đơn', Number(metrics.averageOrderValue || 0), 'VNĐ', metrics.changes?.averageOrderValue ?? '', 'Doanh thu thuần trên mỗi đơn'],
    ['Giảm giá', Number(metrics.discount || 0), 'VNĐ', metrics.changes?.discount ?? '', 'Tổng giảm giá trong kỳ'],
    ['Hoàn trả', Number(metrics.refunds || 0), 'VNĐ', metrics.changes?.refunds ?? '', 'Tổng tiền hoàn trả trong kỳ']
  ];
  metricRows.forEach((values) => summary.addRow(values));
  for (let rowNumber = metricHeader.number + 1; rowNumber <= metricHeader.number + metricRows.length; rowNumber += 1) {
    const row = summary.getRow(rowNumber);
    row.getCell(2).numFmt = '#,##0 "đ"';
    row.getCell(4).numFmt = '0.0"%"';
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'hair', color: { argb: excelColors.border } } };
    });
  }

  const notes = Object.values(data.summary.notes || {});
  if (notes.length) {
    summary.addRow([]);
    const noteHeader = summary.addRow(['Lưu ý dữ liệu']);
    noteHeader.getCell(1).font = { bold: true, color: { argb: excelColors.navy } };
    notes.forEach((note) => {
      const row = summary.addRow([`• ${note}`]);
      summary.mergeCells(row.number, 1, row.number, 6);
      row.getCell(1).alignment = { wrapText: true, vertical: 'top' };
      row.height = 34;
    });
  }

  addExcelDataSheet(workbook, 'Xu hướng doanh thu', [
    { header: 'Thời điểm', key: 'label', width: 20 },
    { header: 'Doanh thu thuần', key: 'netRevenue', width: 22, numFmt: '#,##0 "đ"' },
    { header: 'Lợi nhuận gộp', key: 'grossProfit', width: 22, numFmt: '#,##0 "đ"' }
  ], (data.trend.points || []).map((item) => ({
    label: item.label,
    netRevenue: Number(item.netRevenue || 0),
    grossProfit: item.grossProfit == null ? null : Number(item.grossProfit)
  })));

  addExcelDataSheet(workbook, 'Doanh thu danh mục', [
    { header: 'Danh mục', key: 'name', width: 30 },
    { header: 'Số lượng bán', key: 'soldQuantity', width: 18, numFmt: '#,##0' },
    { header: 'Doanh thu thuần', key: 'netRevenue', width: 22, numFmt: '#,##0 "đ"' },
    { header: 'Tỷ trọng', key: 'percentage', width: 15, numFmt: '0.0"%"' }
  ], data.categories);

  addExcelDataSheet(workbook, 'Thanh toán', [
    { header: 'Phương thức', key: 'paymentMethodLabel', width: 24 },
    { header: 'Số giao dịch', key: 'transactionCount', width: 18, numFmt: '#,##0' },
    { header: 'Số tiền', key: 'amount', width: 22, numFmt: '#,##0 "đ"' },
    { header: 'Tỷ trọng', key: 'percentage', width: 15, numFmt: '0.0"%"' }
  ], data.payments.map((item) => ({
    ...item,
    paymentMethodLabel: paymentLabels[item.paymentMethod] || item.paymentMethod
  })));

  addExcelDataSheet(workbook, 'Sản phẩm', [
    { header: 'Mã sản phẩm', key: 'sku', width: 18 },
    { header: 'Tên sản phẩm', key: 'name', width: 38 },
    { header: 'Danh mục', key: 'categoryName', width: 24 },
    { header: 'SL bán', key: 'soldQuantity', width: 13, numFmt: '#,##0' },
    { header: 'Doanh thu gộp', key: 'grossRevenue', width: 20, numFmt: '#,##0 "đ"' },
    { header: 'Giảm giá', key: 'discount', width: 18, numFmt: '#,##0 "đ"' },
    { header: 'Hoàn trả', key: 'refunds', width: 18, numFmt: '#,##0 "đ"' },
    { header: 'Doanh thu thuần', key: 'netRevenue', width: 20, numFmt: '#,##0 "đ"' },
    { header: 'Giá vốn', key: 'cost', width: 18, numFmt: '#,##0 "đ"' },
    { header: 'Lợi nhuận gộp', key: 'grossProfit', width: 20, numFmt: '#,##0 "đ"' },
    { header: 'Biên lợi nhuận', key: 'margin', width: 17, numFmt: '0.0"%"' },
    { header: 'SL hoàn trả', key: 'returnedQuantity', width: 16, numFmt: '#,##0' }
  ], data.products);

  const priorityLabels = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
  addExcelDataSheet(workbook, 'Cảnh báo nhập hàng', [
    { header: 'Mã sản phẩm', key: 'sku', width: 18 },
    { header: 'Tên sản phẩm', key: 'productName', width: 38 },
    { header: 'Danh mục', key: 'categoryName', width: 24 },
    { header: 'Tồn hiện tại', key: 'currentStock', width: 15, numFmt: '#,##0' },
    { header: 'Tồn tối thiểu', key: 'minStock', width: 15, numFmt: '#,##0' },
    { header: 'Đã bán 30 ngày', key: 'sold30Days', width: 18, numFmt: '#,##0' },
    { header: 'Còn đủ bán (ngày)', key: 'daysOfStockLeft', width: 19, numFmt: '0.0' },
    { header: 'Đề xuất nhập', key: 'suggestedQuantity', width: 16, numFmt: '#,##0' },
    { header: 'Chi phí dự kiến', key: 'estimatedCost', width: 20, numFmt: '#,##0 "đ"' },
    { header: 'Ưu tiên', key: 'priorityLabel', width: 15 },
    { header: 'Lý do', key: 'reason', width: 45 }
  ], data.stockAlerts.map((item) => ({
    ...item,
    priorityLabel: priorityLabels[item.priority] || item.priority
  })));

  return workbook;
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

export async function exportRevenueExcel(req, res) {
  try {
    const filters = validateRevenueReportQuery({ ...req.query, page: 1, limit: 100 });
    const data = await service.getExcelExportData(filters);
    const workbook = createRevenueWorkbook(filters, data);
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bao-cao-tong-quan-${filters.from}-${filters.to}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(error.status || 500).json({
      message: error.status ? error.message : 'Không thể xuất báo cáo Excel',
      ...(process.env.NODE_ENV === 'development' ? { error: error.message } : {})
    });
  }
}
