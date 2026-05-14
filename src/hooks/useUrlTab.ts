import { useState, useEffect, useCallback } from 'react';

type TabId = 'chart' | 'orders' | 'labs' | 'assess' | 'comms' | 'dxpause' | 'archive';

const VALID_TABS: TabId[] = ['chart', 'orders', 'labs', 'assess', 'comms', 'dxpause', 'archive'];

function getTabFromUrl(): TabId {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') as TabId | null;
  if (tab && VALID_TABS.includes(tab)) return tab;
  return 'chart';
}

export function useUrlTab(): [TabId, (tab: TabId) => void] {
  const [activeTab, setActiveTab] = useState<TabId>(getTabFromUrl);

  const setTab = useCallback((tab: TabId) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Sync on popstate (back/forward)
  useEffect(() => {
    const handlePop = () => {
      setActiveTab(getTabFromUrl());
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  return [activeTab, setTab];
}
