import axios from 'axios';

const api = axios.create({
//   baseURL: "https://splitwise-tres.vercel.app/api",
    // baseURL: "http://localhost:5000/api",
    baseURL: import.meta.env.VITE_BACKEND_URL,
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
export const getDetailedBalances = (groupId) => api.get(`/groups/${groupId}/detailed-balances`);
export const getSettlementSummary = (groupId) => api.get(`/groups/${groupId}/settlement-summary`);
export const getGroupHistory = (groupId) => api.get(`/groups/${groupId}/history`);

// Expenses
export const getExpenses = (groupId) => api.get(`/expenses/group/${groupId}`);
export const addExpense  = (data)    => api.post('/expenses', data);

// Settlements
export const settleUp       = (data)    => api.post('/settlements', data);
export const getSettlements = (groupId) => api.get(`/settlements/group/${groupId}`);
export const updateSettlement = (settlementId, data) => api.put(`/settlements/${settlementId}`, data);
export const deleteSettlement = (settlementId) => api.delete(`/settlements/${settlementId}`);

// Groups ke existing exports ke neeche yeh add karo
export const deleteGroup = (groupId) => api.delete(`/groups/${groupId}`);

// Invite
export const generateInvite = (groupId) => api.post(`/groups/${groupId}/invite`);
export const joinGroup       = (token)   => api.post(`/groups/join/${token}`);

export const updateExpense = (expenseId, data) => api.put(`/expenses/${expenseId}`, data);
export const deleteExpense = (expenseId)       => api.delete(`/expenses/${expenseId}`);

// Wishlist
export const getWishlist            = ()         => api.get('/wishlist');
export const addWishlistItem        = (data)     => api.post('/wishlist', data);
export const updateWishlistItem     = (id, data) => api.put(`/wishlist/${id}`, data);
export const deleteWishlistItem     = (id)       => api.delete(`/wishlist/${id}`);
export const voteWishlistItem       = (id)       => api.patch(`/wishlist/${id}/vote`);
export const markBoughtWishlistItem = (id)       => api.patch(`/wishlist/${id}/bought`);

export default api;
