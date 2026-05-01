import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { addExpense, getGroups } from '../services/api';
import { useSelector } from 'react-redux';
import toast, { Toaster } from 'react-hot-toast';
import { FiArrowLeft, FiDollarSign } from 'react-icons/fi';

export default function AddExpense() {
  const { id: groupId } = useParams();
  const navigate        = useNavigate();
  const { user }        = useSelector(state => state.auth);
  const [group, setGroup]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    description: '',
    amount:      '',
    splitType:   'equal',
    paidBy:      '',
    members:     [],
    splits:      [],
  });

  useEffect(() => { fetchGroup(); }, []);

  const fetchGroup = async () => {
    try {
      const res   = await getGroups();
      const found = res.data.find(g => g._id === groupId);
      setGroup(found);
      if (found) {
        setForm(f => ({
          ...f,
          members: found.members.map(m => m._id || m),
          paidBy:  user?.id || '',
        }));
      }
    } catch {
      toast.error('Failed to load group');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description || !form.amount) {
      toast.error('Please fill all fields');
      return;
    }
    if (!form.paidBy) {
      toast.error('Please select who paid');
      return;
    }
    setLoading(true);
    try {
      await addExpense({
        description: form.description,
        amount:      parseFloat(form.amount),
        groupId,
        paidBy:      form.paidBy,
        splitType:   form.splitType,
        members:     form.members,
        splits:      form.splits,
      });
      toast.success('Expense added!');
      navigate(`/group/${groupId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (memberId) => {
    setForm(f => ({
      ...f,
      members: f.members.includes(memberId)
        ? f.members.filter(id => id !== memberId)
        : [...f.members, memberId],
    }));
  };

  const perPersonAmount = () => {
    if (!form.amount || form.members.length === 0) return 0;
    return (parseFloat(form.amount) / form.members.length).toFixed(2);
  };

  const getPaidByName = () => {
    const m = group?.members?.find(m => (m._id || m) === form.paidBy);
    return m?.name || 'Someone';
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Toaster />

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(`/group/${groupId}`)}
          className="text-gray-400 hover:text-white transition shrink-0"
        >
          <FiArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <h1 className="font-bold text-lg">Add Expense</h1>
          <p className="text-gray-400 text-sm truncate">{group?.name}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <input
              type="text"
              required
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition"
              placeholder="Hotel, Dinner, Petrol..."
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount (₹)
            </label>
            <div className="relative">
              <FiDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                required
                min="1"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-emerald-500 transition"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Paid By */}
          {group && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Paid By
              </label>
              <div className="space-y-2">
                {group.members.map(member => {
                  const memberId = member._id || member;
                  const name     = member.name  || 'Member';
                  const email    = member.email || '';
                  const isMe     = memberId === user?.id;
                  const selected = form.paidBy === memberId;

                  return (
                    <div
                      key={memberId}
                      onClick={() => setForm({ ...form, paidBy: memberId })}
                      className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        selected
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-700 bg-gray-900 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                          selected ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400'
                        } shrink-0`}>
                          {name[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {name}{isMe && <span className="text-xs text-gray-400 ml-1">(you)</span>}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{email}</p>
                        </div>
                      </div>
                      {/* Radio */}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                        selected ? 'border-blue-500 bg-blue-500' : 'border-gray-600'
                      }`}>
                        {selected && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Split Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Split Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['equal', 'percentage', 'exact'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm({ ...form, splitType: type })}
                  className={`py-2 rounded-xl text-sm font-medium capitalize transition border ${
                    form.splitType === type
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Split Between */}
          {group && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Split Between
              </label>
              <div className="space-y-2">
                {group.members.map(member => {
                  const memberId = member._id || member;
                  const name     = member.name  || 'Member';
                  const email    = member.email || '';
                  const selected = form.members.includes(memberId);

                  return (
                    <div
                      key={memberId}
                      onClick={() => toggleMember(memberId)}
                      className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        selected
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-gray-700 bg-gray-900 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                          selected ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-400'
                        } shrink-0`}>
                          {name[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{name}</p>
                          <p className="text-xs text-gray-500 truncate">{email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {selected && form.splitType === 'equal' && form.amount && (
                          <span className="text-emerald-400 text-sm font-medium">
                            ₹{perPersonAmount()}
                          </span>
                        )}
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                          selected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600'
                        }`}>
                          {selected && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary */}
          {form.amount && form.members.length > 0 && (
            <div className="bg-gray-900 border border-emerald-500/30 rounded-xl p-4 space-y-2 min-w-0">
              <p className="text-sm text-gray-400 font-medium">Summary</p>
              {form.paidBy && (
                <p className="text-white text-sm break-words">
                  💳 <span className="text-blue-400 font-medium">{getPaidByName()}</span> paid ₹{form.amount}
                </p>
              )}
              <p className="text-white text-sm break-words">
                👥 Split among{' '}
                <span className="text-emerald-400 font-medium">{form.members.length} people</span>
                {' '}— ₹{perPersonAmount()} each
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
          >
            {loading ? 'Adding...' : 'Add Expense'}
          </button>

        </form>
      </div>
    </div>
  );
}
