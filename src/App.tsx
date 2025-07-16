import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box, CssBaseline, ThemeProvider, createTheme, CircularProgress } from '@mui/material';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Income from './components/Income';
import Schedule from './components/Schedule';
import Settings from './components/Settings';
import Expenses from './components/Expenses';
import Accounts from './components/Accounts';
import Planning from './components/Planning';
import OnTrack from './components/OnTrack';
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

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
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
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Login Page Component
const LoginPage = () => {
  const { isAuthenticated, login } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Login onLogin={login} />;
};

// Main App Component
const MainApp = () => {
  return (
    <FrequencyProvider>
      <SettingsProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={
            <ProtectedRoute>
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
                  <Dashboard />
                </Box>
              </Box>
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/income" element={
            <ProtectedRoute>
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
                  <Income />
                </Box>
              </Box>
            </ProtectedRoute>
          } />
          <Route path="/expenses" element={
            <ProtectedRoute>
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
                  <Expenses />
                </Box>
              </Box>
            </ProtectedRoute>
          } />
          <Route path="/accounts" element={
            <ProtectedRoute>
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
                  <Accounts />
                </Box>
              </Box>
            </ProtectedRoute>
          } />
          <Route path="/schedule" element={
            <ProtectedRoute>
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
                  <Schedule />
                </Box>
              </Box>
            </ProtectedRoute>
          } />
          <Route path="/planning" element={
            <ProtectedRoute>
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
                  <Planning />
                </Box>
              </Box>
            </ProtectedRoute>
          } />
          <Route path="/ontrack" element={
            <ProtectedRoute>
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
                  <OnTrack />
                </Box>
              </Box>
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
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
                  <Settings />
                </Box>
              </Box>
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SettingsProvider>
    </FrequencyProvider>
  );
};

const AuthenticatedApp = () => {
  const { loading } = useAuth();

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

  return (
    <Router>
      <MainApp />
    </Router>
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