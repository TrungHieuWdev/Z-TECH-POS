import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl' }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-xl bg-white p-6 shadow-xl`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 transition hover:bg-brand-surface hover:text-brand-strong"
            aria-label="Đóng"
            title="Đóng"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
