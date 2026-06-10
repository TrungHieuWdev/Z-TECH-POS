import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Landmark, Save } from 'lucide-react';
import Modal from './Modal';
import {
  bankOptions,
  getBankTransferSettings,
  saveBankTransferSettings
} from '../utils/bankTransfer';

export default function SettingsModal({ isOpen, onClose }) {
  const [form, setForm] = useState(getBankTransferSettings);

  useEffect(() => {
    if (isOpen) {
      setForm(getBankTransferSettings());
    }
  }, [isOpen]);

  const handleBankChange = (bankId) => {
    const selectedBank = bankOptions.find((bank) => bank.bankId === bankId);
    setForm((current) => ({
      ...current,
      bankId,
      bankName: selectedBank?.bankName || current.bankName
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.bankId || !form.accountNo.trim() || !form.accountName.trim()) {
      toast.error('Vui lòng nhập đầy đủ thông tin chuyển khoản');
      return;
    }

    saveBankTransferSettings(form);
    toast.success('Đã lưu cài đặt chuyển khoản');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cài đặt" maxWidth="max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <section>
          <div className="mb-5 flex items-center gap-3 border-b border-[#edf7f9] pb-4">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#c0edf7] text-[#0f3b46]">
              <Landmark size={20} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold uppercase tracking-wide text-[#191c1e]">
                Chuyển khoản VietQR
              </h3>
              <p className="mt-1 text-sm font-medium text-[#737686]">
                Thông tin này sẽ hiển thị khi thanh toán bằng chuyển khoản.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[#98a2b3]">
                Ngân hàng thụ hưởng
              </span>
              <select
                value={form.bankId}
                onChange={(event) => handleBankChange(event.target.value)}
                className="h-12 w-full rounded-none border border-[#d7dde8] bg-white px-4 text-base font-bold text-[#111827] outline-none focus:border-[#74B8E0] focus:ring-2 focus:ring-[#c0edf7]"
              >
                {bankOptions.map((bank) => (
                  <option key={bank.bankId} value={bank.bankId}>
                    {bank.bankName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[#98a2b3]">
                Số tài khoản thụ hưởng
              </span>
              <input
                value={form.accountNo}
                onChange={(event) => setForm({ ...form, accountNo: event.target.value.replace(/\s/g, '') })}
                className="h-12 w-full rounded-none border border-[#d7dde8] bg-white px-4 text-base font-bold text-[#111827] outline-none focus:border-[#74B8E0] focus:ring-2 focus:ring-[#c0edf7]"
                placeholder="VD: 0877724374"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[#98a2b3]">
                Tên chủ tài khoản thụ hưởng
              </span>
              <input
                value={form.accountName}
                onChange={(event) => setForm({ ...form, accountName: event.target.value.toUpperCase() })}
                className="h-12 w-full rounded-none border border-[#d7dde8] bg-white px-4 text-base font-bold uppercase text-[#111827] outline-none focus:border-[#74B8E0] focus:ring-2 focus:ring-[#c0edf7]"
                placeholder="VD: MAI TRAN THIEN TAM"
              />
            </label>
          </div>
        </section>

        <div className="flex justify-end gap-3 border-t border-[#edf7f9] pt-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#d7dde8] px-4 py-2 font-semibold text-[#434655]"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-[#74B8E0] px-4 py-2 font-bold text-white"
          >
            <Save size={18} />
            <span>Lưu cài đặt</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
