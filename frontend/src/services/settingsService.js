import api from '../api/axios';

export function getUploadedAssetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;

  const apiBaseUrl = String(api.defaults.baseURL || '');
  const baseUrl = apiBaseUrl.startsWith('/api')
    ? window.location.origin
    : apiBaseUrl.replace(/\/api\/?$/, '');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function getSettings() {
  const { data } = await api.get('/settings');
  return data;
}

export async function updateSettings(payload) {
  const { data } = await api.put('/settings', payload);
  window.dispatchEvent(new CustomEvent('settings-updated', { detail: data }));
  window.dispatchEvent(new CustomEvent('bank-transfer-settings-updated', {
    detail: {
      bankId: data.payment?.vietQr?.bankId,
      bankName: data.payment?.vietQr?.bankName,
      accountNo: data.payment?.vietQr?.accountNo,
      accountName: data.payment?.vietQr?.accountName
    }
  }));
  return data;
}

export async function uploadShopLogo(file) {
  const formData = new FormData();
  formData.append('logo', file);

  const { data } = await api.post('/settings/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
}

export async function getCurrentAccount() {
  const { data } = await api.get('/auth/me');
  return data;
}

export async function changeCurrentPassword(payload) {
  const { data } = await api.put('/auth/change-password', payload);
  return data;
}
