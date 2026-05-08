import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGroups, getExpenses, updateExpense, settleUp, getSettlements, deleteSettlement } from '../services/api';
import { useSelector } from 'react-redux';
import toast, { Toaster } from 'react-hot-toast';
import { FiArrowLeft, FiDollarSign } from 'react-icons/fi';

export default function EditExpense() {
  const { groupId, expenseId } = useParams();
  const navigate               = useNavigate();
  const { user }               = useSelector(state => state.auth);

  const [group,   setGroup]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [originalExpense, setOriginalExpense] = useState(null);
  const [markedAsPaid, setMarkedAsPaid] = useState(new Set());
  const [markedAsUnpaid, setMarkedAsUnpaid] = useState(new Set());

  const [form, setForm] = useState({
    description: '',
    amount:      '',
    splitType:   'equal',
    paidBy:      '',
    paidByMultiple: [],
    members:     [],
    splits:      [],
  });
  const [isMultiPayer, setIsMultiPayer] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      // Group aur expenses dono fetch karo
      const [groupRes, expenseRes] = await Promise.all([
        getGroups(),
        getExpenses(groupId)
      ]);

      // Group find karo
      const foundGroup = groupRes.data.find(g => g._id === groupId);
      setGroup(foundGroup);

      // Expense find karo
      const foundExpense = expenseRes.data.find(e => e._id === expenseId);
      if (!foundExpense) {
        toast.error('Expense not found');
        navigate(`/group/${groupId}`);
        return;
      }

      setOriginalExpense(foundExpense);

      // Form mein expense data bharo
      // Jo members pehle selected the unki IDs
      const selectedMemberIds = foundExpense.splits.map(s => s.user?._id || s.user);

      const hasMultiplePayers = foundExpense.paidByMultiple && foundExpense.paidByMultiple.length > 0;
      setIsMultiPayer(hasMultiplePayers);

      setForm({
        description: foundExpense.description,
        amount:      foundExpense.amount.toString(),
        splitType:   foundExpense.splitType || 'equal',
        paidBy:      foundExpense.paidBy?._id || foundExpense.paidBy,
        paidByMultiple: hasMultiplePayers ? foundExpense.paidByMultiple.map(p => ({
          user: p.user?._id || p.user,
          amount: p.amount
        })) : [],
        members:     selectedMemberIds,
        splits:      [],
      });

    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setFetching(false);
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
    if (isMultiPayer) {
      const valid = form.paidByMultiple.filter(p => p.amount > 0);
      if (valid.length === 0) return 'Multiple people';
      const firstPerson = group?.members?.find(m => (m._id || m) === valid[0].user);
      if (valid.length === 1) return firstPerson?.name || 'Someone';
      return `${firstPerson?.name || 'Someone'} and ${valid.length - 1} other${valid.length > 2 ? 's' : ''}`;
    }
    const m = group?.members?.find(m => (m._id || m) === form.paidBy);
    return m?.name || 'Someone';
  };

  const handlePayerAmountChange = (userId, value) => {
    const val = parseFloat(value) || 0;
    setForm(f => {
      const exists = f.paidByMultiple.find(p => p.user === userId);
      let updated;
      if (exists) {
        updated = f.paidByMultiple.map(p => p.user === userId ? { ...p, amount: val } : p);
      } else {
        updated = [...f.paidByMultiple, { user: userId, amount: val }];
      }
      return { ...f, paidByMultiple: updated };
    });
  };

  const handleToggleMarkPaid = (e, memberId, isOriginallySettled) => {
    e.stopPropagation(); // prevent toggleMember
    
    if (isOriginallySettled) {
      // Toggle unpaid
      setMarkedAsUnpaid(prev => {
        const newSet = new Set(prev);
        if (newSet.has(memberId)) newSet.delete(memberId);
        else newSet.add(memberId);
        return newSet;
      });
    } else {
      // Toggle paid
      setMarkedAsPaid(prev => {
        const newSet = new Set(prev);
        if (newSet.has(memberId)) newSet.delete(memberId);
        else newSet.add(memberId);
        return newSet;
      });
    }
  };

  const isAlreadyPaidError = (err) => {
    const message = err.response?.data?.msg || err.response?.data?.error || '';
    return err.response?.status === 409 && /already .*paid|already recorded|already marked as paid/i.test(message);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description || !form.amount) {
      toast.error('Please fill all fields');
      return;
    }
    if (!isMultiPayer && !form.paidBy) {
      toast.error('Please select who paid');
      return;
    }
    if (form.members.length === 0) {
      toast.error('Select at least one member to split');
      return;
    }

    let finalPaidByMultiple = [];
    if (isMultiPayer) {
      const validPayers = form.paidByMultiple.filter(p => p.amount > 0);
      if (validPayers.length === 0) {
        toast.error('Please enter how much each person paid');
        return;
      }
      const sum = validPayers.reduce((acc, p) => acc + p.amount, 0);
      if (Math.abs(sum - parseFloat(form.amount)) > 0.01) {
        toast.error(`Total paid (₹${sum.toFixed(2)}) must equal total cost (₹${form.amount})`);
        return;
      }
      finalPaidByMultiple = validPayers;
    }

    setLoading(true);
    try {
      const res = await updateExpense(expenseId, {
        description: form.description,
        amount:      parseFloat(form.amount),
        paidBy:      !isMultiPayer ? form.paidBy : undefined,
        paidByMultiple: isMultiPayer ? finalPaidByMultiple : undefined,
        splitType:   form.splitType,
        members:     form.members,
        splits:      form.splits,
      });
      
      const updatedExpense = res.data;

      // Handle members marked as paid
      if (markedAsPaid.size > 0) {
        const promises = [];
        for (const memberId of markedAsPaid) {
          const split = updatedExpense.splits.find(s => (s.user?._id || s.user) === memberId);
          if (split && split.amount > 0 && form.paidBy !== memberId) {
            promises.push(
              settleUp({
                groupId,
                paidBy: memberId,
                paidTo: form.paidBy,
                amount: split.amount,
                relatedExpenses: [expenseId],
                isExpenseUpdate: true
              }).catch(err => {
                if (isAlreadyPaidError(err)) return null;
                throw err;
              })
            );
          }
        }
        if (promises.length > 0) {
          await Promise.all(promises);
        }
      }
      // Handle members marked as UNPAID
      if (markedAsUnpaid.size > 0) {
        const { data: allSettlements } = await getSettlements(groupId);
        const promises = [];
        for (const memberId of markedAsUnpaid) {
          const settlementsToDelete = allSettlements.filter(s => {
            const payerId = s.paidBy?._id || s.paidBy;
            // Check relatedExpenses (array) — new format
            const inRelatedExpenses = (s.relatedExpenses || []).some(
              re => (re?._id || re) === expenseId
            );
            // Check relatedExpense (singular) — legacy format
            const inRelatedExpense = (s.relatedExpense?._id || s.relatedExpense) === expenseId;
            return payerId === memberId && (inRelatedExpenses || inRelatedExpense);
          });
          for (const s of settlementsToDelete) {
            promises.push(deleteSettlement(s._id));
          }
        }
        if (promises.length > 0) {
          await Promise.all(promises);
        }
      }

      toast.success('Expense updated!');
      navigate(`/group/${groupId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

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
          <h1 className="font-bold text-lg">Edit Expense</h1>
          <p className="text-gray-400 text-sm truncate">{group?.name}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
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
            <label className="block text-sm font-medium text-gray-300 mb-2">Amount (₹)</label>
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">
                  Paid By
                </label>
                <button
                  type="button"
                  onClick={() => setIsMultiPayer(!isMultiPayer)}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 transition"
                >
                  {isMultiPayer ? 'Single person' : 'Multiple people'}
                </button>
              </div>

              {!isMultiPayer ? (
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
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                          selected ? 'border-blue-500 bg-blue-500' : 'border-gray-600'
                        }`}>
                          {selected && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {group.members.map(member => {
                    const memberId = member._id || member;
                    const name     = member.name  || 'Member';
                    const isMe     = memberId === user?.id;
                    const payerObj = form.paidByMultiple.find(p => p.user === memberId);
                    const amount   = payerObj?.amount || '';

                    return (
                      <div key={memberId} className="flex items-center gap-3 p-3 rounded-xl border border-gray-700 bg-gray-900">
                         <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-gray-800 text-gray-400 shrink-0">
                            {name[0]?.toUpperCase()}
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {name}{isMe && <span className="text-xs text-gray-400 ml-1">(you)</span>}
                            </p>
                         </div>
                         <div className="w-24 shrink-0 relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={amount}
                              onChange={(e) => handlePayerAmountChange(memberId, e.target.value)}
                              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg pl-6 pr-2 py-1.5 focus:outline-none focus:border-blue-500 transition text-sm"
                              placeholder="0.00"
                            />
                         </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-between items-center px-2 pt-2 text-sm">
                    <span className="text-gray-400">Total Paid:</span>
                    <span className={`font-semibold ${
                      Math.abs(form.paidByMultiple.reduce((a, b) => a + (b.amount || 0), 0) - parseFloat(form.amount || 0)) < 0.01 
                      ? 'text-emerald-400' 
                      : 'text-red-400'
                    }`}>
                      ₹{form.paidByMultiple.reduce((a, b) => a + (b.amount || 0), 0).toFixed(2)}
                      {' / '}
                      ₹{parseFloat(form.amount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Split Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Split Type</label>
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

          {/* Split Between — SAARE GROUP MEMBERS DIKHENGE */}
          {group && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Split Between
              </label>
              <p className="text-xs text-gray-500 mb-3">
                ✅ = pehle se selected &nbsp;|&nbsp; ⬜ = baad mein join hua (select karo add karne ke liye)
              </p>
              <div className="space-y-2">
                {group.members.map(member => {
                  const memberId = member._id || member;
                  const name     = member.name  || 'Member';
                  const email    = member.email || '';
                  const selected = form.members.includes(memberId);
                  const isNew    = !selected; // baad mein join hua
                  
                  const originalSplit = originalExpense?.splits?.find(s => (s.user?._id || s.user) === memberId);
                  
                  // Primary payer validation for toggles
                  let isPrimaryPayer = false;
                  if (isMultiPayer && form.paidByMultiple.length > 0) {
                     isPrimaryPayer = form.paidByMultiple[0].user === memberId;
                  } else {
                     isPrimaryPayer = form.paidBy === memberId;
                  }

                  return (
                    <div
                      key={memberId}
                      onClick={() => toggleMember(memberId)}
                      className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        selected
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-gray-700 bg-gray-900 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                          selected ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-400'
                        } shrink-0`}>
                          {name[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-medium truncate">{name}</p>
                            {isNew && (
                              <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full shrink-0">
                                new member
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {selected && (
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-400 text-sm font-medium">
                              ₹{originalSplit ? originalSplit.amount : perPersonAmount()}
                            </span>
                            
                            {!isPrimaryPayer && (
                              originalSplit?.settled ? (
                                markedAsUnpaid.has(memberId) ? (
                                  <button
                                    type="button"
                                    onClick={(e) => handleToggleMarkPaid(e, memberId, true)}
                                    className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-lg text-xs font-medium transition"
                                  >
                                    Mark as Paid
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => handleToggleMarkPaid(e, memberId, true)}
                                    className="bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-lg text-xs font-medium transition"
                                  >
                                    Paid
                                  </button>
                                )
                              ) : markedAsPaid.has(memberId) ? (
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleMarkPaid(e, memberId, false)}
                                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded-lg text-xs font-medium transition"
                                >
                                  Marked as Paid
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleMarkPaid(e, memberId, false)}
                                  className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-lg text-xs font-medium transition"
                                >
                                  Mark as Paid
                                </button>
                              )
                            )}
                          </div>
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
              <p className="text-sm text-gray-400 font-medium">Updated Summary</p>
              {(form.paidBy || isMultiPayer) && (
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

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => navigate(`/group/${groupId}`)}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
            >
              {loading ? 'Saving...' : 'Update Expense'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
