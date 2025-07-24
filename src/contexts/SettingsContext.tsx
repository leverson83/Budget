import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiCall } from '../utils/api';

interface SettingsContextType {
  showPlanningPage: boolean;
  showSchedulePage: boolean;
  showAccountsPage: boolean;
  updateSettings: (planning: boolean, schedule: boolean, accounts: boolean) => void;
  refreshSettings: () => void;
  refreshAllData: () => void;
  versionChangeTrigger: number;
  getChartType: (graphKey: string) => string | undefined;
  setChartType: (graphKey: string, chartType: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [showPlanningPage, setShowPlanningPage] = useState(true);
  const [showSchedulePage, setShowSchedulePage] = useState(true);
  const [showAccountsPage, setShowAccountsPage] = useState(true);
  const [versionChangeTrigger, setVersionChangeTrigger] = useState(0);
  const [chartTypes, setChartTypes] = useState<{ [key: string]: string }>({});

  const fetchSettings = async () => {
    try {
      const response = await apiCall('/settings');
      if (response.ok) {
        const settings = await response.json();
        setShowPlanningPage(settings.showPlanningPage !== false);
        setShowSchedulePage(settings.showSchedulePage !== false);
        setShowAccountsPage(settings.showAccountsPage !== false);
        // Load chart types from settings (keys starting with 'chartType:')
        const loadedChartTypes: { [key: string]: string } = {};
        Object.keys(settings).forEach((key) => {
          if (key.startsWith('chartType:')) {
            const graphKey = key.replace('chartType:', '');
            loadedChartTypes[graphKey] = settings[key];
          }
        });
        setChartTypes(loadedChartTypes);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const updateSettings = async (planning: boolean, schedule: boolean, accounts: boolean) => {
    try {
      const response = await apiCall('/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showPlanningPage: planning,
          showSchedulePage: schedule,
          showAccountsPage: accounts
        })
      });
      
      if (response.ok) {
        setShowPlanningPage(planning);
        setShowSchedulePage(schedule);
        setShowAccountsPage(accounts);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  const refreshSettings = () => {
    fetchSettings();
  };

  const refreshAllData = () => {
    // Increment the trigger to notify all components that they should refresh their data
    setVersionChangeTrigger(prev => prev + 1);
  };

  const getChartType = (graphKey: string) => {
    return chartTypes[graphKey];
  };

  const setChartType = async (graphKey: string, chartType: string) => {
    setChartTypes((prev) => ({ ...prev, [graphKey]: chartType }));
    // Save to backend
    try {
      await apiCall('/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [`chartType:${graphKey}`]: chartType })
      });
    } catch (error) {
      console.error('Error saving chart type:', error);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{
      showPlanningPage,
      showSchedulePage,
      showAccountsPage,
      updateSettings,
      refreshSettings,
      refreshAllData,
      versionChangeTrigger,
      getChartType,
      setChartType
    }}>
      {children}
    </SettingsContext.Provider>
  );
}; 