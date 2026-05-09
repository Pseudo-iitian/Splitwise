import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import toast, { Toaster } from 'react-hot-toast';
import { FiArrowLeft, FiEdit2, FiCheck, FiX, FiShield, FiUser, FiMail, FiCreditCard } from 'react-icons/fi';
import { updateProfile, verifyUpi } from '../services/api';
import { setUser } from '../store/authSlice';

export default function Profile() {
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const { user }  = useSelector(state => state.auth);

  const [form, setForm] = useState({
    name:  user?.name  || '',
    upiId: user?.upiId || '',
  });
  const [editingName,  setEditingName]  = useState(false);
  const [editingUpi,   setEditingUpi]   = useState(false);
  const [savingName,   setSavingName]   = useState(false);
  const [savingUpi,    setSavingUpi]    = useState(false);
  const [verifying,    setVerifying]    = useState(false);
  const [upiVerified,  setUpiVerified]  = useState(user?.upiVerified || false);
  const [upiStatus,    setUpiStatus]    = useState(user?.upiVerificationStatus || (user?.upiVerified ? 'verified' : 'none'));

  useEffect(() => {
    setForm({ name: user?.name || '', upiId: user?.upiId || '' });
    setUpiVerified(user?.upiVerified || false);
    setUpiStatus(user?.upiVerificationStatus || (user?.upiVerified ? 'verified' : 'none'));
  }, [user]);

  // ── Save Name ──────────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!form.name.trim()) { toast.error('Name cannot be empty'); return; }
    setSavingName(true);
    try {
      const res = await updateProfile({ name: form.name.trim() });
      dispatch(setUser(res.data.user));
      toast.success('Name updated! ✅');
      setEditingName(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update name');
    } finally { setSavingName(false); }
  };

  // ── Save UPI ID ────────────────────────────────────────────────────────────
  const handleSaveUpi = async () => {
    if (!form.upiId.trim()) { toast.error('Enter UPI ID'); return; }
    setSavingUpi(true);
    try {
      const res = await updateProfile({ upiId: form.upiId.trim() });
      dispatch(setUser(res.data.user));
      setUpiVerified(false);
      setUpiStatus('none');
      toast.success('UPI ID saved!');
      setEditingUpi(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save UPI ID');
    } finally { setSavingUpi(false); }
  };

  // ── Verify UPI ─────────────────────────────────────────────────────────────
  const handleVerifyUpi = async () => {
    if (!form.upiId.trim()) { toast.error('Enter UPI ID first'); return; }
    setVerifying(true);
    try {
      const res = await verifyUpi({ upiId: form.upiId.trim() });
      dispatch(setUser(res.data.user));
      setUpiVerified(false);
      if (res.data.formatValid) {
        setUpiStatus('formatOnly');
        toast.success(res.data.message || 'UPI format is valid. Full verification requires provider integration.');
      } else if (res.data.verified) {
        setUpiStatus('verified');
        setUpiVerified(true);
        toast.success(res.data.message || 'UPI ID verified! ✅');
      } else {
        setUpiStatus('none');
        toast.success(res.data.message || 'UPI check completed.');
      }
    } catch (err) {
      const errData = err.response?.data;
      toast.error(errData?.error || 'Verification failed');
      if (errData?.hint) {
        setTimeout(() => toast(errData.hint, { icon: '💡' }), 500);
      }
    } finally { setVerifying(false); }
  };

  const getInitial = (name) => name?.[0]?.toUpperCase() || '?';
  const avatarColors = ['bg-red-500','bg-blue-500','bg-purple-500','bg-orange-500','bg-pink-500','bg-teal-500','bg-emerald-500'];
  const getColor = (name = '') => avatarColors[(name.charCodeAt(0) || 0) % avatarColors.length];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Toaster />

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition shrink-0">
          <FiArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-lg">My Profile</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Avatar + basic info ─────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center font-bold text-3xl ${getColor(user?.name)}`}>
            {getInitial(user?.name)}
          </div>
          <div className="text-center">
            <p className="font-bold text-xl">{user?.name}</p>
            <p className="text-gray-400 text-sm mt-0.5">{user?.email}</p>
          </div>
        </div>

        {/* ── Name field ──────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FiUser size={14} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Display Name</p>
          </div>

          {!editingName ? (
            <div className="flex items-center justify-between">
              <p className="text-white font-medium">{user?.name}</p>
              <button
                onClick={() => setEditingName(true)}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition bg-blue-500/10 px-3 py-1.5 rounded-lg"
              >
                <FiEdit2 size={12} /> Edit
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition"
                placeholder="Your name"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingName(false); setForm(f => ({ ...f, name: user?.name || '' })); }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-xl text-sm transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-medium transition"
                >
                  {savingName ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Email field (read-only) ──────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FiMail size={14} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-white font-medium">{user?.email}</p>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">Cannot change</span>
          </div>
        </div>

        {/* ── UPI ID field ─────────────────────────────────────────── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FiCreditCard size={14} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">UPI ID</p>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full ml-auto">For payments</span>
          </div>

          {!editingUpi ? (
            <div className="space-y-3">
              {user?.upiId ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-white font-medium truncate">{user.upiId}</p>
                    {upiStatus === 'verified' ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0">
                        <FiShield size={10} /> Verified
                      </span>
                    ) : upiStatus === 'formatOnly' ? (
                      <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-full shrink-0">
                        <FiShield size={10} /> Format validated
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-full shrink-0">
                        <FiX size={10} /> Unverified
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setEditingUpi(true)}
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition bg-blue-500/10 px-3 py-1.5 rounded-lg shrink-0"
                  >
                    <FiEdit2 size={12} /> Edit
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingUpi(true)}
                  className="w-full border border-dashed border-gray-600 hover:border-emerald-500 text-gray-400 hover:text-emerald-400 py-3 rounded-xl text-sm transition"
                >
                  + Add UPI ID
                </button>
              )}

              {/* Verify button — show if UPI added but not verified */}
              {user?.upiId && upiStatus !== 'verified' && (
                <button
                  onClick={handleVerifyUpi}
                  disabled={verifying}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
                >
                  <FiShield size={14} />
                  {verifying ? 'Verifying...' : 'Verify UPI ID'}
                </button>
              )}

              {upiStatus === 'verified' && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                  <p className="text-emerald-400 text-sm">✅ Your UPI ID is verified and ready for payments!</p>
                </div>
              )}

              {upiStatus === 'formatOnly' && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
                  <p className="text-yellow-300 text-sm">
                    ⚠️ UPI format is valid, but this app does not yet support bank-level UPI confirmation.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                value={form.upiId}
                onChange={e => { setForm({ ...form, upiId: e.target.value }); setUpiVerified(false); }}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition"
                placeholder="name@gpay / 9876543210@paytm"
                autoFocus
              />
              <p className="text-xs text-gray-500">Format: <span className="text-gray-300">yourname@gpay</span> or <span className="text-gray-300">9876543210@paytm</span></p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingUpi(false); setForm(f => ({ ...f, upiId: user?.upiId || '' })); }}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-xl text-sm transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUpi}
                  disabled={savingUpi}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-medium transition"
                >
                  {savingUpi ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Info box ─────────────────────────────────────────────── */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4">
          <p className="text-xs text-blue-300 leading-relaxed">
            💡 <strong>UPI ID kya hai?</strong> Yeh tumhara payment address hai jaise <code className="bg-gray-800 px-1 rounded">name@gpay</code>. 
            Isse group members seedha tumhe payment kar sakte hain Settle Up feature se.
          </p>
        </div>

      </div>
    </div>
  );
}