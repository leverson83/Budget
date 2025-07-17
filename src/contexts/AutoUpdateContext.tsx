import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import AutoUpdateModal from '../components/AutoUpdateModal';

interface AutoUpdateContextType {
  showAutoUpdateModal: () => void;
  hideAutoUpdateModal: () => void;
}

const AutoUpdateContext = createContext<AutoUpdateContextType | undefined>(undefined);

export const useAutoUpdate = () => {
  const context = useContext(AutoUpdateContext);
  if (context === undefined) {
    throw new Error('useAutoUpdate must be used within an AutoUpdateProvider');
  }
  return context;
};

interface AutoUpdateProviderProps {
  children: ReactNode;
}

export const AutoUpdateProvider: React.FC<AutoUpdateProviderProps> = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  const showAutoUpdateModal = () => {
    setIsModalOpen(true);
  };

  const hideAutoUpdateModal = () => {
    setIsModalOpen(false);
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    console.log('AutoUpdateContext: User is authenticated, checking session...');
    
    // For testing, let's clear the session storage to force the modal to show
    sessionStorage.removeItem('budget-tool-auto-update-shown');
    
    // Check if this is the first time loading the app in this session
    const sessionKey = 'budget-tool-auto-update-shown';
    const hasShownInSession = sessionStorage.getItem(sessionKey);

    console.log('AutoUpdateContext: Has shown in session:', hasShownInSession);

    if (!hasShownInSession) {
      console.log('AutoUpdateContext: Showing modal...');
      // Mark that we've shown the modal in this session
      sessionStorage.setItem(sessionKey, 'true');
      
      // Show the modal after a short delay to ensure the app is fully loaded
      const timer = setTimeout(() => {
        console.log('AutoUpdateContext: Triggering modal...');
        showAutoUpdateModal();
      }, 1000);

      return () => clearTimeout(timer);
    } else {
      console.log('AutoUpdateContext: Modal already shown in this session');
    }
  }, [isAuthenticated]);

  return (
    <AutoUpdateContext.Provider value={{ showAutoUpdateModal, hideAutoUpdateModal }}>
      {children}
      <AutoUpdateModal isOpen={isModalOpen} onClose={hideAutoUpdateModal} />
    </AutoUpdateContext.Provider>
  );
}; 