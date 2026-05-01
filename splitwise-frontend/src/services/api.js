import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const register = (data) => api.post('/auth/register', data);
export const login    = (data) => api.post('/auth/login', data);
export const getMe    = ()     => api.get('/auth/me');

// Groups
export const getGroups   = ()        => api.get('/groups');
export const createGroup = (data)    => api.post('/groups', data);
export const getBalances = (groupId) => api.get(`/groups/${groupId}/balances`);

// Expenses
export const getExpenses = (groupId) => api.get(`/expenses/group/${groupId}`);
export const addExpense  = (data)    => api.post('/expenses', data);

// Settlements
export const settleUp       = (data)    => api.post('/settlements', data);
export const getSettlements = (groupId) => api.get(`/settlements/group/${groupId}`);

// Groups ke existing exports ke neeche yeh add karo
export const deleteGroup = (groupId) => api.delete(`/groups/${groupId}`);

// Invite
export const generateInvite = (groupId) => api.post(`/groups/${groupId}/invite`);
export const joinGroup       = (token)   => api.post(`/groups/join/${token}`);

export default api;