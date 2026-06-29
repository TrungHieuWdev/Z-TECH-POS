import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  Barcode,
  Boxes,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  FileSpreadsheet,
  Package,
  Plus,
  Search,
  TrendingUp,
  Trash2,
  Upload
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import Modal from '../components/Modal';
import ProductImage from '../components/ProductImage';
import { formatCurrency } from '../utils/format';
import { getUser, isFullAccessRole } from '../utils/auth';
import { getDefaultWarrantyPolicy, getWarrantyLabel, warrantyTypes } from '../utils/warrantyPolicy';

const deviceFamilyOptions = [
  { value: 'generic', label: 'Dùng chung / Không theo hãng' },
  { value: 'apple', label: 'Apple' },
  { value: 'samsung', label: 'Samsung' },
  { value: 'vivo', label: 'Vivo' },
  { value: 'oppo', label: 'Oppo' },
  { value: 'xiaomi', label: 'Xiaomi / Redmi' }
];

const PAGE_SIZE = 8;
const topPeriodLabels = {
  today: 'hôm nay',
  '7days': '7 ngày',
  '14days': '14 ngày',
  '30days': '30 ngày',
  '90days': '90 ngày'
};

const quickTabs = [
  { value: 'all', label: 'Tất cả' },
  { value: 'low', label: 'Sắp hết hàng' },
  { value: 'out', label: 'Hết hàng' },
  { value: 'no-code', label: 'Chưa có mã vạch' },
  { value: 'warranty', label: 'Có bảo hành' }
];

function getStockState(product) {
  const stock = Number(product.stock_quantity || 0);
  const minimum = Number(product.min_stock || 0);
  if (stock <= 0) return 'out';
  if (stock <= minimum) return 'low';
  return 'available';
}

function getProductStatus(product) {
  if (product.status) return product.status;
  return Number(product.is_active ?? 1) === 1 ? 'active' : 'hidden';
}

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
  image_url: '',
  warranty_enabled: false,
  warranty_period_days: 0,
  warranty_type: 'none',
  warranty_conditions: '',
  warranty_exclusions: '',
  warranty_note: ''
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

const categoryAliases = new Map([
  ['op lung', 'Ốp lưng'],
  ['bao da', 'Ốp lưng'],
  ['case', 'Ốp lưng'],
  ['kinh cuong luc', 'Kính cường lực'],
  ['cuong luc camera', 'Kính cường lực'],
  ['cuong luc man hinh', 'Kính cường lực'],
  ['mieng dan ppf', 'Miếng dán PPF'],
  ['ppf', 'Miếng dán PPF'],
  ['dan lung', 'Miếng dán PPF'],
  ['sac cap', 'Thiết bị sạc'],
  ['sac & cap', 'Thiết bị sạc'],
  ['thiet bi sac', 'Thiết bị sạc'],
  ['cap sac', 'Thiết bị sạc'],
  ['cu sac', 'Thiết bị sạc'],
  ['bo sac', 'Thiết bị sạc'],
  ['sac du phong', 'Thiết bị sạc'],
  ['de sac', 'Thiết bị sạc'],
  ['sac khong day', 'Thiết bị sạc'],
  ['tai nghe', 'Tai nghe'],
  ['tai nghe am thanh', 'Tai nghe'],
  ['tai nghe & am thanh', 'Tai nghe'],
  ['tai nghe co day', 'Tai nghe'],
  ['tai nghe khong day', 'Tai nghe'],
  ['loa bluetooth', 'Loa Bluetooth'],
  ['loa', 'Loa Bluetooth'],
  ['gia do dien thoai', 'Giá đỡ điện thoại'],
  ['gia do', 'Giá đỡ điện thoại'],
  ['phu kien chup anh', 'Phụ kiện chụp ảnh'],
  ['gay selfie', 'Phụ kiện chụp ảnh'],
  ['tripod', 'Phụ kiện chụp ảnh'],
  ['phu kien o to', 'Phụ kiện ô tô'],
  ['o to', 'Phụ kiện ô tô'],
  ['oto', 'Phụ kiện ô tô'],
  ['phu kien ve sinh', 'Phụ kiện vệ sinh'],
  ['ve sinh', 'Phụ kiện vệ sinh'],
  ['phu kien tien ich', 'Phụ kiện tiện ích'],
  ['tien ich', 'Phụ kiện tiện ích'],
  ['phu kien khac', 'Phụ kiện khác'],
  ['khac', 'Phụ kiện khác']
]);

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

function getCategoryName(categories, categoryId) {
  return categories.find((category) => String(category.id) === String(categoryId))?.name || '';
}

function normalizeCategoryName(value = '') {
  const normalized = normalizeImportText(value).replace(/[^a-z0-9&]+/g, ' ').replace(/\s+/g, ' ').trim();
  return categoryAliases.get(normalized) || String(value || '').trim();
}

function productMatchesCategory(product, category) {
  if (!category) return true;
  return String(product.category_id) === String(category.id);
}

function getWarrantyBadgeClass(product) {
  if (product.warranty_type === 'initial_exchange') return 'bg-amber-100 text-amber-800';
  if (!Boolean(Number(product.warranty_enabled))) return 'bg-gray-100 text-gray-700';
  return 'bg-emerald-100 text-emerald-700';
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hasFullAccess = isFullAccessRole(getUser()?.role);
  const lowStockOnly = searchParams.get('lowStock') === '1';
  const showTopProducts = searchParams.get('view') === 'top-products';
  const topProductsPeriod = topPeriodLabels[searchParams.get('period')] ? searchParams.get('period') : '30days';
  const selectedCategoryId = searchParams.get('category_id') || '';
  const [products, setProducts] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [isTopProductsLoading, setIsTopProductsLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [deviceModels, setDeviceModels] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState(selectedCategoryId);
  const [deviceFamily, setDeviceFamily] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [warrantyFilter, setWarrantyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState(lowStockOnly ? 'low' : 'all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const productStats = useMemo(() => ({
    total: products.length,
    active: products.filter((product) => getProductStatus(product) === 'active').length,
    low: products.filter((product) => getStockState(product) === 'low').length,
    out: products.filter((product) => getStockState(product) === 'out').length,
    noCode: products.filter((product) => !String(product.sku || '').trim() && !String(product.barcode || '').trim()).length
  }), [products]);

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const selectedCategory = categories.find((category) => String(category.id) === String(categoryId));

    return products.filter((product) => {
      const stockState = getStockState(product);
      const warrantyEnabled = Boolean(Number(product.warranty_enabled));
      const warrantyType = product.warranty_type || 'none';
      const searchable = [
        product.name,
        product.sku,
        product.barcode,
        product.device_model,
        product.device_series,
        product.category_name
      ].join(' ').toLowerCase();

      if (keyword && !searchable.includes(keyword)) return false;
      if (deviceFamily && product.device_family !== deviceFamily) return false;
      if (categoryId && !productMatchesCategory(product, selectedCategory)) return false;
      if (stockFilter && stockState !== stockFilter) return false;
      if (warrantyFilter === 'yes' && (!warrantyEnabled || warrantyType === 'initial_exchange')) return false;
      if (warrantyFilter === 'none' && warrantyEnabled) return false;
      if (warrantyFilter === 'exchange' && warrantyType !== 'initial_exchange') return false;
      if (statusFilter && getProductStatus(product) !== statusFilter) return false;
      if (activeTab === 'low' && stockState !== 'low') return false;
      if (activeTab === 'out' && stockState !== 'out') return false;
      if (activeTab === 'no-code' && (product.sku || product.barcode)) return false;
      if (activeTab === 'warranty' && !warrantyEnabled) return false;
      return true;
    });
  }, [products, categories, search, deviceFamily, categoryId, stockFilter, warrantyFilter, statusFilter, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, deviceFamily, categoryId, stockFilter, warrantyFilter, statusFilter, activeTab]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

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
        danh_muc: 'Tai nghe',
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
        const categoryText = normalizeCategoryName(getImportCell(normalized, 'danh_muc')) || 'Phụ kiện khác';
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
    const response = await api.get('/products');
    const allProducts = Array.isArray(response.data) ? response.data : [];
    setProducts(allProducts);
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
  }, []);

  useEffect(() => {
    if (!showTopProducts) return;

    setIsTopProductsLoading(true);
    api.get('/dashboard/top-products', { params: { period: topProductsPeriod } })
      .then((response) => setTopProducts(Array.isArray(response.data) ? response.data : []))
      .catch((error) => {
        toast.error(error.response?.data?.message || 'Không thể tải top sản phẩm bán chạy');
        setTopProducts([]);
      })
      .finally(() => setIsTopProductsLoading(false));
  }, [showTopProducts, topProductsPeriod]);

  useEffect(() => {
    if (lowStockOnly) setActiveTab('low');
  }, [lowStockOnly]);

  useEffect(() => {
    setCategoryId(selectedCategoryId);
  }, [selectedCategoryId]);

  const openCreate = () => {
    setEditingProduct(null);
    setForm({ ...initialForm, ...getDefaultWarrantyPolicy(initialForm) });
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
      image_url: product.image_url || '',
      warranty_enabled: Boolean(Number(product.warranty_enabled)),
      warranty_period_days: product.warranty_period_days || 0,
      warranty_type: product.warranty_type || 'none',
      warranty_conditions: product.warranty_conditions || '',
      warranty_exclusions: product.warranty_exclusions || '',
      warranty_note: product.warranty_note || ''
    });
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingProduct(null);
    setForm(initialForm);
  };

  const handleFamilyChange = (value) => {
    const genericModel = value === 'generic'
      ? deviceModels.find((model) => model.family === 'generic')
      : null;

    setForm({
      ...form,
      device_family: value,
      device_model_id: genericModel?.id || ''
    });
  };

  const applyDefaultWarranty = () => {
    const policy = getDefaultWarrantyPolicy({
      name: form.name,
      category_name: getCategoryName(categories, form.category_id)
    });

    setForm({ ...form, ...policy });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      ...form,
      category_id: form.category_id || null,
      device_model_id: form.device_model_id || null,
      category_name: getCategoryName(categories, form.category_id),
      price: Number(form.price),
      cost_price: form.cost_price === '' ? null : Number(form.cost_price),
      stock_quantity: Number(form.stock_quantity),
      min_stock: Number(form.min_stock),
      warranty_enabled: form.warranty_enabled ? 1 : 0,
      warranty_period_days: Number(form.warranty_period_days || 0)
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-950">Sản phẩm</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">Thêm và cập nhật sản phẩm, quản lý giá bán, mã vạch, tồn kho và chính sách bảo hành.</p>
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
          <button type="button" onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 font-semibold text-white transition hover:bg-brand-strong">
            <Plus size={18} /><span>Thêm sản phẩm</span>
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Tổng sản phẩm', value: productStats.total, note: `${productStats.noCode} chưa có SKU/mã vạch`, icon: Package, tone: 'bg-brand-surface text-brand-strong' },
          { label: 'Sản phẩm đang bán', value: productStats.active, note: 'Đang hiển thị trên POS', icon: Boxes, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Sắp hết hàng', value: productStats.low, note: 'Đã chạm mức tồn tối thiểu', icon: AlertTriangle, tone: 'bg-amber-50 text-amber-700' },
          { label: 'Hết hàng', value: productStats.out, note: 'Cần nhập thêm hàng', icon: Barcode, tone: 'bg-red-50 text-red-700' }
        ].map((card) => (
          <article key={card.label} className="flex min-w-0 items-center gap-3 border border-gray-200 bg-white p-4 shadow-sm">
            <div className={`grid h-11 w-11 shrink-0 place-items-center ${card.tone}`}><card.icon size={21} /></div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold uppercase tracking-wide text-gray-500">{card.label}</p>
              <p className="mt-1 text-2xl font-extrabold text-gray-950">{card.value}</p>
              <p className="mt-0.5 truncate text-xs text-gray-500">{card.note}</p>
            </div>
          </article>
        ))}
      </section>

      {showTopProducts && (
        <section className="border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center bg-brand-surface text-brand-strong">
                <TrendingUp size={20} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-950">Top sản phẩm bán chạy</h2>
                <p className="text-sm font-medium text-gray-500">Xếp hạng theo doanh thu trong {topPeriodLabels[topProductsPeriod]}.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="inline-flex items-center gap-2 border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
            >
              <ArrowLeft size={16} />
              Danh sách sản phẩm
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Hạng</th>
                  <th className="px-4 py-3 font-bold">Sản phẩm</th>
                  <th className="px-4 py-3 font-bold">Danh mục</th>
                  <th className="px-4 py-3 text-right font-bold">Số lượng bán</th>
                  <th className="px-4 py-3 text-right font-bold">Giá bán</th>
                  <th className="px-4 py-3 text-right font-bold">Doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isTopProductsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center font-semibold text-gray-500">Đang tải top sản phẩm...</td>
                  </tr>
                ) : topProducts.length > 0 ? (
                  topProducts.map((product, index) => (
                    <tr key={product.product_id} className="hover:bg-brand-surface/50">
                      <td className="px-4 py-3">
                        <span className={`inline-grid h-8 w-8 place-items-center font-extrabold ${index < 3 ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600'}`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-gray-950">{product.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">Mã SP: {product.product_id}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{product.category_name || '-'}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800">{Number(product.quantity || 0).toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-700">{formatCurrency(product.price)}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-gray-950">{formatCurrency(product.revenue)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center font-semibold text-gray-500">Chưa có sản phẩm bán chạy trong kỳ này.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="border border-gray-200 bg-white shadow-sm">
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full border border-gray-300 pl-10 pr-3 text-sm outline-none focus:border-brand" placeholder="Tìm tên, SKU, mã vạch, model" />
          </div>
          <select value={deviceFamily} onChange={(event) => setDeviceFamily(event.target.value)} className="h-10 border border-gray-300 px-3 text-sm outline-none focus:border-brand">
            <option value="">Tất cả dòng máy</option>
            {deviceFamilyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="h-10 border border-gray-300 px-3 text-sm outline-none focus:border-brand">
            <option value="">Tất cả danh mục</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} className="h-10 border border-gray-300 px-3 text-sm outline-none focus:border-brand">
            <option value="">Tất cả tồn kho</option><option value="available">Còn hàng</option><option value="low">Sắp hết</option><option value="out">Hết hàng</option>
          </select>
          <select value={warrantyFilter} onChange={(event) => setWarrantyFilter(event.target.value)} className="h-10 border border-gray-300 px-3 text-sm outline-none focus:border-brand">
            <option value="">Tất cả bảo hành</option><option value="yes">Có bảo hành</option><option value="none">Không bảo hành</option><option value="exchange">Chỉ đổi lỗi ban đầu</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 border border-gray-300 px-3 text-sm outline-none focus:border-brand">
            <option value="">Tất cả trạng thái</option><option value="active">Đang bán</option><option value="hidden">Tạm ẩn</option><option value="stopped">Ngừng bán</option>
          </select>
        </div>
        <div className="flex gap-1 overflow-x-auto border-t border-gray-100 px-4 pt-2">
          {quickTabs.map((tab) => (
            <button key={tab.value} type="button" onClick={() => { setActiveTab(tab.value); if (lowStockOnly) setSearchParams({}); }} className={`shrink-0 border-b-2 px-3 py-2 text-sm font-bold ${activeTab === tab.value ? 'border-brand-strong text-brand-strong' : 'border-transparent text-gray-500'}`}>{tab.label}</button>
          ))}
        </div>
      </section>

      <section className="border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-bold">Sản phẩm</th><th className="px-4 py-3 font-bold">SKU / Mã vạch</th><th className="px-4 py-3 font-bold">Dòng máy</th><th className="px-4 py-3 font-bold">Danh mục</th><th className="px-4 py-3 font-bold">Giá bán</th><th className="px-4 py-3 font-bold">Tồn kho</th><th className="px-4 py-3 font-bold">Bảo hành</th><th className="px-4 py-3 font-bold">Trạng thái</th><th className="px-4 py-3 text-right font-bold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedProducts.map((product) => {
                const stockState = getStockState(product);
                const status = getProductStatus(product);

                return (
                  <tr key={product.id} className="hover:bg-brand-surface/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="h-16 w-12 shrink-0 overflow-hidden border border-[#d7eef3]"><ProductImage product={product} iconSize={28} compact /></div>
                        <div className="max-w-[260px] min-w-0"><p className="truncate font-bold text-gray-950">{product.name}</p><p className="mt-0.5 truncate text-xs text-gray-500">{product.device_model || 'Phụ kiện dùng chung'}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><p className="font-semibold text-gray-800">{product.sku || 'Chưa có SKU'}</p><p className={`mt-0.5 text-xs ${product.barcode ? 'text-gray-500' : 'font-semibold text-amber-700'}`}>{product.barcode || 'Chưa có mã vạch'}</p></td>
                    <td className="px-4 py-2.5"><p className="font-semibold text-gray-800">{getDeviceFamilyLabel(product.device_family)}</p><p className="text-xs text-gray-500">{product.device_model || '-'}</p></td>
                    <td className="px-4 py-2.5 text-gray-600">{product.category_name || '-'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-bold text-gray-950">{formatCurrency(product.price)}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-gray-950">{Number(product.stock_quantity || 0)} <span className="font-medium text-gray-400">/ tối thiểu {Number(product.min_stock || 0)}</span></p>
                      <span className={`mt-1 inline-flex px-2 py-0.5 text-[11px] font-bold ${stockState === 'out' ? 'bg-red-100 text-red-700' : stockState === 'low' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{stockState === 'out' ? 'Hết hàng' : stockState === 'low' ? 'Sắp hết' : 'Còn hàng'}</span>
                    </td>
                    <td className="px-4 py-2.5"><span className={`inline-flex px-2 py-1 text-xs font-bold ${getWarrantyBadgeClass(product)}`}>{getWarrantyLabel(product)}</span><p className="mt-1 text-xs text-gray-500">{product.warranty_type === 'initial_exchange' ? `Chỉ đổi lỗi ban đầu ${Number(product.warranty_period_days || 1)} ngày` : Number(product.warranty_enabled) ? `Có bảo hành ${Number(product.warranty_period_days || 0)} ngày` : 'Không bảo hành'}</p></td>
                    <td className="px-4 py-2.5"><span className={`inline-flex px-2.5 py-1 text-xs font-bold ${status === 'active' ? 'bg-brand-surface text-brand-deep' : status === 'hidden' ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-700'}`}>{status === 'active' ? 'Đang bán' : status === 'hidden' ? 'Tạm ẩn' : 'Ngừng bán'}</span></td>
                    <td className="px-4 py-2.5">
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
              {paginatedProducts.length === 0 && <tr><td colSpan="9" className="px-4 py-12 text-center text-gray-500">Không tìm thấy sản phẩm phù hợp.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3">
          <p className="text-sm text-gray-500">Hiển thị {filteredProducts.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filteredProducts.length)} trong {filteredProducts.length} sản phẩm</p>
          <div className="flex items-center gap-1">
            <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} className="grid h-8 w-8 place-items-center border border-gray-200 disabled:opacity-40"><ChevronLeft size={17} /></button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1).map((page, index, pages) => (
              <span key={page} className="contents">{index > 0 && page - pages[index - 1] > 1 && <span className="px-1 text-gray-400">…</span>}<button type="button" onClick={() => setCurrentPage(page)} className={`h-8 min-w-8 border px-2 text-sm font-bold ${currentPage === page ? 'border-brand bg-brand text-white' : 'border-gray-200 text-gray-600'}`}>{page}</button></span>
            ))}
            <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => page + 1)} className="grid h-8 w-8 place-items-center border border-gray-200 disabled:opacity-40"><ChevronRight size={17} /></button>
          </div>
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

      <Modal isOpen={isOpen} onClose={closeModal} title={editingProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm'} maxWidth="max-w-4xl">
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
            <span className="mb-1 block text-sm font-medium text-gray-700">Phạm vi tương thích</span>
            <select
              value={form.device_family}
              onChange={(event) => handleFamilyChange(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand"
              required
            >
              <option value="">Chọn hãng / phạm vi</option>
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
              disabled={form.device_family === 'generic'}
              required
            >
              <option value="">{form.device_family === 'generic' ? 'Không yêu cầu model máy' : 'Chọn model'}</option>
              {formDeviceModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            {form.device_family === 'generic' && (
              <span className="mt-1 block text-xs text-gray-500">Dành cho tai nghe, cáp, sạc, phụ kiện tiện ích… không gắn với một hãng hoặc model cụ thể.</span>
            )}
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
          <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-950">Chính sách bảo hành</h3>
                <p className="mt-1 text-xs text-gray-600">Áp theo từng sản phẩm, không dùng chung toàn bộ danh mục.</p>
              </div>
              <button
                type="button"
                onClick={applyDefaultWarranty}
                className="h-8 rounded border border-[#74B8E0] bg-white px-3 text-xs font-bold text-[#3386b8] hover:bg-[#eef8fd]"
              >
                Tự điền theo loại sản phẩm
              </button>
            </div>

            <label className="flex items-center justify-between gap-4 rounded border border-gray-200 bg-white px-3 py-2">
              <span>
                <span className="block text-sm font-semibold text-gray-800">Áp dụng bảo hành</span>
                <span className="text-xs text-gray-500">Bật khi sản phẩm có phiếu bảo hành chính thức.</span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(form.warranty_enabled)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    warranty_enabled: event.target.checked,
                    warranty_type: event.target.checked && form.warranty_type === 'none' ? 'replace' : form.warranty_type
                  })
                }
                className="h-5 w-5 rounded border-gray-300 text-brand-strong focus:ring-brand"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-1 block text-sm font-medium text-gray-700">Loại chính sách</span>
                <select
                  value={form.warranty_type}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      warranty_type: event.target.value,
                      warranty_enabled: !['none', 'initial_exchange'].includes(event.target.value)
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-brand"
                >
                  {Object.entries(warrantyTypes).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1 block text-sm font-medium text-gray-700">Thời gian bảo hành / đổi lỗi</span>
                <input
                  type="number"
                  min="0"
                  value={form.warranty_period_days}
                  onChange={(event) => setForm({ ...form, warranty_period_days: event.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-brand"
                  placeholder="Số ngày"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Điều kiện được bảo hành / đổi lỗi</span>
              <textarea
                value={form.warranty_conditions}
                onChange={(event) => setForm({ ...form, warranty_conditions: event.target.value })}
                className="min-h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-brand"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Trường hợp từ chối</span>
              <textarea
                value={form.warranty_exclusions}
                onChange={(event) => setForm({ ...form, warranty_exclusions: event.target.value })}
                className="min-h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-brand"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Ghi chú cho nhân viên / khách hàng</span>
              <textarea
                value={form.warranty_note}
                onChange={(event) => setForm({ ...form, warranty_note: event.target.value })}
                className="min-h-16 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-brand"
              />
            </label>
          </section>
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
