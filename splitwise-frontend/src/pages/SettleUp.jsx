import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { getSettlementSummary, settleUp } from "../services/api";
import toast, { Toaster } from "react-hot-toast";
import {
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiCheckCircle,
  FiMoreHorizontal,
} from "react-icons/fi";
import { createRazorpayOrder, verifyRazorpayPayment } from "../services/api";

export default function SettleUp() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const [summary, setSummary] = useState({
    members: [],
    suggestions: [],
    userDebts: [],
    settlements: [],
  });
  const [step, setStep] = useState("overview");
  const [paidBy, setPaidBy] = useState(null);
  const [paidTo, setPaidTo] = useState(null);
  const [amount, setAmount] = useState("");
  const [selectedExpenseIds, setSelectedExpenseIds] = useState([]);
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
        settlements: res.data.settlements || [],
      });
    } catch {
      toast.error("Failed to load balances");
    } finally {
      setFetching(false);
    }
  };

  const resetForm = () => {
    setPaidBy(null);
    setPaidTo(null);
    setAmount("");
    setSelectedExpenseIds([]);
    setStep("overview");
  };

  const chooseDebt = (debt) => {
    setPaidBy({
      id: user.id,
      name: user.name,
      email: user.email,
    });
    setPaidTo(debt);
    setAmount(debt.amount.toFixed(2));
    setSelectedExpenseIds([]);
    setStep("amount");
  };

  const handleSettle = async () => {
    const paymentAmount = parseFloat(amount);
    if (!paidBy || !paidTo) {
      toast.error("Choose who is paying whom");
      return;
    }
    if (!paymentAmount || paymentAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      await settleUp({
        groupId,
        paidBy: paidBy.id,
        paidTo: paidTo.id,
        amount: paymentAmount,
        relatedExpenses:
          selectedExpenseIds.length > 0 ? selectedExpenseIds : undefined,
        note: `${paidBy.name} paid ${paidTo.name}`,
      });
      toast.success("Payment recorded!");
      await fetchSummary();
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.msg || "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  const handleRazorpayPayment = async () => {
    const paymentAmount = parseFloat(amount);
    if (!paidBy || !paidTo || !paymentAmount || paymentAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      // 1️⃣ Order banao backend pe
      const orderRes = await createRazorpayOrder({
        amount: paymentAmount,
        groupId,
        paidTo: paidTo.id,
        relatedExpenses:
          selectedExpenseIds.length > 0 ? selectedExpenseIds : [],
      });

      const { orderId, keyId } = orderRes.data;

      // 2️⃣ Razorpay checkout open karo
      const options = {
        key: keyId,
        amount: Math.round(paymentAmount * 100),
        currency: "INR",
        name: "Splitwise",
        description: `Payment to ${paidTo.name}`,
        order_id: orderId,

        // ✅ UPI prefill
        prefill: {
          name: paidTo.name,
          email: paidTo.email,
          contact: "",
          vpa: paidTo.upiId || "", // UPI ID
        },

        // ✅ Sirf UPI dikhao
        method: {
          upi: true,
          card: false,
          netbanking: false,
          wallet: false,
        },

        theme: { color: "#10b981" },

        handler: async (response) => {
          // 3️⃣ Payment verify karo
          try {
            await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              groupId,
              paidTo: paidTo.id,
              amount: paymentAmount,
              relatedExpenses:
                selectedExpenseIds.length > 0 ? selectedExpenseIds : [],
            });
            toast.success("Payment successful! 🎉");
            await fetchSummary();
            resetForm();
          } catch {
            toast.error("Payment verification failed");
          }
        },

        modal: {
          ondismiss: () => {
            toast.error("Payment cancelled");
            setLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.msg || "Failed to initiate payment");
    } finally {
      setLoading(false);
    }
  };

  const getInitial = (name) => name?.[0]?.toUpperCase() || "?";
  const avatarColors = [
    "bg-red-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
  ];
  const getColor = (name = "") =>
    avatarColors[(name.charCodeAt(0) || 0) % avatarColors.length];
  const sortedMembers = [...summary.members].sort(
    (a, b) => a.amount - b.amount,
  );
  const myBalance = summary.members.find((member) => member.id === user?.id);

  const goBack = () => {
    if (step === "overview") navigate("/group/" + groupId);
    else if (step === "receiver") setStep("payer");
    else if (step === "amount") setStep("receiver");
    else if (step === "confirm") setStep("overview");
    else setStep("overview");
  };

  const selectReceiver = (member) => {
    setPaidTo(member);
    const suggestedAmount = Math.min(
      Math.abs(paidBy?.amount || 0),
      Math.max(member.amount || 0, 0),
    );
    setAmount(suggestedAmount > 0 ? suggestedAmount.toFixed(2) : "");
    setSelectedExpenseIds([]);
    setStep("amount");
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

      <div className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center gap-4">
        <button
          onClick={goBack}
          className="text-gray-400 hover:text-white transition shrink-0"
        >
          <FiArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-lg truncate">
          {step === "overview" && "Settle up"}
          {step === "payer" && "Who is paying?"}
          {step === "receiver" && "Who is getting paid?"}
          {step === "amount" && "Record a payment"}
          {step === "confirm" && "Confirm payment"}
        </h1>
      </div>

      {step === "overview" && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          {summary.userDebts.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-8 text-center">
              <FiCheckCircle
                className="mx-auto mb-3 text-emerald-400"
                size={32}
              />
              <p className="text-lg font-semibold">
                {user?.name || "You"} is settled up
              </p>
              <p className="text-sm text-gray-500 mt-1">
                No payment is pending from your side.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {summary.userDebts.map((debt) => (
                <button
                  key={debt.id}
                  onClick={() => chooseDebt(debt)}
                  className="w-full bg-gray-900 border border-gray-800 hover:border-emerald-500 rounded-2xl p-4 transition text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 w-full">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${getColor(debt.name)}`}
                    >
                      {getInitial(debt.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{debt.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {debt.email}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 self-end sm:self-auto">
                    <p className="text-xs text-red-300 uppercase tracking-wide">
                      you owe
                    </p>
                    <p className="text-red-400 font-bold text-lg">
                      ₹{debt.amount.toFixed(2)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {myBalance && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-400">Your total balance</p>
                <p className="font-medium truncate">{user?.name}</p>
              </div>
              {Math.abs(myBalance.amount) < 0.01 ? (
                <span className="text-gray-400 text-sm flex items-center gap-1 self-end sm:self-auto">
                  <FiCheck size={13} /> settled up
                </span>
              ) : myBalance.amount < 0 ? (
                <span className="text-red-400 font-semibold self-end sm:self-auto">
                  borrowes ₹{Math.abs(myBalance.amount).toFixed(2)}
                </span>
              ) : (
                <span className="text-emerald-400 font-semibold self-end sm:self-auto">
                  gets ₹{myBalance.amount.toFixed(2)}
                </span>
              )}
            </div>
          )}

          <button
            onClick={() => setStep("payer")}
            className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-semibold transition"
          >
            <FiMoreHorizontal /> More options
          </button>
        </div>
      )}

      {step === "payer" && (
        <MemberList
          members={sortedMembers}
          userId={user?.id}
          getColor={getColor}
          getInitial={getInitial}
          onSelect={(member) => {
            setPaidBy(member);
            setStep("receiver");
          }}
        />
      )}

      {step === "receiver" && (
        <MemberList
          members={summary.members}
          userId={user?.id}
          getColor={getColor}
          getInitial={getInitial}
          disabledIds={[paidBy?.id]}
          onSelect={selectReceiver}
        />
      )}

      {step === "amount" && (
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <PaymentPreview
            paidBy={paidBy}
            paidTo={paidTo}
            getColor={getColor}
            getInitial={getInitial}
          />
          {paidTo?.expenses?.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Related expenses
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {paidTo.expenses.map((expense) => {
                  const isSelected = selectedExpenseIds.includes(expense.id);
                  return (
                    <label
                      key={expense.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${isSelected ? "border-emerald-500 bg-emerald-500/10" : "border-gray-700 bg-gray-900 hover:bg-gray-800"}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedExpenseIds([
                              ...selectedExpenseIds,
                              expense.id,
                            ]);
                          } else {
                            setSelectedExpenseIds(
                              selectedExpenseIds.filter(
                                (id) => id !== expense.id,
                              ),
                            );
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-600 text-emerald-500 focus:ring-emerald-500 bg-gray-700"
                      />
                      <span className="text-sm font-medium">
                        {expense.description} - ₹
                        {expense.remainingAmount.toFixed(2)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 border border-gray-600 rounded-xl flex items-center justify-center text-xl">
              ₹
            </div>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-3xl sm:text-4xl font-bold bg-transparent text-white border-b-2 border-emerald-500 outline-none w-36 sm:w-44 text-center"
              placeholder="0.00"
              autoFocus
            />
          </div>
          <button
            onClick={() => setStep("confirm")}
            disabled={!amount || parseFloat(amount) <= 0}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-4 rounded-2xl transition text-lg"
          >
            Next
          </button>
        </div>
      )}

      {step === "confirm" && (
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <PaymentPreview
            paidBy={paidBy}
            paidTo={paidTo}
            getColor={getColor}
            getInitial={getInitial}
          />
          <p className="text-center text-white text-base sm:text-lg mb-1 break-words">
            {paidBy?.name} paid{" "}
            <span className="font-bold">{paidTo?.name}</span>
          </p>
          <p className="text-center text-gray-400 text-sm mb-6 break-all">
            {paidTo?.email}
          </p>
          {selectedExpenseIds.length > 0 && (
            <p className="text-center text-emerald-300 text-sm mb-6 break-words">
              For{" "}
              {paidTo?.expenses
                ?.filter((expense) => selectedExpenseIds.includes(expense.id))
                .map((e) => e.description)
                .join(", ")}
            </p>
          )}
          <div className="text-center mb-8">
            <span className="text-4xl sm:text-5xl font-bold">
              ₹{parseFloat(amount || 0).toFixed(2)}
            </span>
          </div>

          {/* ── Payment buttons ── */}
          <div className="space-y-3">
            {/* Cash payment */}
            <button
              onClick={handleSettle}
              disabled={loading}
              className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold py-4 rounded-2xl transition text-lg flex items-center justify-center gap-2"
            >
              💵 {loading ? "Recording..." : "Mark as Cash Payment"}
            </button>

            {/* Razorpay UPI */}
            <button
              onClick={handleRazorpayPayment}
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-4 rounded-2xl transition text-lg flex items-center justify-center gap-2"
            >
              📱{" "}
              {loading
                ? "Processing..."
                : `Pay ₹${parseFloat(amount || 0).toFixed(2)} via UPI`}
            </button>
          </div>
        </div>
      )}
      
    </div>
  );
}

function MemberList({
  members,
  userId,
  getColor,
  getInitial,
  disabledIds = [],
  onSelect,
}) {
  return (
    <div className="max-w-lg mx-auto">
      {members.map((member) => {
        const disabled = disabledIds.includes(member.id);

        return (
          <button
            key={member.id}
            onClick={() => !disabled && onSelect(member)}
            disabled={disabled}
            className={`w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 border-b border-gray-800 transition text-left ${
              disabled
                ? "opacity-40 cursor-not-allowed bg-gray-900/40"
                : "hover:bg-gray-900 cursor-pointer"
            }`}
          >
            <div
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${getColor(member.name)}`}
            >
              {getInitial(member.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {member.name}
                {member.id === userId && (
                  <span className="text-gray-400 text-sm ml-1">(you)</span>
                )}
              </p>
              <p className="text-xs text-gray-500 truncate">{member.email}</p>
            </div>
            {disabled ? (
              <span className="text-gray-500 text-sm shrink-0">
                same person
              </span>
            ) : (
              <span className="text-right shrink-0">
                {member.amount < -0.01 && (
                  <span className="text-red-400 text-sm">
                    borrowes ₹{Math.abs(member.amount).toFixed(2)}
                  </span>
                )}
                {member.amount > 0.01 && (
                  <span className="text-emerald-400 text-sm">
                    gets ₹{member.amount.toFixed(2)}
                  </span>
                )}
                {Math.abs(member.amount) < 0.01 && (
                  <span className="text-gray-500 text-sm">settled</span>
                )}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PaymentPreview({ paidBy, paidTo, getColor, getInitial }) {
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-6 mb-8 min-w-0">
      <div className="text-center">
        <div
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center font-bold text-xl mx-auto mb-2 ${getColor(paidBy?.name)}`}
        >
          {getInitial(paidBy?.name)}
        </div>
        <p className="text-sm text-gray-400 max-w-28 truncate">
          {paidBy?.name}
        </p>
      </div>
      <FiArrowRight size={24} className="text-gray-400" />
      <div className="text-center">
        <div
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center font-bold text-xl mx-auto mb-2 ${getColor(paidTo?.name)}`}
        >
          {getInitial(paidTo?.name)}
        </div>
        <p className="text-sm text-gray-400 max-w-28 truncate">
          {paidTo?.name}
        </p>
      </div>
    </div>
  );
}
