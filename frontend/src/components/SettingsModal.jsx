import { useEffect, useState } from 'react';
import { Landmark, LoaderCircle, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { getUser, isFullAccessRole } from '../utils/auth';
import {
  bankOptions,
  getBankTransferSettings,
  loadBankTransferSettings,
  saveBankTransferSettings,
  validateBankName
} from '../utils/bankTransfer';

export default function SettingsModal({ isOpen, onClose }) {
  const canEdit = isFullAccessRole(getUser()?.role);
  const [form, setForm] = useState(getBankTransferSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isCustomBank = !bankOptions.some((bank) => bank.bankId === form.bankId);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    loadBankTransferSettings()
      .then(setForm)
      .catch((error) => toast.error(error.response?.data?.message || 'Không thể tải thông tin chuyển khoản'))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  const handleBankChange = (event) => {
    if (event.target.value === 'custom') {
      setForm((current) => ({ ...current, bankId: '', bankName: '' }));
      return;
    }
    const bank = bankOptions.find((item) => item.bankId === event.target.value);
    if (bank) setForm((current) => ({ ...current, ...bank }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!canEdit || isSaving) return;

    if (!/^970\d{3}$/.test(form.bankId.trim())) {
      toast.error('Mã BIN/NAPAS ngân hàng Việt Nam phải gồm 6 chữ số và bắt đầu bằng 970');
      return;
    }
    const bankNameError = validateBankName(form.bankName);
    if (bankNameError) {
      toast.error(bankNameError);
      return;
    }
    if (!/^\d{6,20}$/.test(form.accountNo.trim())) {
      toast.error('Số tài khoản phải gồm từ 6 đến 20 chữ số');
      return;
    }
    if (!form.accountName.trim()) {
      toast.error('Vui lòng nhập tên chủ tài khoản');
      return;
    }

    try {
      setIsSaving(true);
      setForm(await saveBankTransferSettings(form));
      toast.success('Đã cập nhật thông tin chuyển khoản');
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lưu thông tin chuyển khoản');
    } finally {
      setIsSaving(false);
    }
  };

  const fieldClass = 'h-12 w-full rounded-lg border border-[#d7dde8] bg-white px-4 text-base font-bold text-[#111827] outline-none transition focus:border-brand-strong focus:ring-2 focus:ring-brand-soft disabled:bg-gray-50 disabled:text-[#737686]';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cài đặt" maxWidth="max-w-3xl">
      <form className="space-y-6" onSubmit={handleSave}>
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

          <fieldset disabled={!canEdit || isLoading || isSaving} className="grid gap-4 md:grid-cols-2">
            <div className="block">
              <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[#98a2b3]">
                Ngân hàng thụ hưởng
              </span>
              <select value={isCustomBank ? 'custom' : form.bankId} onChange={handleBankChange} className={fieldClass}>
                {bankOptions.map((bank) => (
                  <option key={bank.bankId} value={bank.bankId}>{bank.bankName}</option>
                ))}
                <option value="custom">Ngân hàng khác — Nhập thủ công</option>
              </select>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[#98a2b3]">
                Số tài khoản thụ hưởng
              </span>
              <input
                value={form.accountNo}
                onChange={(event) => setForm((current) => ({ ...current, accountNo: event.target.value.replace(/\D/g, '') }))}
                inputMode="numeric"
                maxLength={20}
                className={fieldClass}
                placeholder="Nhập số tài khoản"
              />
            </label>

            {isCustomBank && (
              <>
                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[#98a2b3]">
                    Tên ngân hàng
                  </span>
                  <input
                    value={form.bankName}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      bankName: event.target.value.replace(/[^\p{L}\p{N}\s.&,'’()/-]/gu, '')
                    }))}
                    onBlur={() => setForm((current) => ({ ...current, bankName: current.bankName.trim().replace(/\s+/g, ' ') }))}
                    maxLength={150}
                    className={fieldClass}
                    placeholder="Ví dụ: ABC Bank hoặc Ngân hàng TMCP ABC"
                  />
                  {form.bankName && validateBankName(form.bankName) && (
                    <span className="mt-1 block text-xs font-semibold text-red-600">
                      {validateBankName(form.bankName)}
                    </span>
                  )}
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[#98a2b3]">
                    Mã BIN/NAPAS
                  </span>
                  <input
                    value={form.bankId}
                    onChange={(event) => setForm((current) => ({ ...current, bankId: event.target.value.replace(/\D/g, '') }))}
                    inputMode="numeric"
                    maxLength={6}
                    className={fieldClass}
                    placeholder="Ví dụ: 970xxx"
                  />
                  <span className="mt-1 block text-xs font-medium text-[#737686]">
                    Mã BIN ngân hàng Việt Nam gồm 6 chữ số và bắt đầu bằng 970.
                  </span>
                </label>
              </>
            )}

            <label className="block md:col-span-2">
              <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[#98a2b3]">
                Tên chủ tài khoản thụ hưởng
              </span>
              <input
                value={form.accountName}
                onChange={(event) => setForm((current) => ({ ...current, accountName: event.target.value.toUpperCase() }))}
                maxLength={100}
                className={fieldClass}
                placeholder="Nhập tên chủ tài khoản"
              />
            </label>
          </fieldset>

          {!canEdit && (
            <p className="mt-4 text-sm font-semibold text-[#737686]">
              Chỉ chủ cửa hàng và quản lý mới được thay đổi thông tin này.
            </p>
          )}
        </section>

        <div className="flex justify-end gap-3 border-t border-[#edf7f9] pt-5">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#d7dde8] px-4 py-2 font-semibold text-[#434655]">
            Hủy
          </button>
          {canEdit && (
            <button
              type="submit"
              disabled={isLoading || isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-strong px-5 py-2 font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <LoaderCircle size={18} className="animate-spin" /> : <Save size={18} />}
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
