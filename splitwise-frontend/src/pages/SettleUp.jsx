import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getSettlementSummary, settleUp } from '../services/api';
import toast, { Toaster } from 'react-hot-toast';
import {
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiCheckCircle,
  FiMoreHorizontal
} from 'react-icons/fi';

export default function SettleUp() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector(state => state.auth);

  const [summary, setSummary] = useState({
    members: [],
    suggestions: [],
    userDebts: [],
    settlements: []
  });
  const [step, setStep] = useState('overview');
  const [paidBy, setPaidBy] = useState(null);
  const [paidTo, setPaidTo] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      const res = await getSettlementSummary(groupId);
      setSummary({
        members: res.data.members || [],
        suggestions: res.data.suggestions || [],
        userDebts: res.data.userDebts || [],
        settlements: res.data.settlements || []
      });
    } catch {
      toast.error('Failed to load balances');
    } finally {
      setFetching(false);
    }
  };

  const resetForm = () => {
    setPaidBy(null);
    setPaidTo(null);
    setAmount('');
    setStep('overview');
  };

  const chooseDebt = (debt) => {
    setPaidBy({
      id: user.id,
      name: user.name,
      email: user.email
    });
    setPaidTo(debt);
    setAmount(debt.amount.toFixed(2));
    setStep('amount');
  };

  const handleSettle = async () => {
    const paymentAmount = parseFloat(amount);
    if (!paidBy || !paidTo) {
      toast.error('Choose who is paying whom');
      return;
    }
    if (!paymentAmount || paymentAmount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      await settleUp({
        groupId,
        paidBy: paidBy.id,
        paidTo: paidTo.id,
        amount: paymentAmount,
        note: `${paidBy.name} paid ${paidTo.name}`
      });
      toast.success('Payment recorded!');
      await fetchSummary();
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const getInitial = (name) => name?.[0]?.toUpperCase() || '?';
  const avatarColors = ['bg-red-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
  const getColor = (name = '') => avatarColors[(name.charCodeAt(0) || 0) % avatarColors.length];
  const sortedMembers = [...summary.members].sort((a, b) => a.amount - b.amount);
  const myBalance = summary.members.find(member => member.id === user?.id);

  const goBack = () => {
    if (step === 'overview') navigate('/group/' + groupId);
    else if (step === 'receiver') setStep('payer');
    else if (step === 'amount') setStep('receiver');
    else if (step === 'confirm') setStep('overview');
    else setStep('overview');
  };

  const selectReceiver = (member) => {
    setPaidTo(member);
    const suggestedAmount = Math.min(
      Math.abs(paidBy?.amount || 0),
      Math.max(member.amount || 0, 0)
    );
    setAmount(suggestedAmount > 0 ? suggestedAmount.toFixed(2) : '');
    setStep('amount');
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

      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={goBack} className="text-gray-400 hover:text-white transition">
          <FiArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-lg">
          {step === 'overview' && 'Settle up'}
          {step === 'payer' && 'Who is paying?'}
          {step === 'receiver' && 'Who is getting paid?'}
          {step === 'amount' && 'Record a payment'}
          {step === 'confirm' && 'Confirm payment'}
        </h1>
      </div>

      {step === 'overview' && (
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
          {summary.userDebts.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
              <FiCheckCircle className="mx-auto mb-3 text-emerald-400" size={32} />
              <p className="text-lg font-semibold">{user?.name || 'You'} is settled up</p>
              <p className="text-sm text-gray-500 mt-1">No payment is pending from your side.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {summary.userDebts.map(debt => (
                <button
                  key={debt.id}
                  onClick={() => chooseDebt(debt)}
                  className="w-full bg-gray-900 border border-gray-800 hover:border-emerald-500 rounded-2xl p-4 transition text-left flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${getColor(debt.name)}`}>
                      {getInitial(debt.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{debt.name}</p>
                      <p className="text-xs text-gray-500 truncate">{debt.email}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-red-300 uppercase tracking-wide">you owe</p>
                    <p className="text-red-400 font-bold text-lg">₹{debt.amount.toFixed(2)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {myBalance && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Your total balance</p>
                <p className="font-medium">{user?.name}</p>
              </div>
              {Math.abs(myBalance.amount) < 0.01 ? (
                <span className="text-gray-400 text-sm flex items-center gap-1">
                  <FiCheck size={13} /> settled up
                </span>
              ) : myBalance.amount < 0 ? (
                <span className="text-red-400 font-semibold">borrowes ₹{Math.abs(myBalance.amount).toFixed(2)}</span>
              ) : (
                <span className="text-emerald-400 font-semibold">gets ₹{myBalance.amount.toFixed(2)}</span>
              )}
            </div>
          )}

          <button
            onClick={() => setStep('payer')}
            className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-semibold transition"
          >
            <FiMoreHorizontal /> More options
          </button>
        </div>
      )}

      {step === 'payer' && (
        <MemberList
          members={sortedMembers}
          userId={user?.id}
          getColor={getColor}
          getInitial={getInitial}
          onSelect={(member) => {
            setPaidBy(member);
            setStep('receiver');
          }}
        />
      )}

      {step === 'receiver' && (
        <MemberList
          members={summary.members}
          userId={user?.id}
          getColor={getColor}
          getInitial={getInitial}
          disabledIds={[paidBy?.id]}
          onSelect={selectReceiver}
        />
      )}

      {step === 'amount' && (
        <div className="max-w-lg mx-auto px-6 py-8">
          <PaymentPreview paidBy={paidBy} paidTo={paidTo} getColor={getColor} getInitial={getInitial} />
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 border border-gray-600 rounded-xl flex items-center justify-center text-xl">₹</div>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="text-4xl font-bold bg-transparent text-white border-b-2 border-emerald-500 outline-none w-44 text-center"
              placeholder="0.00"
              autoFocus
            />
          </div>
          <button
            onClick={() => setStep('confirm')}
            disabled={!amount || parseFloat(amount) <= 0}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-4 rounded-2xl transition text-lg"
          >
            Next
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="max-w-lg mx-auto px-6 py-8">
          <PaymentPreview paidBy={paidBy} paidTo={paidTo} getColor={getColor} getInitial={getInitial} />
          <p className="text-center text-white text-lg mb-1">
            {paidBy?.name} paid <span className="font-bold">{paidTo?.name}</span>
          </p>
          <p className="text-center text-gray-400 text-sm mb-6">{paidTo?.email}</p>
          <div className="text-center mb-8">
            <span className="text-5xl font-bold">₹{parseFloat(amount || 0).toFixed(2)}</span>
          </div>
          <button
            onClick={handleSettle}
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-4 rounded-2xl transition text-lg"
          >
            {loading ? 'Recording...' : 'Record payment'}
          </button>
        </div>
      )}
    </div>
  );
}

function MemberList({ members, userId, getColor, getInitial, disabledIds = [], onSelect }) {
  return (
    <div className="max-w-lg mx-auto">
      {members.map(member => {
        const disabled = disabledIds.includes(member.id);

        return (
          <button
            key={member.id}
            onClick={() => !disabled && onSelect(member)}
            disabled={disabled}
            className={`w-full flex items-center gap-4 px-6 py-4 border-b border-gray-800 transition text-left ${
              disabled ? 'opacity-40 cursor-not-allowed bg-gray-900/40' : 'hover:bg-gray-900 cursor-pointer'
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${getColor(member.name)}`}>
              {getInitial(member.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {member.name}
                {member.id === userId && <span className="text-gray-400 text-sm ml-1">(you)</span>}
              </p>
              <p className="text-xs text-gray-500 truncate">{member.email}</p>
            </div>
            {disabled ? (
              <span className="text-gray-500 text-sm">same person</span>
            ) : (
              <>
                {member.amount < -0.01 && <span className="text-red-400 text-sm">borrowes ₹{Math.abs(member.amount).toFixed(2)}</span>}
                {member.amount > 0.01 && <span className="text-emerald-400 text-sm">gets ₹{member.amount.toFixed(2)}</span>}
                {Math.abs(member.amount) < 0.01 && <span className="text-gray-500 text-sm">settled</span>}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PaymentPreview({ paidBy, paidTo, getColor, getInitial }) {
  return (
    <div className="flex items-center justify-center gap-6 mb-8">
      <div className="text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl mx-auto mb-2 ${getColor(paidBy?.name)}`}>
          {getInitial(paidBy?.name)}
        </div>
        <p className="text-sm text-gray-400 max-w-28 truncate">{paidBy?.name}</p>
      </div>
      <FiArrowRight size={24} className="text-gray-400" />
      <div className="text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl mx-auto mb-2 ${getColor(paidTo?.name)}`}>
          {getInitial(paidTo?.name)}
        </div>
        <p className="text-sm text-gray-400 max-w-28 truncate">{paidTo?.name}</p>
      </div>
    </div>
  );
}
