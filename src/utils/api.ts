import { API_URL } from '../config';

export const apiCall = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = localStorage.getItem('token');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Only reload on auth errors for authenticated requests (when token exists)
  // Don't reload for login/register attempts
  if ((response.status === 401 || response.status === 403) && token && !endpoint.includes('/auth/')) {
    // Token is invalid, redirect to login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  }

  return response;
}; 