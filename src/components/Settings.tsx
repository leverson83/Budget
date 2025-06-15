import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';

const API_URL = 'http://localhost:3001/api';

interface Settings {
  fuzziness: {
    weekly: number;
    fortnightly: number;
    monthly: number;
    quarterly: number;
    yearly: number;
  };
  ignoreWeekends: boolean;
}

const defaultSettings: Settings = {
  fuzziness: {
    weekly: 0,
    fortnightly: 0,
    monthly: 0,
    quarterly: 0,
    yearly: 0,
  },
  ignoreWeekends: false,
};

const Settings = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        console.log('Fetching settings...');
        const response = await fetch(`${API_URL}/settings`);
        if (response.ok) {
          const data = await response.json();
          console.log('Received settings:', data);
          setSettings(data);
        } else {
          console.error('Failed to fetch settings:', response.status);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };

    fetchSettings();
  }, []);

  const handleFuzzinessChange = async (frequency: keyof Settings['fuzziness'], value: number) => {
    const newSettings = {
      ...settings,
      fuzziness: {
        ...settings.fuzziness,
        [frequency]: value,
      },
    };
    setSettings(newSettings);

    try {
      const response = await fetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleIgnoreWeekendsChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSettings = {
      ...settings,
      ignoreWeekends: event.target.checked,
    };
    setSettings(newSettings);

    try {
      const response = await fetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  console.log('Current settings state:', settings);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <List>
        <ListItem>
          <Accordion sx={{ width: '100%' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title="Settings for how dates are handled in the schedule">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Typography variant="h6" sx={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                  Scheduling
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                <ListItem>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Tooltip title="Any amounts due on a weekend will show as next business day">
                        <IconButton size="small">
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Typography>Ignore weekends for schedule</Typography>
                    </Box>
                    <Checkbox
                      checked={settings.ignoreWeekends}
                      onChange={handleIgnoreWeekendsChange}
                    />
                  </Box>
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>
        </ListItem>
        <ListItem>
          <Accordion sx={{ width: '100%' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title="Adjust how many days before/after the due date an amount can be considered on time">
                  <IconButton size="small">
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Typography variant="h6" sx={{ fontWeight: 'bold', textDecoration: 'underline' }}>
                  Fuzziness
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                {Object.entries(settings.fuzziness).map(([frequency, value]) => (
                  <ListItem key={frequency}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography>
                            {frequency.charAt(0).toUpperCase() + frequency.slice(1)}
                          </Typography>
                        </Box>
                      }
                    />
                    <TextField
                      type="number"
                      value={value}
                      onChange={(e) => handleFuzzinessChange(frequency as keyof Settings['fuzziness'], Number(e.target.value))}
                      inputProps={{ min: 0, max: 31 }}
                      size="small"
                      sx={{ width: '80px' }}
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </ListItem>
      </List>
    </Box>
  );
};

export default Settings; 