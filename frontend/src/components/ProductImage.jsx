import { Cable, Camera, Headphones, Package, Shield, SmartphoneCharging } from 'lucide-react';

const familyThemes = {
  apple: {
    bg: 'from-[#f8fdfe] via-[#edf8fb] to-[#d9f3f8]',
    text: 'text-[#0f3b46]'
  },
  samsung: {
    bg: 'from-[#f7fbff] via-[#edf7ff] to-[#d7ecff]',
    text: 'text-[#16466b]'
  },
  vivo: {
    bg: 'from-[#f8fbff] via-[#eef4ff] to-[#dce9ff]',
    text: 'text-[#334b8f]'
  },
  oppo: {
    bg: 'from-[#f8fffb] via-[#edf9f2] to-[#d8f1e3]',
    text: 'text-[#176244]'
  },
  xiaomi: {
    bg: 'from-[#fffdf8] via-[#fff6e8] to-[#ffe4c2]',
    text: 'text-[#835018]'
  },
  default: {
    bg: 'from-[#f8fafc] via-[#f1f5f9] to-[#e2e8f0]',
    text: 'text-[#334155]'
  }
};

const typeIcons = {
  case: Package,
  glass: Shield,
  lens: Camera,
  charger: SmartphoneCharging,
  audio: Headphones,
  utility: Cable,
  accessory: Package
};

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getAccessoryType(product = {}) {
  const imageType = String(product.image_url || '').split('/').pop();

  if (typeIcons[imageType]) {
    return imageType;
  }

  const text = normalizeText(`${product.category_name || ''} ${product.name || ''}`);

  if (text.includes('camera') || text.includes('lens')) return 'lens';
  if (text.includes('kinh') || text.includes('glass') || text.includes('cuong luc')) return 'glass';
  if (text.includes('sac') || text.includes('cap') || text.includes('charger')) return 'charger';
  if (text.includes('tai nghe') || text.includes('am thanh')) return 'audio';
  if (text.includes('gia do') || text.includes('tien ich') || text.includes('utility')) return 'utility';
  if (text.includes('op lung') || text.includes('case')) return 'case';

  return 'accessory';
}

function getAccessoryIcon(product = {}) {
  return typeIcons[getAccessoryType(product)] || Package;
}

function shouldUseGeneratedImage(imageUrl = '') {
  return !imageUrl || imageUrl.includes('placehold.co') || imageUrl.startsWith('ztech://');
}

export default function ProductImage({ product, className = '', iconSize = 42, compact = false }) {
  const family = product?.device_family || product?.family || 'default';
  const theme = familyThemes[family] || familyThemes.default;
  const Icon = getAccessoryIcon(product);
  const iconBoxClass = compact ? 'h-9 w-9 rounded-xl' : 'h-20 w-20 rounded-2xl';

  if (!shouldUseGeneratedImage(product?.image_url)) {
    return (
      <div className={`relative grid h-full w-full place-items-center bg-[#f8fdfe] ${className}`}>
        <img
          src={product.image_url}
          alt={product.name}
          className="h-full w-full object-contain p-4"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className={`relative grid h-full w-full place-items-center overflow-hidden bg-gradient-to-br ${theme.bg} ${className}`}>
      {!compact && (
        <>
          <div className="absolute inset-x-0 top-0 h-px bg-white/70" />
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/45" />
          <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-white/35" />
        </>
      )}

      <div className={`relative grid place-items-center bg-white/85 shadow-sm ring-1 ring-white/80 ${iconBoxClass} ${theme.text}`}>
        <Icon size={iconSize} strokeWidth={1.8} />
      </div>
    </div>
  );
}
