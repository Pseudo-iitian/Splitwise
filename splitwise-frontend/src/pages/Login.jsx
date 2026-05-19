import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { forgotPassword, login, resetPassword } from '../services/api';
import { setAuth } from '../store/authSlice';
import toast, { Toaster } from 'react-hot-toast';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import useSEO from '../hooks/useSEO';

export default function Login() {
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetForm, setResetForm] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  useSEO('Sign In', 'Sign in to SplitKaro – the free expense splitting app. Split bills with friends, track group expenses and settle debts easily.');

  const mode = searchParams.get('mode') === 'reset'
    ? 'reset'
    : searchParams.get('mode') === 'forgot'
      ? 'forgot'
      : 'login';
  const resetToken = searchParams.get('token') || '';
  const redirectPath = searchParams.get('redirect') || '/';

  const setMode = (nextMode) => {
    if (nextMode === 'login') {
      setSearchParams({});
      return;
    }

    if (nextMode === 'forgot') {
      setSearchParams({ mode: 'forgot' });
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(loginForm);
      dispatch(setAuth(res.data));
      toast.success('Welcome back!');
      navigate(redirectPath);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await forgotPassword({ email: forgotEmail });
      toast.success(res.data.msg);
      setMode('login');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Unable to send reset link');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();

    if (!resetToken) {
      toast.error('Reset token missing from the link');
      return;
    }

    if (resetForm.password !== resetForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword({ token: resetToken, password: resetForm.password });
      toast.success(res.data.msg);
      setResetForm({ password: '', confirmPassword: '' });
      setSearchParams({});
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'reset'
    ? 'Reset Password'
    : mode === 'forgot'
      ? 'Forgot Password'
      : 'Splitwise';
  const subtitle = mode === 'reset'
    ? 'Choose a new password for your account'
    : mode === 'forgot'
      ? 'We will send a reset link to your email'
      : 'Sign in to your account';

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-8">
      <Toaster />
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">S</span>
          </div>
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          <p className="text-gray-400 mt-1">{subtitle}</p>
        </div>

        {/* Form */}
        <div className="bg-gray-900 rounded-2xl p-5 sm:p-8 border border-gray-800">
          {mode === 'login' && (
            <>
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={loginForm.email}
                    onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-sm text-emerald-400 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginForm.password}
                      onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 pr-12 focus:outline-none focus:border-emerald-500 transition"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowLoginPassword(prev => !prev)}
                      className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-gray-700/80 text-gray-200 hover:bg-gray-600 hover:text-white transition"
                    >
                      {showLoginPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
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
            </>
          )}

          {mode === 'forgot' && (
            <>
              <form onSubmit={handleForgotSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
                >
                  {loading ? 'Sending link...' : 'Send Reset Link'}
                </button>
              </form>

              <p className="text-center text-gray-400 mt-6 text-sm">
                Remembered your password?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-emerald-400 hover:underline font-medium"
                >
                  Back to Sign In
                </button>
              </p>
            </>
          )}

          {mode === 'reset' && (
            <>
              <form onSubmit={handleResetSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={resetForm.password}
                      onChange={e => setResetForm({ ...resetForm, password: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 pr-12 focus:outline-none focus:border-emerald-500 transition"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowResetPassword(prev => !prev)}
                      className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-gray-700/80 text-gray-200 hover:bg-gray-600 hover:text-white transition"
                    >
                      {showResetPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showResetConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={resetForm.confirmPassword}
                      onChange={e => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 pr-12 focus:outline-none focus:border-emerald-500 transition"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      aria-label={showResetConfirmPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowResetConfirmPassword(prev => !prev)}
                      className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-gray-700/80 text-gray-200 hover:bg-gray-600 hover:text-white transition"
                    >
                      {showResetConfirmPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
                >
                  {loading ? 'Updating password...' : 'Reset Password'}
                </button>
              </form>

              <p className="text-center text-gray-400 mt-6 text-sm">
                Want to sign in instead?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-emerald-400 hover:underline font-medium"
                >
                  Back to Sign In
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
