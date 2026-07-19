import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-2xl', panelClassName = '', headerClassName = '', headerActions = null, showCloseButton = false }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement;
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

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = [...panelRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )].filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    requestAnimationFrame(() => {
      const firstFocusable = panelRef.current?.querySelector(
        '[autofocus], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
      );
      (firstFocusable || panelRef.current)?.focus();
    });
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousOverflow;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = previousWidth;
      document.body.style.paddingRight = previousPaddingRight;
      window.scrollTo(0, scrollY);
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen touch-none items-end justify-center overflow-hidden overscroll-none bg-black/30 backdrop-blur-[1px] sm:items-center sm:px-4 sm:py-6" role="presentation">
      <div ref={panelRef} tabIndex="-1" className={`relative max-h-[94dvh] w-full ${maxWidth} touch-pan-y overscroll-contain overflow-y-auto bg-white p-4 shadow-xl outline-none sm:max-h-[90vh] sm:p-6 ${panelClassName}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <div className={`sticky -top-4 z-30 -mx-4 mb-5 flex items-center justify-between gap-4 border-b bg-white px-4 py-3 sm:-top-6 sm:-mx-6 sm:px-6 sm:py-4 ${headerClassName}`}>
          <h2 id={titleId} className="min-w-0 truncate text-lg font-semibold text-gray-900 sm:text-xl">{title}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="h-10 border border-[#69afd6] bg-white px-4 text-sm font-bold text-[#398fbd] transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#69afd6] focus-visible:ring-offset-2"
              >
                Đóng
              </button>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
