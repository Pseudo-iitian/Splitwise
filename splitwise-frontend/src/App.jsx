import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import Login       from './pages/Login';
import Register    from './pages/Register';
import Dashboard   from './pages/Dashboard';
import GroupDetail from './pages/GroupDetail';
import AddExpense  from './pages/AddExpense';
import JoinGroup   from './pages/JoinGroup';
import EditExpense from './pages/EditExpense';
import SettleUp    from './pages/SettleUp';
import Wishlist    from './pages/Wishlist';
import Profile     from './pages/Profile';
import VideoRoom   from './pages/VideoRoom';

function PrivateRoute({ children }) {
  const { isLoggedIn } = useSelector(state => state.auth);
  return isLoggedIn ? children : <Navigate to="/login" />;
}

export default function App() {

  // 🔥 Keep Vercel backend warm
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetch(`${import.meta.env.VITE_BACKEND_URL}/ping`)
          .catch(() => {}); // silent fail (important)
      }
    }, 30000); // every 30 sec

    return () => clearInterval(interval); // cleanup
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/join/:token" element={<JoinGroup />} />
        <Route path="/wishlist" element={<Wishlist />} />

        <Route path="/" element={
          <PrivateRoute><Dashboard /></PrivateRoute>
        }/>

        <Route path="/group/:id" element={
          <PrivateRoute><GroupDetail /></PrivateRoute>
        }/>

        <Route path="/group/:id/add-expense" element={
          <PrivateRoute><AddExpense /></PrivateRoute>
        }/>

        <Route path="/group/:groupId/edit-expense/:expenseId" element={
          <PrivateRoute><EditExpense /></PrivateRoute>
        }/>

        <Route path="/group/:groupId/settle-up" element={
          <PrivateRoute><SettleUp /></PrivateRoute>
        }/>

        <Route path="/group/:groupId/video" element={
          <PrivateRoute><VideoRoom /></PrivateRoute>
        }/>

        <Route path="/profile" element={
          <PrivateRoute><Profile /></PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}