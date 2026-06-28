import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { DEFAULT_SETTINGS, mergeSettings } from '../constants/settingsDefaults';
import { getSettings, updateSettings, uploadShopLogo } from '../services/settingsService';

export default function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getSettings();
      setSettings(mergeSettings(data));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tải cài đặt');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSection = useCallback(async (sectionKey, sectionValue) => {
    setSavingKey(sectionKey);
    try {
      const nextSettings = mergeSettings({
        ...settings,
        [sectionKey]: sectionValue
      });
      const data = await updateSettings(nextSettings);
      setSettings(mergeSettings(data));
      toast.success('Đã lưu cài đặt');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lưu cài đặt');
      return false;
    } finally {
      setSavingKey('');
    }
  }, [settings]);

  const saveLogo = useCallback(async (file) => {
    setSavingKey('shopInfo');
    try {
      const data = await uploadShopLogo(file);
      const nextSettings = mergeSettings({
        ...settings,
        shopInfo: { ...settings.shopInfo, logoUrl: data.logoUrl || '' }
      });
      setSettings(nextSettings);
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: nextSettings }));
      toast.success('Đã tải logo cửa hàng');
      return data.logoUrl || '';
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tải logo');
      return '';
    } finally {
      setSavingKey('');
    }
  }, [settings]);

  return {
    settings,
    isLoading,
    savingKey,
    reloadSettings: loadSettings,
    saveSection,
    saveLogo
  };
}
