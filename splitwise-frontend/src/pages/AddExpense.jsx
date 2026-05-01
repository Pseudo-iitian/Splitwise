import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { addExpense, getGroups } from '../services/api';
import toast, { Toaster } from 'react-hot-toast';
import { FiArrowLeft, FiDollarSign } from 'react-icons/fi';

export default function AddExpense() {
  const { id: groupId } = useParams();
  const navigate        = useNavigate();
  const [group, setGroup]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    description: '',
    amount:      '',
    splitType:   'equal',
    members:     [],
    splits:      [],
  });

  useEffect(() => { fetchGroup(); }, []);

  const fetchGroup = async () => {
    try {
      const res = await getGroups();
      const found = res.data.find(g => g._id === groupId);
      setGroup(found);
      // Default: select all members
      if (found) {
        setForm(f => ({
          ...f,
          members: found.members.map(m => m._id || m),
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
    setLoading(true);
    try {
      await addExpense({
        description: form.description,
        amount:      parseFloat(form.amount),
        groupId,
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Toaster />

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(`/group/${groupId}`)}
          className="text-gray-400 hover:text-white transition"
        >
          <FiArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-bold text-lg">Add Expense</h1>
          <p className="text-gray-400 text-sm">{group?.name}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-8">
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

          {/* Members */}
          {group && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Split Between
              </label>
              <div className="space-y-2">
                {group.members.map(member => {
                  const memberId = member._id || member;
                  const name     = member.name || 'Member';
                  const email    = member.email || '';
                  const selected = form.members.includes(memberId);
                  return (
                    <div
                      key={memberId}
                      onClick={() => toggleMember(memberId)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                        selected
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-gray-700 bg-gray-900 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                          {name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{name}</p>
                          <p className="text-xs text-gray-400">{email}</p>
                        </div>
                      </div>
                      {selected && form.splitType === 'equal' && form.amount && (
                        <span className="text-emerald-400 text-sm font-medium">
                          ₹{perPersonAmount()}
                        </span>
                      )}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600'
                      }`}>
                        {selected && <span className="text-white text-xs">✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary Box */}
          {form.amount && form.members.length > 0 && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-1">Split Summary</p>
              <p className="text-white font-medium">
                ₹{form.amount} split equally among {form.members.length} people
              </p>
              <p className="text-emerald-400 text-sm mt-1">
                ₹{perPersonAmount()} per person
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