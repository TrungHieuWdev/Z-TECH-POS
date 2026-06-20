import { Landmark } from 'lucide-react';
import Modal from './Modal';
import bankConfig from '../config/bank';

export default function SettingsModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cài đặt" maxWidth="max-w-3xl">
      <div className="space-y-6">
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
              <div className="flex min-h-12 items-center border border-[#d7dde8] bg-gray-50 px-4 text-base font-bold text-[#111827]">{bankConfig.bankName}</div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[#98a2b3]">
                Số tài khoản thụ hưởng
              </span>
              <div className="flex h-12 items-center border border-[#d7dde8] bg-gray-50 px-4 text-base font-bold text-[#111827]">{bankConfig.accountNumber}</div>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[#98a2b3]">
                Tên chủ tài khoản thụ hưởng
              </span>
              <div className="flex h-12 items-center border border-[#d7dde8] bg-gray-50 px-4 text-base font-bold text-[#111827]">{bankConfig.accountName}</div>
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
        </div>
      </div>
    </Modal>
  );
}
