import { BrowserRouter as Router, Routes, Route, UNSAFE_NavigationContext } from 'react-router-dom';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Income from './components/Income';
import Schedule from './components/Schedule';
import Settings from './components/Settings';
import Expenses from './components/Expenses';
import Accounts from './components/Accounts';
import Planning from './components/Planning';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { FrequencyProvider } from './contexts/FrequencyContext';
import { SettingsProvider } from './contexts/SettingsContext';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
  },
});

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <Dashboard />,
    },
    {
      path: "/income",
      element: <Income />,
    },
    {
      path: "/expenses",
      element: <Expenses />,
    },
    {
      path: "/accounts",
      element: <Accounts />,
    },
    {
      path: "/schedule",
      element: <Schedule />,
    },
    {
      path: "/planning",
      element: <Planning />,
    },
    {
      path: "/settings",
      element: <Settings />,
    },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
);

function App() {
  return (
    <FrequencyProvider>
      <SettingsProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Router>
            <Box sx={{ display: 'flex' }}>
              <Sidebar />
              <Box
                component="main"
                sx={{
                  flex: 1,
                  minHeight: '100vh',
                  bgcolor: 'background.default'
                }}
              >
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/income" element={<Income />} />
                  <Route path="/expenses" element={<Expenses />} />
                  <Route path="/accounts" element={<Accounts />} />
                  <Route path="/schedule" element={<Schedule />} />
                  <Route path="/planning" element={<Planning />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Box>
            </Box>
          </Router>
        </ThemeProvider>
      </SettingsProvider>
    </FrequencyProvider>
  );
}

export default App; 