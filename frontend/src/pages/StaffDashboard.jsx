import { useEffect, useMemo, useState } from 'react';
import { Banknote, ReceiptText, WalletCards } from 'lucide-react';
import api from '../api/axios';
import { formatCurrency } from '../utils/format';
import { getUser } from '../utils/auth';

export default function StaffDashboard() {
  const [orders, setOrders] = useState([]);
  const user = getUser();
  useEffect(() => { api.get('/orders').then((response) => setOrders(response.data || [])).catch(() => setOrders([])); }, []);
  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const ownToday = orders.filter((order) => String(order.created_at || '').slice(0, 10) === today && order.status !== 'cancelled');
    const cash = ownToday.filter((order) => order.payment_method === 'cash').reduce((sum, order) => sum + Number(order.total || 0), 0);
    const shifts = JSON.parse(localStorage.getItem('ztech-shifts') || '[]');
    const activeShift = shifts.find((shift) => shift.employee === user?.name && shift.workDate === today && shift.status === 'active');
    const openingCash = Number(activeShift?.openingCash || 0);
    return { count: ownToday.length, revenue: ownToday.reduce((sum, order) => sum + Number(order.total || 0), 0), cash, openingCash, expectedCash: openingCash + cash, transfer: ownToday.filter((order) => order.payment_method === 'transfer').reduce((sum, order) => sum + Number(order.total || 0), 0) };
  }, [orders]);
  const cards = [{label:'Đơn trong ca',value:summary.count,icon:ReceiptText},{label:'Doanh thu ca',value:formatCurrency(summary.revenue),icon:WalletCards},{label:'Tiền đầu ca',value:formatCurrency(summary.openingCash),icon:Banknote},{label:'Tiền mặt bán được',value:formatCurrency(summary.cash),icon:Banknote},{label:'Tiền mặt dự kiến cuối ca',value:formatCurrency(summary.expectedCash),icon:WalletCards},{label:'Chuyển khoản',value:formatCurrency(summary.transfer),icon:Banknote}];
  return <div className="space-y-5"><div><h1 className="text-2xl font-extrabold text-gray-950">Tổng quan ca làm</h1><p className="mt-1 text-sm font-medium text-gray-500">Xem nhanh đơn hàng, doanh thu và số tiền trong ca làm hôm nay của bạn.</p></div><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({label,value,icon:Icon})=><article key={label} className="border bg-white p-4"><div className="flex items-start justify-between"><div><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div><div className="grid h-9 w-9 place-items-center bg-brand-soft text-brand-strong"><Icon size={18}/></div></div></article>)}</section></div>;
}
