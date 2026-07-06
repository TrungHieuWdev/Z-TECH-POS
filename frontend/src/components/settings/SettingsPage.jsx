import { Boxes, CreditCard, Lock, Printer, Store } from 'lucide-react';
import { SETTINGS_TABS } from '../../constants/settingsDefaults';
import useSettings from '../../hooks/useSettings';
import AccountSecuritySettings from './AccountSecuritySettings';
import InventorySettings from './InventorySettings';
import PaymentSettings from './PaymentSettings';
import PrintSettings from './PrintSettings';
import ShopInfoSettings from './ShopInfoSettings';
import { useLocation, useNavigate } from 'react-router-dom';

const tabIcons = {
  shop: Store,
  print: Printer,
  payment: CreditCard,
  inventory: Boxes,
  security: Lock
};

export default function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathTab = location.pathname.split('/')[2];
  const activeTab = SETTINGS_TABS.some((tab) => tab.id === pathTab) ? pathTab : SETTINGS_TABS[0].id;
  const { settings, isLoading, savingKey, saveSection, saveLogo } = useSettings();

  const renderContent = () => {
    if (isLoading) {
      return <div className="border border-[#e1e3e4] bg-white p-6 text-sm font-semibold text-[#66727c]">Đang tải cài đặt...</div>;
    }

    if (activeTab === 'shop') {
      return <ShopInfoSettings value={settings.shopInfo} onSave={(value) => saveSection('shopInfo', value)} onUploadLogo={saveLogo} isSaving={savingKey === 'shopInfo'} />;
    }
    if (activeTab === 'print') {
      return <PrintSettings value={settings.print} onSave={(value) => saveSection('print', value)} isSaving={savingKey === 'print'} />;
    }
    if (activeTab === 'payment') {
      return <PaymentSettings value={settings.payment} onSave={(value) => saveSection('payment', value)} isSaving={savingKey === 'payment'} />;
    }
    if (activeTab === 'inventory') {
      return <InventorySettings value={settings.inventory} onSave={(value) => saveSection('inventory', value)} isSaving={savingKey === 'inventory'} />;
    }
    return <AccountSecuritySettings />;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-950">Cài đặt</h1>
        <p className="mt-1 text-sm font-medium text-gray-500">Thiết lập cửa hàng, thanh toán, in hóa đơn, bảo mật và các tùy chọn vận hành hệ thống.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border border-[#e1e3e4] bg-white p-2">
          <nav className="space-y-1">
            {SETTINGS_TABS.map((tab) => {
              const Icon = tabIcons[tab.id];
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => navigate(tab.id === SETTINGS_TABS[0].id ? '/settings' : `/settings/${tab.id}`)}
                  className={`flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm font-bold transition ${
                    isActive ? 'bg-brand text-white' : 'text-[#34424d] hover:bg-brand-surface hover:text-brand-strong'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 border border-[#e1e3e4] bg-white p-4 shadow-[0_1px_3px_rgba(25,28,29,0.08)] md:p-5">
          {renderContent()}
        </section>
      </div>
    </div>
  );
}
