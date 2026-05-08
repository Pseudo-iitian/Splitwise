import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { login } from '../services/api';
import { setAuth } from '../store/authSlice';
import toast, { Toaster } from 'react-hot-toast';
import useSEO from '../hooks/useSEO';

export default function Login() {
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  useSEO('Sign In', 'Sign in to SplitKaro – the free expense splitting app. Split bills with friends, track group expenses and settle debts easily.');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(form);
      dispatch(setAuth(res.data));
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-8">
      <Toaster />
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">S</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Splitwise</h1>
          <p className="text-gray-400 mt-1">Sign in to your account</p>
        </div>

        {/* Form */}
        <div className="bg-gray-900 rounded-2xl p-5 sm:p-8 border border-gray-800">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-gray-400 mt-6 text-sm">
            Don't have an account?{' '}
            <Link to="/register" className="text-emerald-400 hover:underline font-medium">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
