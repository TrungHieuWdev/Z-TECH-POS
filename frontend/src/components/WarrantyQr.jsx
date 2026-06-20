import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function WarrantyQr({ warrantyCode, publicToken }) {
  const [dataUrl, setDataUrl] = useState('');
  const lookupUrl = `${import.meta.env.VITE_PUBLIC_BASE_URL}/tra-cuu-bao-hanh/${encodeURIComponent(publicToken)}`;
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(lookupUrl, { errorCorrectionLevel: 'H', margin: 2, width: 360, color: { dark: '#111827', light: '#ffffff' } })
      .then((url) => { if (active) setDataUrl(url); });
    return () => { active = false; };
  }, [lookupUrl]);
  return <div className="border border-gray-200 bg-white p-4 text-center">
    {dataUrl ? <img src={dataUrl} alt={`QR tra cứu bảo hành ${warrantyCode}`} className="mx-auto h-40 w-40 object-contain" /> : <div className="mx-auto h-40 w-40 animate-pulse bg-gray-100" />}
    <p className="mt-2 text-xs font-semibold text-gray-700">Quét để tra cứu bảo hành</p>
    <p className="mt-1 text-[11px] text-gray-500">{warrantyCode}</p>
    <p className="mt-2 max-w-xs text-[11px] leading-4 text-gray-500">QR tra cứu bảo hành chỉ dùng được khi điện thoại và laptop dùng chung Wi-Fi trong lúc demo.</p>
  </div>;
}
