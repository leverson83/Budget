import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Box, CssBaseline, ThemeProvider, createTheme, CircularProgress } from '@mui/material';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Income from './components/Income';
import Schedule from './components/Schedule';
import Settings from './components/Settings';
import Expenses from './components/Expenses';
import Accounts from './components/Accounts';
import Planning from './components/Planning';
import Login from './components/Login';
import { FrequencyProvider } from './contexts/FrequencyContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

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

const AuthenticatedApp = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={useAuth().login} />;
  }

  return (
    <FrequencyProvider>
      <SettingsProvider>
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
      </SettingsProvider>
    </FrequencyProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthenticatedApp />
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App; 