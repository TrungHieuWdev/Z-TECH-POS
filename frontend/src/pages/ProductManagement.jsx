import { useLocation, useNavigate } from 'react-router-dom';
import Products from './Products';
import Promotions from './Promotions';

const tabs = [
  { value: 'products', label: 'Sản phẩm' },
  { value: 'promotions', label: 'Khuyến mãi' }
];

export default function ProductManagement() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname.endsWith('/promotions') ? 'promotions' : 'products';

  function selectTab(tab) {
    navigate(tab === 'products' ? '/products' : '/products/promotions');
  }

  const tabNavigation = (
    <nav className="flex gap-7 overflow-x-auto" aria-label="Quản lý sản phẩm">
      {tabs.map((tab) => {
        const selected = activeTab === tab.value;
        return (
          <button key={tab.value} type="button" onClick={() => selectTab(tab.value)} className={`shrink-0 border-b-2 px-0 py-3 text-sm font-bold transition ${selected ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-400 hover:text-gray-700'}`} aria-current={selected ? 'page' : undefined}>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );

  return activeTab === 'promotions'
    ? <Promotions tabNavigation={tabNavigation} />
    : <Products tabNavigation={tabNavigation} />;
}
