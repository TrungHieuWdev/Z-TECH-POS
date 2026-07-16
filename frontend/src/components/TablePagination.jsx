import { ChevronLeft, ChevronRight } from 'lucide-react';

function getVisiblePages(currentPage, totalPages) {
  return Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages]))
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

export default function TablePagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'dòng',
  ariaLabel = 'Phân trang bảng',
  className = ''
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const pages = getVisiblePages(safePage, totalPages);
  const firstItem = totalItems > 0 ? (safePage - 1) * pageSize + 1 : 0;
  const lastItem = Math.min(safePage * pageSize, totalItems);

  const changePage = (page) => {
    if (page === safePage || page < 1 || page > totalPages) return;
    onPageChange(page);
  };

  return (
    <div className={`flex min-h-[66px] flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <p className="text-sm font-medium text-gray-500">
        Hiển thị {firstItem.toLocaleString('vi-VN')}–{lastItem.toLocaleString('vi-VN')} trong {totalItems.toLocaleString('vi-VN')} {itemLabel}
      </p>

      <nav className="flex min-w-0 items-center justify-end gap-1" aria-label={ariaLabel}>
        <button
          type="button"
          disabled={safePage === 1}
          onClick={() => changePage(safePage - 1)}
          className="grid h-10 w-10 shrink-0 place-items-center border border-gray-200 bg-white text-gray-600 transition hover:border-brand hover:text-brand-strong disabled:cursor-not-allowed disabled:text-gray-300 disabled:opacity-60"
          aria-label="Trang trước"
        >
          <ChevronLeft size={19} />
        </button>

        {pages.map((page, index) => (
          <span key={page} className="contents">
            {index > 0 && page - pages[index - 1] > 1 && (
              <span className="grid h-10 min-w-8 place-items-center px-1 text-sm font-bold text-gray-400">…</span>
            )}
            <button
              type="button"
              onClick={() => changePage(page)}
              className={`h-10 min-w-10 shrink-0 border px-2 text-sm font-extrabold transition ${
                safePage === page
                  ? 'border-brand bg-brand text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-brand hover:text-brand-strong'
              }`}
              aria-current={safePage === page ? 'page' : undefined}
            >
              {page.toLocaleString('vi-VN')}
            </button>
          </span>
        ))}

        <button
          type="button"
          disabled={safePage === totalPages}
          onClick={() => changePage(safePage + 1)}
          className="grid h-10 w-10 shrink-0 place-items-center border border-gray-200 bg-white text-gray-600 transition hover:border-brand hover:text-brand-strong disabled:cursor-not-allowed disabled:text-gray-300 disabled:opacity-60"
          aria-label="Trang sau"
        >
          <ChevronRight size={19} />
        </button>
      </nav>
    </div>
  );
}
