import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl', panelClassName = '', headerClassName = '', headerActions = null }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const scrollY = window.scrollY;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousOverflow = document.body.style.overflow;
    const previousPosition = document.body.style.position;
    const previousTop = document.body.style.top;
    const previousWidth = document.body.style.width;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : previousPaddingRight;

    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousOverflow;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = previousWidth;
      document.body.style.paddingRight = previousPaddingRight;
      window.scrollTo(0, scrollY);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen touch-none items-end justify-center overflow-hidden overscroll-none bg-black/60 sm:items-center sm:px-4 sm:py-6" role="presentation">
      <div className={`relative max-h-[94dvh] w-full ${maxWidth} touch-pan-y overscroll-contain overflow-y-auto bg-white p-4 shadow-xl sm:max-h-[90vh] sm:p-6 ${panelClassName}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Hộp thoại'} onClick={(event) => event.stopPropagation()}>
        <div className={`sticky -top-4 z-30 -mx-4 mb-5 flex items-center justify-between gap-4 border-b bg-white px-4 py-3 sm:-top-6 sm:-mx-6 sm:px-6 sm:py-4 ${headerClassName}`}>
          <h2 className="min-w-0 truncate text-lg font-semibold text-gray-900 sm:text-xl">{title}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
