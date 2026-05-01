import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getExpenses, getBalances, generateInvite, deleteExpense } from '../services/api';
import toast, { Toaster } from 'react-hot-toast';
import { FiArrowLeft, FiPlus, FiUsers, FiShare2, FiCopy, FiEdit2, FiTrash2 } from 'react-icons/fi';

export default function GroupDetail() {
  const { id: groupId } = useParams();
  const navigate = useNavigate();

  const [expenses,    setExpenses]    = useState([]);
  const [balances,    setBalances]    = useState({});
  const [activeTab,   setActiveTab]   = useState('expenses');
  const [loading,     setLoading]     = useState(true);
  const [inviteLink,  setInviteLink]  = useState('');
  const [showInvite,  setShowInvite]  = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [expRes, balRes] = await Promise.all([
        getExpenses(groupId),
        getBalances(groupId),
      ]);
      setExpenses(expRes.data);
      setBalances(balRes.data);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    try {
      const res = await generateInvite(groupId);
      setInviteLink(res.data.inviteLink);
      setShowInvite(true);
    } catch {
      toast.error('Failed to generate invite link');
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success('Link copied!');
  };

  const handleDeleteExpense = async () => {
    if (!deleteModal) return;
    try {
      await deleteExpense(deleteModal._id);
      toast.success('Expense deleted!');
      setDeleteModal(null);
      fetchAll();
    } catch {
      toast.error('Failed to delete expense');
    }
  };

  const shareOnWhatsApp = () => {
    const msg = 'Hey! Join my group on Splitwise Clone!\nClick here to join: ' + inviteLink;
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Toaster />

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition">
            <FiArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-bold text-lg">Group Detail</h1>
            <p className="text-gray-400 text-sm">{expenses.length} expenses</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInvite}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
          >
            <FiShare2 size={14} /> Invite
          </button>
          <Link
            to={`/group/${groupId}/add-expense`}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
          >
            <FiPlus /> Add Expense
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 px-6">
        {['expenses', 'balances'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 px-4 text-sm font-medium capitalize border-b-2 transition ${
              activeTab === tab
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6">
        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading...</div>
        ) : activeTab === 'expenses' ? (

          <div className="space-y-3">
            {expenses.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">💸</div>
                <p className="text-gray-400">No expenses yet</p>
                <Link
                  to={`/group/${groupId}/add-expense`}
                  className="inline-block mt-4 text-emerald-400 hover:underline text-sm"
                >
                  Add first expense
                </Link>
              </div>
            ) : (
              expenses.map(exp => (
                <div key={exp._id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">

                  {/* Top row */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{exp.description}</h3>
                      <p className="text-gray-400 text-sm mt-0.5">
                        Paid by {exp.paidBy?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold text-lg">
                        ₹{exp.amount}
                      </span>
                      <button
                        onClick={() => navigate('/group/' + groupId + '/edit-expense/' + exp._id)}
                        className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
                        title="Edit"
                      >
                        <FiEdit2 size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteModal(exp)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                        title="Delete"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Splits */}
                  <div className="flex flex-wrap gap-2">
                    {exp.splits?.map(split => (
                      <span
                        key={split._id}
                        className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full"
                      >
                        {split.user?.name}: ₹{split.amount}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {new Date(exp.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
              ))
            )}
          </div>

        ) : (

          <div className="space-y-3">
            {Object.keys(balances).length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">✅</div>
                <p className="text-gray-400">All settled up!</p>
              </div>
            ) : (
              Object.entries(balances).map(([userId, amount]) => (
                <div
                  key={userId}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                      <FiUsers className="text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-400 font-mono">{userId.slice(-6)}</p>
                  </div>
                  <span className={`font-bold text-lg ${amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {amount >= 0 ? '+' : ''}₹{Math.abs(amount).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>

        )}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiShare2 className="text-emerald-400" size={24} />
              </div>
              <h2 className="text-xl font-bold">Invite Friends</h2>
              <p className="text-gray-400 text-sm mt-2">
                Share this link to invite people to your group
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 mb-4 text-sm text-gray-300 leading-relaxed">
              Hey! Join my group on Splitwise Clone 🎉
              <br />
              Click the link below to join:
              <br />
              <span className="text-emerald-400 break-all">{inviteLink}</span>
            </div>
            <button
              onClick={copyLink}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-semibold transition mb-3"
            >
              <FiCopy /> Copy Invite Link
            </button>
            <button
              onClick={shareOnWhatsApp}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition mb-3"
            >
              📱 Share on WhatsApp
            </button>
            <button
              onClick={() => setShowInvite(false)}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Delete Expense Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiTrash2 className="text-red-400" size={24} />
              </div>
              <h2 className="text-xl font-bold">Delete Expense?</h2>
              <p className="text-gray-400 text-sm mt-2">
                Delete{' '}
                <span className="text-white font-medium">"{deleteModal.description}"</span>?
                This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteExpense}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-semibold transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}