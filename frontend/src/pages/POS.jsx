import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Banknote,
  CreditCard,
  Minus,
  Package,
  Plus,
  Search,
  Smartphone,
  Trash2,
  UserSearch,
  WalletCards,
  X
} from 'lucide-react';
import api from '../api/axios';
import { formatCurrency } from '../utils/format';

const paymentOptions = [
  { value: 'cash', label: 'Tiền mặt', icon: Banknote },
  { value: 'transfer', label: 'Chuyển khoản', icon: WalletCards },
  { value: 'card', label: 'Quẹt thẻ', icon: CreditCard }
];

function getStockTone(stock) {
  const value = Number(stock || 0);

  if (value <= 0) {
    return 'bg-red-100 text-red-700';
  }

  if (value <= 8) {
    return 'bg-amber-100 text-amber-700';
  }

  return 'bg-green-100 text-green-700';
}

function getProductSku(product) {
  return `SKU: PRD-${String(product.id).padStart(4, '0')}`;
}

export default function POS() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerName, setCustomerName] = useState('Khách lẻ');
  const [loading, setLoading] = useState(false);

  async function loadProducts() {
    const params = new URLSearchParams();

    if (search) params.set('search', search);
    if (categoryId) params.set('category_id', categoryId);

    const response = await api.get(`/products?${params.toString()}`);
    setProducts(response.data);
  }

  useEffect(() => {
    api.get('/categories').then((response) => setCategories(response.data));
  }, []);

  useEffect(() => {
    loadProducts();
  }, [search, categoryId]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    [cart]
  );
  const discountValue = Math.max(Number(discount || 0), 0);
  const total = Math.max(subtotal - discountValue, 0);

  const addToCart = (product) => {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);

      if (found) {
        if (found.quantity >= Number(product.stock_quantity)) {
          toast.error('Không đủ tồn kho');
          return current;
        }

        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      if (Number(product.stock_quantity) <= 0) {
        toast.error('Sản phẩm đã hết hàng');
        return current;
      }

      return [...current, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, nextQuantity) => {
    setCart((current) =>
      current
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: Math.min(Math.max(nextQuantity, 0), Number(item.stock_quantity)) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (productId) => {
    setCart((current) => current.filter((item) => item.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
  };

  const checkout = async () => {
    if (cart.length === 0) {
      toast.error('Giỏ hàng đang trống');
      return;
    }

    setLoading(true);

    try {
      await api.post('/orders', {
        items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })),
        discount: discountValue,
        payment_method: paymentMethod
      });

      toast.success('Thanh toán thành công');
      clearCart();
      await loadProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể thanh toán');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid h-[calc(100vh-6.5rem)] min-h-[720px] overflow-hidden rounded-xl border border-[#c3c6d7] bg-[#f7f9fb] lg:grid-cols-[minmax(0,1fr)_400px]">
      <section className="flex min-w-0 flex-col overflow-hidden p-5">
        <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#737686]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-lg border border-transparent bg-[#eceef0] pl-10 pr-4 text-sm font-medium text-[#191c1e] outline-none focus:border-[#004ac6] focus:bg-white focus:ring-2 focus:ring-[#dbe1ff]"
              placeholder="Tìm sản phẩm..."
            />
          </div>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="h-11 rounded-lg border border-[#c3c6d7] bg-white px-3 text-sm font-semibold text-[#191c1e] outline-none focus:border-[#004ac6] focus:ring-2 focus:ring-[#dbe1ff]"
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategoryId('')}
            className={`h-10 shrink-0 rounded-full px-5 text-sm font-semibold ${
              categoryId === '' ? 'bg-[#2563eb] text-white' : 'border border-[#c3c6d7] bg-white text-[#191c1e]'
            }`}
          >
            Tất cả
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryId(String(category.id))}
              className={`h-10 shrink-0 rounded-full px-5 text-sm font-semibold ${
                String(categoryId) === String(category.id)
                  ? 'bg-[#2563eb] text-white'
                  : 'border border-[#c3c6d7] bg-white text-[#191c1e]'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4 pb-5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {products.map((product) => {
              const stock = Number(product.stock_quantity || 0);
              const isOutOfStock = stock <= 0;

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  disabled={isOutOfStock}
                  className="overflow-hidden rounded-xl border border-[#c3c6d7] bg-white text-left disabled:opacity-70"
                >
                  <div className="relative aspect-square bg-[#f2f4f6]">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[#737686]">
                        <Package size={36} />
                      </div>
                    )}
                    <span
                      className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${getStockTone(stock)}`}
                    >
                      {isOutOfStock ? 'Hết hàng' : `Còn ${stock}`}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="min-h-10 overflow-hidden text-sm font-bold leading-5 text-[#191c1e]">
                      {product.name}
                    </h3>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-tight text-[#737686]">
                      {getProductSku(product)}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-lg font-bold leading-6 text-[#004ac6]">
                        {formatCurrency(product.price)}
                      </span>
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                          isOutOfStock ? 'bg-[#eceef0] text-[#737686]' : 'bg-[#e6e8ea] text-[#004ac6]'
                        }`}
                      >
                        {isOutOfStock ? <X size={18} /> : <Plus size={18} />}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col border-l border-[#c3c6d7] bg-white">
        <div className="border-b border-[#c3c6d7] bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-[#191c1e]">Khách hàng</span>
            <button type="button" className="text-xs font-bold text-[#004ac6]">
              Thêm mới (+)
            </button>
          </div>
          <div className="relative">
            <UserSearch className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#737686]" />
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              className="h-11 w-full rounded-lg border border-[#c3c6d7] bg-[#f7f9fb] pl-10 pr-4 text-sm font-bold text-[#191c1e] outline-none focus:border-[#004ac6] focus:ring-2 focus:ring-[#dbe1ff]"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-[#191c1e]">
              <Smartphone size={19} className="text-[#004ac6]" />
              <span>Giỏ hàng ({cart.length})</span>
            </div>
            <button type="button" onClick={clearCart} className="rounded px-2 py-1 text-xs font-bold text-[#ba1a1a]">
              Xóa hết
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#c3c6d7] bg-[#f7f9fb] p-6 text-center text-sm font-medium text-[#737686]">
                Chưa có sản phẩm trong giỏ hàng
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[#c3c6d7] bg-[#f2f4f6]">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[#737686]">
                        <Package size={22} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="truncate text-xs font-bold leading-4 text-[#191c1e]">{item.name}</h4>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="grid h-6 w-6 shrink-0 place-items-center text-[#737686]"
                        title="Xóa"
                        aria-label="Xóa"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div className="flex overflow-hidden rounded-lg border border-[#c3c6d7] bg-[#eceef0]">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="grid h-8 w-8 place-items-center text-[#434655]"
                          title="Giảm"
                          aria-label="Giảm"
                        >
                          <Minus size={15} />
                        </button>
                        <span className="grid h-8 w-9 place-items-center text-xs font-bold text-[#191c1e]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="grid h-8 w-8 place-items-center text-[#434655]"
                          title="Tăng"
                          aria-label="Tăng"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-[#191c1e]">
                        {formatCurrency(Number(item.price) * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-[#c3c6d7] bg-[#f2f4f6] p-5">
          <div className="mb-4 space-y-3">
            <div className="flex justify-between text-sm text-[#434655]">
              <span>Tạm tính</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm text-[#434655]">
              <span>Giảm giá</span>
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                className="h-9 w-36 rounded-lg border border-[#c3c6d7] bg-white px-3 text-right text-sm font-semibold text-[#191c1e] outline-none focus:border-[#004ac6] focus:ring-2 focus:ring-[#dbe1ff]"
              />
            </label>
            <div className="flex justify-between text-sm text-[#434655]">
              <span>Thuế / phí</span>
              <span>{formatCurrency(0)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-[#c3c6d7] pt-3">
              <span className="text-base font-bold uppercase text-[#191c1e]">Tổng cộng</span>
              <span className="text-base font-extrabold text-[#004ac6]">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2">
            {paymentOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = paymentMethod === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPaymentMethod(option.value)}
                  className={`flex min-h-[68px] flex-col items-center justify-center rounded-xl border px-2 py-3 ${
                    isSelected
                      ? 'border-2 border-[#004ac6] bg-[#eef2ff] text-[#004ac6]'
                      : 'border-[#c3c6d7] bg-white text-[#434655]'
                  }`}
                >
                  <Icon size={20} />
                  <span className="mt-1 text-center text-[10px] font-bold uppercase leading-3 tracking-tight">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={checkout}
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 text-sm font-bold uppercase text-white shadow-[0_8px_20px_rgba(37,99,235,0.18)] disabled:opacity-70"
          >
            <CreditCard size={18} />
            <span>{loading ? 'Đang xử lý...' : 'Thanh toán'}</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
