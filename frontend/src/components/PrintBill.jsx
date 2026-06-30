import { Phone, Printer, ShieldCheck } from 'lucide-react';
import defaultLogo from '../assets/images/1111.png';
import { getUploadedAssetUrl } from '../services/settingsService';
import { getWarrantyLabel } from '../utils/warrantyPolicy';

const paymentLabels = {
  cash: 'Tiền mặt',
  card: 'Thẻ',
  transfer: 'Chuyển khoản',
  qr: 'QR Code'
};

function money(value) {
  return Number(value || 0).toLocaleString('vi-VN');
}

function dateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function PrintBill({ receipt, onPrint = () => window.print(), showPrintButton = false }) {
  if (!receipt) return null;

  const shop = receipt.shopInfo || {};
  const shopName = shop.name || 'Z-TECH POS';
  const address = shop.address || '43 Ao Doi, Binh Tri Dong A, TP.HCM';
  const phone = shop.phone || '0374676623';
  const logo = getUploadedAssetUrl(shop.logoUrl) || defaultLogo;
  const discount = Number(receipt.discount || 0) + Number(receipt.pointsDiscountAmount || 0);
  const footer = 'Hẹn gặp lại.';

  return (
    <div className="bill-preview-wrap">
      {showPrintButton && (
        <button type="button" className="no-print bill-print-button" onClick={onPrint}>
          <Printer size={17} /> In hóa đơn
        </button>
      )}

      <article className="print-bill" aria-label={`Hóa đơn ${receipt.orderNumber || ''}`}>
        <header className="bill-header">
          <img src={logo} alt={`Logo ${shopName}`} className="bill-logo" />
          <h1>{shopName}</h1>
          <p>{address}</p>
          <p>Hotline: {phone}</p>
        </header>

        <div className="bill-dashed-line" />
        <h2 className="bill-title">HÓA ĐƠN BÁN HÀNG</h2>

        <section className="bill-info" aria-label="Thông tin hóa đơn">
          <div><strong>Mã đơn</strong><span>:</span><p>{receipt.orderNumber}</p></div>
          <div><strong>Ngày giờ</strong><span>:</span><p>{dateTime(receipt.createdAt)}</p></div>
          <div><strong>Thu ngân</strong><span>:</span><p>{receipt.cashierName || 'Nhân viên'}</p></div>
          <div><strong>Khách hàng</strong><span>:</span><p>{receipt.customerName || 'Khách lẻ'}</p></div>
          <div><strong>Phương thức</strong><span>:</span><p>{paymentLabels[receipt.paymentMethod] || receipt.paymentMethod || 'Chưa xác định'}</p></div>
        </section>

        <section className="bill-products" aria-label="Sản phẩm">
          <div className="bill-product-grid bill-product-head">
            <strong>Tên sản phẩm</strong><strong>SL</strong><strong>Đơn giá</strong><strong>Thành tiền</strong>
          </div>
          {(receipt.items || []).map((item, index) => (
            <div className="bill-product-grid bill-product-row" key={`${item.id || 'item'}-${index}`}>
              <div className="bill-product-name">
                <strong>{item.name || item.product_name}</strong>
                {getWarrantyLabel(item) && <small>{getWarrantyLabel(item)}</small>}
                {item.warranty_note && <small>{item.warranty_note}</small>}
              </div>
              <span>{item.quantity}</span>
              <span>{money(item.unitPrice ?? item.unit_price)}</span>
              <strong>{money(item.lineTotal ?? item.subtotal)}</strong>
            </div>
          ))}
        </section>

        <section className="bill-totals" aria-label="Tổng tiền">
          <div><span>Tạm tính</span><span>{money(receipt.subtotal)}</span></div>
          <div><span>Giảm giá</span><span>{discount ? `-${money(discount)}` : '0'}</span></div>
          <div><span>VAT ({money(receipt.vatRate)}%)</span><span>{money(receipt.vatAmount)}</span></div>
          {receipt.paymentMethod === 'cash' && <div><span>Tiền khách đưa</span><span>{money(receipt.customerPaid)}</span></div>}
          {receipt.paymentMethod === 'cash' && <div className="bill-change"><strong>Tiền thừa</strong><strong>{money(receipt.changeDue)}</strong></div>}
          <div className="bill-grand-total"><strong>TỔNG CỘNG</strong><strong>{money(receipt.total)}</strong></div>
        </section>

        <footer className="bill-footer">
          <div className="bill-dashed-line" />
          <strong>Xin cảm ơn Quý khách!</strong>
          <p>{footer}</p>
          <p className="bill-footer-row"><Phone size={15} /> Hotline hỗ trợ: {phone}</p>
          <p className="bill-footer-row"><ShieldCheck size={15} /> Chính sách đổi trả trong 7 ngày.</p>
          <div className="bill-dashed-line" />
          <p>Cảm ơn bạn đã lựa chọn {shopName}!</p>
        </footer>
      </article>
    </div>
  );
}
