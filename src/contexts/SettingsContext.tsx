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

  const fetchSettings = async () => {
    try {
      const response = await apiCall('/settings');
      if (response.ok) {
        const settings = await response.json();
        setShowPlanningPage(settings.showPlanningPage !== false);
        setShowSchedulePage(settings.showSchedulePage !== false);
        setShowAccountsPage(settings.showAccountsPage !== false);
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
      versionChangeTrigger
    }}>
      {children}
    </SettingsContext.Provider>
  );
}; 