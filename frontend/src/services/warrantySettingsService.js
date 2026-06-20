import api from '../api/axios';
const KEY = 'ztech_warranty_settings';
export const defaults = {
  durations: [{ id: 1, scope: 'Danh mục', target: 'Cáp sạc', warrantyDays: 180, exchangeDays: 7, active: true }],
  products: [{ id: 1, category: 'Cáp sạc', status: 'Có bảo hành' }],
  conditions: ['Còn hạn bảo hành', 'Còn hóa đơn hoặc mã bảo hành', 'Lỗi do nhà sản xuất', 'Sản phẩm không bị rơi vỡ hoặc vào nước'],
  rejections: ['Hết hạn bảo hành', 'Rơi vỡ', 'Vào nước', 'Không còn hóa đơn', 'Lỗi do sử dụng sai', 'Sản phẩm không thuộc diện bảo hành'],
  exchange: { days: 7, same: true, other: false, deduct: true, note: '' },
  receipt: { store: 'Z-TECH', phone: '', address: '', policy: 'Vui lòng giữ phiếu hoặc mã bảo hành để được hỗ trợ.', footer: 'Cảm ơn quý khách.', qr: true }, history: []
};
export async function getWarrantySettings() { const raw = localStorage.getItem(KEY); return raw ? { ...defaults, ...JSON.parse(raw) } : structuredClone(defaults); }
function policyType(status) {
  if (status === 'Không bảo hành') return { warranty_enabled: 0, warranty_type: 'none' };
  if (status === 'Chỉ đổi lỗi ban đầu') return { warranty_enabled: 0, warranty_type: 'initial_exchange' };
  if (status === 'Bảo hành theo nhà sản xuất') return { warranty_enabled: 1, warranty_type: 'manufacturer' };
  return { warranty_enabled: 1, warranty_type: 'repair' };
}
async function applySettingsToProducts(settings) {
  const response = await api.get('/products');
  const products = Array.isArray(response.data) ? response.data : (response.data?.products || []);
  const activeDurations = settings.durations.filter((item) => item.active);
  const updates = products.map((product) => {
    const category = product.category_name || '';
    const duration = activeDurations.find((item) => item.scope === 'Sản phẩm' && item.target === product.name)
      || activeDurations.find((item) => item.scope === 'Danh mục' && item.target === category);
    const application = settings.products.find((item) => item.category === category);
    if (!duration && !application) return null;
    const type = application ? policyType(application.status) : {};
    const exchangeOnly = application?.status === 'Chỉ đổi lỗi ban đầu';
    return api.put(`/products/${product.id}`, {
      ...product,
      ...type,
      warranty_period_days: exchangeOnly ? Number(duration?.exchangeDays || settings.exchange.days || 0) : Number(duration?.warrantyDays ?? product.warranty_period_days ?? 0),
      warranty_conditions: settings.conditions.join('\n'),
      warranty_exclusions: settings.rejections.join('\n'),
      warranty_note: settings.exchange.note || product.warranty_note || ''
    });
  }).filter(Boolean);
  await Promise.all(updates);
}
export async function saveWarrantySettings(value, user) {
  await applySettingsToProducts(value);
  const old = await getWarrantySettings();
  const history = [{ id: Date.now(), time: new Date().toISOString(), user, type: 'Toàn bộ thiết lập', before: 'Phiên bản trước', after: 'Đã lưu và áp dụng cho sản phẩm' }, ...old.history];
  const saved = { ...value, history };
  localStorage.setItem(KEY, JSON.stringify(saved));
  return saved;
}
