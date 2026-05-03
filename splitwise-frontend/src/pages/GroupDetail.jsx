import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  getExpenses,
  getSettlementSummary,
  generateInvite,
  deleteExpense,
  updateSettlement,
  deleteSettlement,
} from "../services/api";
import toast, { Toaster } from "react-hot-toast";
import {
  FiArrowLeft,
  FiPlus,
  FiUsers,
  FiShare2,
  FiCopy,
  FiEdit2,
  FiTrash2,
  FiDollarSign,
  FiCheckCircle,
  FiXCircle,
} from "react-icons/fi";

export default function GroupDetail() {
  const { id: groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({});
  const [settlementSummary, setSettlementSummary] = useState({
    suggestions: [],
    settlements: [],
  });
  const [activeTab, setActiveTab] = useState("expenses");
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [settlementModal, setSettlementModal] = useState(null);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementExpenseId, setSettlementExpenseId] = useState("");
  const [savingSettlement, setSavingSettlement] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [expRes, summaryRes] = await Promise.all([
        getExpenses(groupId),
        getSettlementSummary(groupId),
      ]);
      setExpenses(expRes.data);
      setBalances(summaryRes.data.balances || {});
      setSettlementSummary(summaryRes.data || { suggestions: [] });
    } catch {
      toast.error("Failed to load data");
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
      toast.error("Failed to generate invite link");
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success("Link copied!");
  };

  const handleDeleteExpense = async () => {
    if (!deleteModal) return;
    try {
      await deleteExpense(deleteModal._id);
      toast.success("Expense deleted!");
      setDeleteModal(null);
      fetchAll();
    } catch {
      toast.error("Failed to delete expense");
    }
  };

  const openSettlementModal = (settlement) => {
    setSettlementModal(settlement);
    setSettlementAmount(settlement.amount?.toString() || "");
    setSettlementExpenseId(settlement.relatedExpense?._id || settlement.relatedExpense || "");
  };

  const handleUpdateSettlement = async () => {
    const amount = parseFloat(settlementAmount);
    if (!settlementModal || !amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setSavingSettlement(true);
    try {
      await updateSettlement(settlementModal._id, {
        amount,
        note: settlementModal.note,
        relatedExpense: settlementExpenseId || null,
      });
      toast.success("Payment updated!");
      setSettlementModal(null);
      setSettlementAmount("");
      setSettlementExpenseId("");
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.msg || "Failed to update payment");
    } finally {
      setSavingSettlement(false);
    }
  };

  const handleDeleteSettlement = async () => {
    if (!settlementModal) return;

    setSavingSettlement(true);
    try {
      await deleteSettlement(settlementModal._id);
      toast.success("Payment deleted!");
      setSettlementModal(null);
      setSettlementAmount("");
      setSettlementExpenseId("");
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.msg || "Failed to delete payment");
    } finally {
      setSavingSettlement(false);
    }
  };

  const shareOnWhatsApp = () => {
    const msg =
      "Hey! Join my group on Splitwise Clone!\nClick here to join: " +
      inviteLink;
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
  };

  const getItemDate = (item) =>
    new Date(item.date || item.createdAt || item.updatedAt || Date.now());

  const activityItems = [
    ...expenses.map((expense) => ({
      type: "expense",
      id: `expense-${expense._id}`,
      date: getItemDate(expense),
      data: expense,
    })),
    ...(settlementSummary.settlements || []).map((settlement) => ({
      type: "settlement",
      id: `settlement-${settlement._id}`,
      date: getItemDate(settlement),
      data: settlement,
    })),
  ].sort((a, b) => b.date - a.date);

  const userDebts = settlementSummary.userDebts || [];
  const totalUserDebt = userDebts.reduce(
    (total, debt) => total + Number(debt.amount || 0),
    0,
  );

  const getSettlementText = (settlement) => {
    const paidById = settlement.paidBy?._id || settlement.paidBy?.id;
    const paidToId = settlement.paidTo?._id || settlement.paidTo?.id;
    const payerName = paidById === user?.id ? "You" : settlement.paidBy?.name;
    const payeeName = paidToId === user?.id ? "you" : settlement.paidTo?.name;

    return `${payerName || "Someone"} paid ${payeeName || "someone"}`;
  };

  const getExpenseOptionsForSettlement = (settlement) => {
    if (!settlement) return [];

    const payerId = settlement.paidBy?._id || settlement.paidBy?.id || settlement.paidBy;
    const receiverId = settlement.paidTo?._id || settlement.paidTo?.id || settlement.paidTo;

    return expenses.filter((expense) => {
      const expensePaidById = expense.paidBy?._id || expense.paidBy?.id || expense.paidBy;
      const payerInSplit = expense.splits?.some((split) => {
        const splitUserId = split.user?._id || split.user?.id || split.user;
        return splitUserId === payerId;
      });

      return expensePaidById === receiverId && payerInSplit;
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Toaster />

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => navigate("/")}
            className="text-gray-400 hover:text-white transition shrink-0"
          >
            <FiArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-lg truncate">Group Detail</h1>
            <p className="text-gray-400 text-sm">{expenses.length} expenses</p>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleInvite}
            className="flex items-center justify-center gap-1.5 sm:gap-2 bg-gray-800 hover:bg-gray-700 text-white px-2 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition min-w-0"
          >
            <FiShare2 size={14} className="shrink-0" />
            <span className="truncate">Invite</span>
          </button>
          <Link
            to={`/group/${groupId}/add-expense`}
            className="flex items-center justify-center gap-1.5 sm:gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-2 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition min-w-0"
          >
            <FiPlus className="shrink-0" />
            <span className="truncate">Add</span>
          </Link>
          <button
            onClick={() => navigate("/group/" + groupId + "/settle-up")}
            className="flex items-center justify-center gap-1.5 sm:gap-2 bg-orange-500 hover:bg-orange-600 text-white px-2 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition min-w-0"
          >
            <FiDollarSign size={14} className="shrink-0" />
            <span className="truncate">Settle</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 px-4 sm:px-6 overflow-x-auto">
        {["expenses", "balances"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 px-4 text-sm font-medium capitalize border-b-2 transition ${
              activeTab === tab
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading...</div>
        ) : activeTab === "expenses" ? (
          <div className="space-y-3">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                  <FiDollarSign className="text-amber-300" size={20} />
                </div>
                <div className="min-w-0 w-full">
                  {userDebts.length > 0 ? (
                    <>
                      <p className="font-semibold text-amber-100">
                        You owe ₹{totalUserDebt.toFixed(2)} overall
                      </p>
                      <div className="mt-2 space-y-1">
                        {userDebts.map((debt) => (
                          <p
                            key={debt.id}
                            className="text-sm text-amber-50/90 break-words"
                          >
                            You owe {debt.name || "Someone"} ₹
                            {Number(debt.amount || 0).toFixed(2)}
                          </p>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-amber-100">
                        You are all settled up
                      </p>
                      <p className="text-sm text-amber-50/80 mt-1">
                        No pending amount from your side in this group.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
            {activityItems.length === 0 ? (
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
              activityItems.map((item) => {
                if (item.type === "settlement") {
                  const settlement = item.data;

                  return (
                    <div
                      key={item.id}
                      onClick={() => openSettlementModal(settlement)}
                      className="bg-gray-900 border border-emerald-500/30 hover:border-emerald-400 rounded-2xl p-4 cursor-pointer transition"
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                            <FiDollarSign className="text-emerald-400" size={20} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold truncate">
                              {getSettlementText(settlement)}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {item.date.toLocaleDateString("en-IN")}
                            </p>
                            {settlement.relatedExpense && (
                              <p className="text-xs text-emerald-300 mt-1 truncate">
                                For {settlement.relatedExpense.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-emerald-400 font-bold text-base sm:text-lg whitespace-nowrap shrink-0">
                          ₹{settlement.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                }

                const exp = item.data;

                return (
                  <div
                    key={item.id}
                    className="bg-gray-900 border border-gray-800 rounded-2xl p-4"
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{exp.description}</h3>
                        <p className="text-gray-400 text-sm mt-0.5 truncate">
                          Paid by {exp.paidBy?.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <span className="text-emerald-400 font-bold text-base sm:text-lg">
                          ₹{exp.amount}
                        </span>
                        <button
                          onClick={() =>
                            navigate(
                              "/group/" + groupId + "/edit-expense/" + exp._id,
                            )
                          }
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
                      {exp.splits?.map((split) => (
                        <span
                          key={split._id}
                          className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 ${
                            split.settled
                              ? "bg-emerald-500/10 text-emerald-300"
                              : "bg-red-500/10 text-red-300"
                          }`}
                        >
                          {split.settled ? <FiCheckCircle size={12} /> : <FiXCircle size={12} />}
                          <span>{split.user?.name}: ₹{Number(split.amount || 0).toFixed(2)}</span>
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      {item.date.toLocaleDateString("en-IN")}
                    </p>
                  </div>
                );
              })
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
              <>
                {settlementSummary.suggestions?.length > 0 ? (
                  <div className="space-y-3">
                    {settlementSummary.suggestions.map((item, index) => (
                      <div
                        key={`${item.paidBy.id}-${item.paidTo.id}-${index}`}
                        className="bg-gray-900 border border-gray-800 rounded-2xl p-4"
                      >
                        <p className="font-medium text-sm sm:text-base break-words">
                          {item.paidBy.name} borrows ₹{item.amount.toFixed(2)} from {item.paidTo.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 break-all">
                          {item.paidBy.email} owes {item.paidTo.email}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center text-gray-400">
                    Everyone is settled up
                  </div>
                )}

                <div className="pt-3 space-y-3">
                  {Object.entries(balances).map(([userId, balance]) => (
                    <div
                      key={userId}
                      className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                          <FiUsers className="text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{balance.name || userId.slice(-6)}</p>
                          <p className="text-xs text-gray-500 truncate">{balance.email || "Group member"}</p>
                        </div>
                      </div>
                      {Math.abs(balance.amount) < 0.01 ? (
                        <span className="text-gray-400 text-sm self-end sm:self-auto">is settled up</span>
                      ) : (
                        <span
                          className={`font-bold text-lg self-end sm:self-auto ${balance.amount > 0 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {balance.amount > 0 ? "+" : "-"}₹{Math.abs(balance.amount).toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiShare2 className="text-emerald-400" size={24} />
              </div>
              <h2 className="text-xl font-bold">Invite Friends</h2>
              <p className="text-gray-400 text-sm mt-2">
                Share this link to invite people to your group
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 mb-4 text-sm text-gray-300 leading-relaxed break-words">
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

      {/* Edit/Delete Payment Modal */}
      {settlementModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiDollarSign className="text-emerald-400" size={24} />
              </div>
              <h2 className="text-xl font-bold">Edit Payment</h2>
              <p className="text-gray-400 text-sm mt-2">
                {getSettlementText(settlementModal)}
              </p>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount (₹)
              </label>
              <input
                type="number"
                min="1"
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition"
                autoFocus
              />
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Related expense
              </label>
              <select
                value={settlementExpenseId}
                onChange={(e) => setSettlementExpenseId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="">Overall balance</option>
                {getExpenseOptionsForSettlement(settlementModal).map((expense) => (
                  <option key={expense._id} value={expense._id}>
                    {expense.description} - ₹{Number(expense.amount || 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleUpdateSettlement}
                disabled={savingSettlement}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition"
              >
                {savingSettlement ? "Saving..." : "Save changes"}
              </button>
              <button
                onClick={handleDeleteSettlement}
                disabled={savingSettlement}
                className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition"
              >
                Delete payment
              </button>
              <button
                onClick={() => {
                  setSettlementModal(null);
                  setSettlementAmount("");
                  setSettlementExpenseId("");
                }}
                disabled={savingSettlement}
                className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white py-3 rounded-xl transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Expense Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiTrash2 className="text-red-400" size={24} />
              </div>
              <h2 className="text-xl font-bold">Delete Expense?</h2>
              <p className="text-gray-400 text-sm mt-2">
                Delete{" "}
                <span className="text-white font-medium">
                  "{deleteModal.description}"
                </span>
                ? This cannot be undone.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
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
