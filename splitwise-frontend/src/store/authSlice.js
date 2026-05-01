import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: localStorage.getItem('token') || null,
    user:  JSON.parse(localStorage.getItem('user')) || null,
    isLoggedIn: !!localStorage.getItem('token'),
  },
  reducers: {
    setAuth: (state, action) => {
      state.token      = action.payload.token;
      state.user       = action.payload.user;
      state.isLoggedIn = true;
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('user', JSON.stringify(action.payload.user));
    },
    logout: (state) => {
      state.token      = null;
      state.user       = null;
      state.isLoggedIn = false;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
});

export const { setAuth, logout } = authSlice.actions;
export default authSlice.reducer;