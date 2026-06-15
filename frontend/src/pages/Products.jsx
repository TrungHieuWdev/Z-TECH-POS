import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { Download, Edit, FileSpreadsheet, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import Modal from '../components/Modal';
import ProductImage from '../components/ProductImage';
import { formatCurrency } from '../utils/format';
import { getUser, isFullAccessRole } from '../utils/auth';

const deviceFamilyOptions = [
  { value: 'apple', label: 'Apple' },
  { value: 'samsung', label: 'Samsung' },
  { value: 'vivo', label: 'Vivo' },
  { value: 'oppo', label: 'Oppo' },
  { value: 'xiaomi', label: 'Xiaomi / Redmi' }
];

const initialForm = {
  category_id: '',
  device_family: '',
  device_model_id: '',
  name: '',
  description: '',
  price: '',
  cost_price: '',
  stock_quantity: 0,
  min_stock: 5,
  image_url: ''
};

const importTemplateHeaders = ['ten_san_pham', 'dong_may', 'danh_muc', 'gia', 'ton_kho', 'image_url', 'mo_ta'];
const importColumnAliases = {
  ten_san_pham: ['ten_san_pham', 'ten_san_pham_', 'ten', 'ten_sản_phẩm', 'ten_san_pham_phu_kien', 'name', 'product_name'],
  dong_may: ['dong_may', 'dong_may_tuong_thich', 'dong_may_tuong_thich_', 'model', 'model_may', 'device_model'],
  danh_muc: ['danh_muc', 'category', 'loai', 'phan_loai'],
  gia: ['gia', 'gia_ban', 'gia_ban_vnd', 'price', 'vnd'],
  ton_kho: ['ton_kho', 'ton', 'so_luong', 'quantity', 'stock'],
  image_url: ['image_url', 'link_hinh_anh_url', 'link_hinh_anh', 'link_anh', 'anh', 'url', 'image'],
  mo_ta: ['mo_ta', 'mo_ta_chi_tiet', 'mo_ta_chi_tiet_', 'description', 'ghi_chu']
};

function normalizeImportText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeImportKey(value = '') {
  return normalizeImportText(value).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function readImportNumber(value) {
  const number = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(number) ? number : NaN;
}

function getImportCell(row, field) {
  const aliases = importColumnAliases[field] || [field];

  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== '') {
      return row[alias];
    }
  }

  return '';
}

function getImportHeaderScore(row = []) {
  const keys = new Set(row.map((cell) => normalizeImportKey(cell)).filter(Boolean));
  return Object.values(importColumnAliases).filter((aliases) => aliases.some((alias) => keys.has(alias))).length;
}

function readImportSheetRows(worksheet) {
  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
  const headerIndex = matrix.findIndex((row) => getImportHeaderScore(row) >= 3);

  if (headerIndex === -1) {
    return XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
  }

  const headers = matrix[headerIndex].map((cell) => normalizeImportKey(cell));

  return matrix.slice(headerIndex + 1).map((row) => {
    const item = {};

    headers.forEach((header, index) => {
      if (header) item[header] = row[index] ?? '';
    });

    return item;
  });
}

function getDeviceFamilyLabel(value) {
  return deviceFamilyOptions.find((option) => option.value === value)?.label || 'Chưa chọn';
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hasFullAccess = isFullAccessRole(getUser()?.role);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [deviceModels, setDeviceModels] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [deviceFamily, setDeviceFamily] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const lowStockOnly = searchParams.get('lowStock') === '1';

  const formDeviceModels = useMemo(() => {
    if (!form.device_family) return deviceModels;
    return deviceModels.filter((model) => model.family === form.device_family);
  }, [deviceModels, form.device_family]);

  const importSummary = useMemo(() => {
    const validRows = importRows.filter((row) => row.isValid);
    return {
      validRows,
      validCount: validRows.length,
      errorCount: importRows.length - validRows.length
    };
  }, [importRows]);

  const closeImportModal = () => {
    setIsImportOpen(false);
    setImportStep(1);
    setImportRows([]);
    setImportFileName('');
    setIsImporting(false);
  };

  const downloadImportTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        ten_san_pham: 'Tai nghe Bluetooth Z-Tech Air',
        dong_may: 'Phụ kiện chung',
        danh_muc: 'Tai nghe & âm thanh',
        gia: 349000,
        ton_kho: 12,
        image_url: 'https://example.com/tai-nghe.jpg',
        mo_ta: 'Tai nghe Bluetooth dùng cho nhiều thiết bị'
      },
      {
        ten_san_pham: 'Kinh cường lực iPhone 17 Pro Max',
        dong_may: 'iPhone 17 Pro Max',
        danh_muc: 'Kính cường lực',
        gia: 79000,
        ton_kho: 20,
        image_url: 'https://example.com/image.jpg',
        mo_ta: 'Mô tả sản phẩm'
      }
    ], { header: importTemplateHeaders });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'products');
    XLSX.writeFile(workbook, 'template_import_san_pham.xlsx');
  };

  const buildImportRows = (rows) => {
    const categoryMap = new Map(categories.map((category) => [normalizeImportText(category.name), category]));
    const modelMap = new Map(deviceModels.map((model) => [normalizeImportText(model.name), model]));
    return rows
      .filter((row) => Object.values(row).some((value) => String(value ?? '').trim() !== ''))
      .filter((row) => !Object.values(row).some((value) => normalizeImportText(value).includes('tong cong')))
      .map((row, index) => {
        const normalized = {};

        for (const [key, value] of Object.entries(row)) {
          normalized[normalizeImportKey(key)] = value;
        }

        const name = String(getImportCell(normalized, 'ten_san_pham')).trim();
        const deviceText = String(getImportCell(normalized, 'dong_may')).trim() || 'Phụ kiện chung';
        const categoryText = String(getImportCell(normalized, 'danh_muc')).trim() || 'Khác';
        const price = readImportNumber(getImportCell(normalized, 'gia'));
        const stockQuantity = readImportNumber(getImportCell(normalized, 'ton_kho'));
        const category = categoryMap.get(normalizeImportText(categoryText)) || { id: '' };
        const deviceModel = modelMap.get(normalizeImportText(deviceText)) || { id: '', family: '', isNew: true };
        const errors = [];

        if (!name) errors.push('Thiếu tên sản phẩm');
        if (!deviceText) errors.push('Thiếu dòng máy');
        if (deviceText && !deviceModel) errors.push('Dòng máy không khớp');
        if (!categoryText) errors.push('Thiếu danh mục');
        if (categoryText && !category) errors.push('Danh mục không khớp');
        if (!Number.isFinite(price) || price <= 0) errors.push('Giá không hợp lệ');
        if (!Number.isFinite(stockQuantity) || stockQuantity < 0) errors.push('Tồn kho không hợp lệ');

        return {
          rowNumber: index + 2,
          name,
          deviceText,
          categoryText,
          price,
          stockQuantity,
          image_url: String(getImportCell(normalized, 'image_url')).trim(),
          description: String(getImportCell(normalized, 'mo_ta')).trim(),
          category_id: category?.id || '',
          device_model_id: deviceModel?.id || '',
          device_family: deviceModel?.family || '',
          errors,
          isValid: errors.length === 0
        };
      });
  };

  const handleImportFile = async (file) => {
    if (!file) return;

    const isSupported = /\.(xlsx|xls|csv)$/i.test(file.name);
    if (!isSupported) {
      toast.error('Vui lòng chọn file .xlsx hoặc .csv');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = readImportSheetRows(worksheet);
      const nextRows = buildImportRows(rows);

      setImportRows(nextRows);
      setImportFileName(file.name);
      setImportStep(2);

      if (nextRows.length === 0) {
        toast.error('File không có dữ liệu sản phẩm');
      }
    } catch (error) {
      toast.error('Không thể đọc file Excel');
    }
  };

  const handleImportConfirm = async () => {
    if (importSummary.validCount === 0) {
      toast.error('Không có sản phẩm hợp lệ để import');
      return;
    }

    const payload = importSummary.validRows.map((row) => ({
      category_id: row.category_id,
      device_model_id: row.device_model_id,
      category_name: row.categoryText,
      device_model_name: row.deviceText,
      name: row.name,
      description: row.description,
      price: row.price,
      stock_quantity: row.stockQuantity,
      min_stock: 5,
      image_url: row.image_url
    }));

    try {
      setIsImporting(true);
      const response = await api.post('/products/import', payload);
      const { imported = 0, updated = 0, skipped = 0 } = response.data || {};
      toast.success(`Đã thêm ${imported}, bổ sung ${updated}, bỏ qua ${skipped} sản phẩm`);
      closeImportModal();
      await loadProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể import sản phẩm');
      setIsImporting(false);
    }
  };

  async function loadProducts() {
    const params = new URLSearchParams();

    if (search) params.set('search', search);
    if (categoryId) params.set('category_id', categoryId);
    if (deviceFamily) params.set('device_family', deviceFamily);

    const response = await api.get(`/products?${params.toString()}`);
    const allProducts = Array.isArray(response.data) ? response.data : [];
    setProducts(
      lowStockOnly
        ? allProducts.filter((product) => Number(product.stock_quantity || 0) <= Number(product.min_stock || 0))
        : allProducts
    );
  }

  useEffect(() => {
    Promise.all([
      api.get('/categories'),
      api.get('/device-models')
    ]).then(([categoriesResponse, modelsResponse]) => {
      setCategories(categoriesResponse.data);
      setDeviceModels(modelsResponse.data);
    });
  }, []);

  useEffect(() => {
    loadProducts();
  }, [search, categoryId, deviceFamily, lowStockOnly]);

  const openCreate = () => {
    setEditingProduct(null);
    setForm(initialForm);
    setIsOpen(true);
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setForm({
      category_id: product.category_id || '',
      device_family: product.device_family || '',
      device_model_id: product.device_model_id || '',
      name: product.name || '',
      description: product.description || '',
      price: product.price || '',
      cost_price: product.cost_price || '',
      stock_quantity: product.stock_quantity || 0,
      min_stock: product.min_stock || 5,
      image_url: product.image_url || ''
    });
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingProduct(null);
    setForm(initialForm);
  };

  const handleFamilyChange = (value) => {
    setForm({ ...form, device_family: value, device_model_id: '' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      ...form,
      category_id: form.category_id || null,
      device_model_id: form.device_model_id || null,
      price: Number(form.price),
      cost_price: form.cost_price === '' ? null : Number(form.cost_price),
      stock_quantity: Number(form.stock_quantity),
      min_stock: Number(form.min_stock)
    };

    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        toast.success('Đã cập nhật sản phẩm');
      } else {
        await api.post('/products', payload);
        toast.success('Đã thêm sản phẩm');
      }

      closeModal();
      await loadProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lưu sản phẩm');
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Xóa sản phẩm "${product.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/products/${product.id}`);
      toast.success('Đã xóa sản phẩm');
      await loadProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể xóa sản phẩm');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">Sản phẩm</h1>
          <p className="mt-1 text-sm text-gray-500">Quản lý hàng hóa theo danh mục và model máy</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2" style={{ display: hasFullAccess ? undefined : 'none' }}>
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-[#74B8E0] bg-white px-4 py-2.5 font-semibold text-[#3386b8] transition hover:bg-[#eef8fd]"
          >
            <FileSpreadsheet size={18} />
            <span>Nhập từ Excel</span>
          </button>
        <button
          type="button"
          onClick={openCreate}
          style={{ display: hasFullAccess ? undefined : 'none' }}
          className="flex items-center gap-2 rounded-lg bg-[#74B8E0] px-4 py-2.5 font-semibold text-white transition hover:bg-[#74B8E0] active:bg-[#74B8E0]"
        >
          <Plus size={18} />
          <span>Thêm sản phẩm</span>
        </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_220px]">
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2">
          <Search size={18} className="text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full outline-none"
            placeholder="Tìm tên, model hoặc mô tả"
          />
        </div>
        <select
          value={deviceFamily}
          onChange={(event) => setDeviceFamily(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
        >
          <option value="">Tất cả dòng máy</option>
          {deviceFamilyOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {lowStockOnly && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">
            Đang lọc các sản phẩm có tồn kho nhỏ hơn hoặc bằng mức tồn tối thiểu.
          </p>
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
          >
            Xóa bộ lọc
          </button>
        </div>
      )}

      <section className="rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Ảnh</th>
                <th className="px-4 py-3 font-semibold">Tên</th>
                <th className="px-4 py-3 font-semibold">Dòng máy</th>
                <th className="px-4 py-3 font-semibold">Danh mục</th>
                <th className="px-4 py-3 font-semibold">Giá</th>
                <th className="px-4 py-3 font-semibold">Tồn kho</th>
                <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => {
                const isLowStock = Number(product.stock_quantity) <= Number(product.min_stock);

                return (
                  <tr key={product.id}>
                    <td className="px-4 py-3">
                      <div className="h-12 w-12 overflow-hidden rounded-lg border border-[#d7eef3]">
                        <ProductImage product={product} iconSize={22} compact />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-950">{product.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="font-semibold text-gray-800">
                        {product.device_series === 'Phụ kiện chung' ? 'Phụ kiện chung' : getDeviceFamilyLabel(product.device_family)}
                      </div>
                      <div className="text-xs text-gray-500">{product.device_model}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{product.category_name}</td>
                    <td className="px-4 py-3 text-gray-950">{formatCurrency(product.price)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isLowStock ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {product.stock_quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(product)}
                          style={{ display: hasFullAccess ? undefined : 'none' }}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-brand-surface hover:text-brand-strong"
                          title="Sửa"
                          aria-label="Sửa"
                        >
                          <Edit size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(product)}
                          style={{ display: hasFullAccess ? undefined : 'none' }}
                          className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                          title="Xóa"
                          aria-label="Xóa"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal isOpen={isImportOpen} onClose={closeImportModal} title="Import sản phẩm từ Excel" maxWidth="max-w-6xl">
        <div className="space-y-5">
          <div className="grid gap-2 md:grid-cols-3">
            {['Tải template', 'Upload file', 'Xác nhận'].map((label, index) => {
              const step = index + 1;
              const isActive = importStep === step;
              const isDone = importStep > step;

              return (
                <div
                  key={label}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                    isActive || isDone ? 'border-[#74B8E0] bg-[#eef8fd] text-[#1f6f9f]' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  <span className="mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-white text-xs">
                    {step}
                  </span>
                  {label}
                </div>
              );
            })}
          </div>

          {importStep === 1 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-600">
                Tải file mẫu, điền tên sản phẩm, giá, tồn kho và ảnh nếu có. Danh mục hoặc dòng máy mới sẽ được tự tạo khi import.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                {importTemplateHeaders.map((header) => (
                  <span key={header} className="rounded-full bg-white px-3 py-1 font-medium ring-1 ring-gray-200">
                    {header}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={downloadImportTemplate}
                  className="flex items-center gap-2 rounded-lg border border-[#74B8E0] bg-white px-4 py-2 font-semibold text-[#3386b8] transition hover:bg-[#eef8fd]"
                >
                  <Download size={18} />
                  Tải file mẫu
                </button>
                <button type="button" onClick={() => setImportStep(2)} className="rounded-lg bg-[#74B8E0] px-4 py-2 font-semibold text-white">
                  Tiếp tục
                </button>
              </div>
            </div>
          )}

          {importStep === 2 && (
            <div className="space-y-4">
              <label
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleImportFile(event.dataTransfer.files?.[0]);
                }}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#74B8E0] bg-[#f7fcff] px-4 py-8 text-center transition hover:bg-[#eef8fd]"
              >
                <Upload className="mb-3 text-[#3386b8]" size={30} />
                <span className="font-semibold text-gray-900">{importFileName || 'Kéo thả file Excel vào đây'}</span>
                <span className="mt-1 text-sm text-gray-500">hoặc bấm để chọn file .xlsx/.csv</span>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => handleImportFile(event.target.files?.[0])} />
              </label>

              {importRows.length > 0 && (
                <div className="rounded-lg bg-[#eef8fd] px-4 py-3 text-sm text-[#1f6f9f]">
                  Đã đọc {importRows.length} dòng dữ liệu. Hệ thống tự nhận các cột như Tên Sản Phẩm, Dòng Máy Tương Thích,
                  Giá Bán (VND), Tồn Kho, Link Hình Ảnh (URL).
                </div>
              )}

              {importRows.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Dòng</th>
                        <th className="px-3 py-2 font-semibold">Ảnh</th>
                        <th className="px-3 py-2 font-semibold">Tên</th>
                        <th className="px-3 py-2 font-semibold">Dòng máy</th>
                        <th className="px-3 py-2 font-semibold">Danh mục</th>
                        <th className="px-3 py-2 font-semibold">Giá</th>
                        <th className="px-3 py-2 font-semibold">Tồn kho</th>
                        <th className="px-3 py-2 font-semibold">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {importRows.map((row) => (
                        <tr key={row.rowNumber} className={row.isValid ? 'bg-white' : 'bg-red-50'}>
                          <td className="px-3 py-2 text-gray-500">{row.rowNumber}</td>
                          <td className="px-3 py-2">
                            <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-lg border border-[#d7eef3] bg-white">
                              {row.image_url ? (
                                <img src={row.image_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <FileSpreadsheet size={18} className="text-gray-300" />
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900">{row.name || '-'}</td>
                          <td className="px-3 py-2 text-gray-600">{row.deviceText || '-'}</td>
                          <td className="px-3 py-2 text-gray-600">{row.categoryText || '-'}</td>
                          <td className="px-3 py-2 text-gray-900">{Number.isFinite(row.price) ? formatCurrency(row.price) : '-'}</td>
                          <td className="px-3 py-2 text-gray-900">{Number.isFinite(row.stockQuantity) ? row.stockQuantity : '-'}</td>
                          <td className="px-3 py-2">
                            {row.isValid ? (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Hợp lệ</span>
                            ) : (
                              <span className="text-xs font-semibold text-red-600">{row.errors.join(', ')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeImportModal} className="rounded-lg border border-gray-300 px-4 py-2 font-medium">
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={() => setImportStep(3)}
                  disabled={importRows.length === 0}
                  className="rounded-lg bg-[#74B8E0] px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Xem xác nhận
                </button>
              </div>
            </div>
          )}

          {importStep === 3 && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-emerald-50 p-4">
                  <p className="text-sm font-medium text-emerald-700">Sản phẩm hợp lệ</p>
                  <p className="mt-1 text-3xl font-bold text-emerald-800">{importSummary.validCount}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-700">Dòng lỗi</p>
                  <p className="mt-1 text-3xl font-bold text-red-800">{importSummary.errorCount}</p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeImportModal} className="rounded-lg border border-gray-300 px-4 py-2 font-medium">
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={handleImportConfirm}
                  disabled={isImporting || importSummary.validCount === 0}
                  className="rounded-lg bg-[#74B8E0] px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isImporting ? 'Đang import...' : 'Xác nhận import'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={isOpen} onClose={closeModal} title={editingProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">Tên sản phẩm</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Dòng máy</span>
            <select
              value={form.device_family}
              onChange={(event) => handleFamilyChange(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              required
            >
              <option value="">Chọn dòng máy</option>
              {deviceFamilyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Model</span>
            <select
              value={form.device_model_id}
              onChange={(event) => setForm({ ...form, device_model_id: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              required
            >
              <option value="">Chọn model</option>
              {formDeviceModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Danh mục</span>
            <select
              value={form.category_id}
              onChange={(event) => setForm({ ...form, category_id: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              required
            >
              <option value="">Chưa chọn</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Giá bán</span>
            <input
              type="number"
              min="1"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Giá vốn</span>
            <input
              type="number"
              min="0"
              value={form.cost_price}
              onChange={(event) => setForm({ ...form, cost_price: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Tồn kho</span>
            <input
              type="number"
              min="0"
              value={form.stock_quantity}
              onChange={(event) => setForm({ ...form, stock_quantity: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Tồn tối thiểu</span>
            <input
              type="number"
              min="0"
              value={form.min_stock}
              onChange={(event) => setForm({ ...form, min_stock: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">Ảnh</span>
            <input
              value={form.image_url}
              onChange={(event) => setForm({ ...form, image_url: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              placeholder="https://..."
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">Mô tả</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
            />
          </label>
          <div className="flex justify-end gap-3 md:col-span-2">
            <button type="button" onClick={closeModal} className="rounded-lg border border-gray-300 px-4 py-2 font-medium">
              Hủy
            </button>
            <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-ink hover:bg-brand-muted">
              Lưu
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
