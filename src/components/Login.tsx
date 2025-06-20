import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { apiCall } from '../utils/api';

interface LoginProps {
  onLogin: (token: string, user: any) => void;
}

interface User {
  id: number;
  name: string;
  email: string;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiCall('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.needsPassword) {
          // User exists but needs to set password
          setNeedsPassword(true);
          setCurrentUser(data.user);
          setPassword('');
        } else {
          throw new Error(data.error || 'Login failed');
        }
      } else {
        // Successful login
        onLogin(data.token, data.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    if (!name.trim()) {
      setError('Name is required');
      setLoading(false);
      return;
    }

    try {
      const response = await apiCall('/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Registration successful, now login
      const loginResponse = await apiCall('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        throw new Error(loginData.error || 'Login failed');
      }

      onLogin(loginData.token, loginData.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const response = await apiCall('/auth/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to set password');
      }

      // Password set successfully, now login
      const loginResponse = await apiCall('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        throw new Error(loginData.error || 'Login failed');
      }

      onLogin(loginData.token, loginData.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setNeedsPassword(false);
    setCurrentUser(null);
    setPassword('');
    setConfirmPassword('');
    setError('');
  };

  const handleSwitchToRegister = () => {
    setIsRegistering(true);
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
  };

  const handleSwitchToLogin = () => {
    setIsRegistering(false);
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
  };

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'grey.100',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 400,
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Budget Tool
        </Typography>
        
        {!needsPassword ? (
          // Login or Register form
          <Box component="form" onSubmit={isRegistering ? handleRegister : handleLogin} sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              {isRegistering ? 'Create Account' : 'Sign In'}
            </Typography>
            
            {isRegistering && (
              <TextField
                fullWidth
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                sx={{ mb: 2 }}
                placeholder="Enter your full name"
              />
            )}

            <TextField
              fullWidth
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              sx={{ mb: 2 }}
              placeholder="Enter your email"
            />

            <TextField
              fullWidth
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{ mb: 2 }}
              placeholder={isRegistering ? "Choose a password (min 6 characters)" : "Enter your password"}
            />

            {isRegistering && (
              <TextField
                fullWidth
                type="password"
                label="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                sx={{ mb: 2 }}
                placeholder="Confirm your password"
              />
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading || !email || !password || (isRegistering && (!name || !confirmPassword))}
              sx={{ mt: 2 }}
            >
              {loading ? <CircularProgress size={24} /> : (isRegistering ? 'Create Account' : 'Sign In')}
            </Button>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {isRegistering ? 'Already have an account?' : "Don't have an account?"}
              </Typography>
              <Button
                onClick={isRegistering ? handleSwitchToLogin : handleSwitchToRegister}
                variant="text"
                size="small"
                sx={{ textTransform: 'none' }}
              >
                {isRegistering ? 'Sign In' : 'Register'}
              </Button>
            </Box>
          </Box>
        ) : (
          // Password setup form
          <Box component="form" onSubmit={handlePasswordSubmit} sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Set Password
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Welcome, {currentUser?.name}! Please set a password for your account.
            </Typography>

            <TextField
              fullWidth
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{ mb: 2 }}
              inputProps={{ minLength: 6 }}
              placeholder="Choose a password (min 6 characters)"
            />

            <TextField
              fullWidth
              type="password"
              label="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              sx={{ mb: 2 }}
              inputProps={{ minLength: 6 }}
              placeholder="Confirm your password"
            />

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                onClick={handleBackToLogin}
                variant="outlined"
                sx={{ flex: 1 }}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading || !password || !confirmPassword}
                sx={{ flex: 1 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Set Password'}
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default Login; 