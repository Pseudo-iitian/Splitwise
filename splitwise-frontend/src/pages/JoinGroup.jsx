import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { joinGroup } from '../services/api';
import toast, { Toaster } from 'react-hot-toast';

export default function JoinGroup() {
  const { token }     = useParams();
  const navigate      = useNavigate();
  const { isLoggedIn } = useSelector(state => state.auth);
  const [status, setStatus] = useState('joining'); // joining | success | error

  useEffect(() => {
    if (!isLoggedIn) {
      // Login ke baad wapas aane ke liye token save karo
      localStorage.setItem('pendingJoinToken', token);
      navigate('/login');
      return;
    }
    handleJoin();
  }, []);

  const handleJoin = async () => {
    try {
      const res = await joinGroup(token);
      setStatus('success');
      toast.success('Joined group successfully!');
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setStatus('error');
      toast.error(err.response?.data?.msg || 'Failed to join group');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <Toaster />
      <div className="text-center">
        {status === 'joining' && (
          <>
            <div className="text-5xl mb-4 animate-pulse">🔗</div>
            <h2 className="text-white text-xl font-bold">Joining group...</h2>
            <p className="text-gray-400 mt-2">Please wait</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-white text-xl font-bold">Joined Successfully!</h2>
            <p className="text-gray-400 mt-2">Redirecting to dashboard...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-white text-xl font-bold">Invalid Link</h2>
            <p className="text-gray-400 mt-2">This invite link is invalid or expired</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl transition"
            >
              Go Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}