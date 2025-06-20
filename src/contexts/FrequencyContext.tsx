import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { API_URL, type Frequency } from '../config';
import { apiCall } from '../utils/api';

interface FrequencyContextType {
  frequency: Frequency;
  setFrequency: (frequency: Frequency) => void;
}

const FrequencyContext = createContext<FrequencyContextType | undefined>(undefined);

export const FrequencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [frequency, setFrequencyState] = useState<Frequency>('monthly');

  useEffect(() => {
    const fetchFrequency = async () => {
      try {
        const response = await apiCall('/settings/frequency');
        if (response.ok) {
          const data = await response.json();
          setFrequencyState(data.frequency as Frequency);
        }
      } catch (error) {
        console.error('Error loading frequency:', error);
      }
    };

    fetchFrequency();
  }, []);

  const setFrequency = (newFrequency: Frequency) => {
    // Save to API
    updateFrequency(newFrequency);
  };

  const updateFrequency = async (newFrequency: Frequency) => {
    try {
      const response = await apiCall('/settings/frequency', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ frequency: newFrequency }),
      });

      if (response.ok) {
        setFrequencyState(newFrequency);
      }
    } catch (error) {
      console.error('Error updating frequency:', error);
    }
  };

  return (
    <FrequencyContext.Provider value={{ frequency, setFrequency }}>
      {children}
    </FrequencyContext.Provider>
  );
};

export const useFrequency = () => {
  const context = useContext(FrequencyContext);
  if (context === undefined) {
    throw new Error('useFrequency must be used within a FrequencyProvider');
  }
  return context;
}; 