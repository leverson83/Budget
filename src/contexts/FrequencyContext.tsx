import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_URL, type Frequency } from '../config';

interface FrequencyContextType {
  frequency: Frequency;
  setFrequency: (frequency: Frequency) => void;
}

const FrequencyContext = createContext<FrequencyContextType | undefined>(undefined);

export const FrequencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [frequency, setFrequencyState] = useState<Frequency>('monthly');

  useEffect(() => {
    // Load frequency from API on mount
    fetch(`${API_URL}/settings/frequency`)
      .then(res => res.json())
      .then(data => setFrequencyState(data.frequency as Frequency))
      .catch(err => console.error('Error loading frequency:', err));
  }, []);

  const setFrequency = (newFrequency: Frequency) => {
    // Save to API
    fetch(`${API_URL}/settings/frequency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frequency: newFrequency })
    })
      .then(res => res.json())
      .then(data => setFrequencyState(data.frequency as Frequency))
      .catch(err => console.error('Error saving frequency:', err));
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