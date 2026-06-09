export const formatCurrency = (n) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(n || 0));

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('vi-VN') : '';

export const formatTime = (d) =>
  d ? new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
