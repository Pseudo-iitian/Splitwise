import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import Pusher from "pusher-js";
import {
  getExpenses,
  getSettlementSummary,
  generateInvite,
  deleteExpense,
  updateSettlement,
  deleteSettlement,
  getGroupHistory,
  getWishlist,
  addExpense,
  getGroups,
  getChatMessages,
  sendChatMessage,
  deleteChatMessage,
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
  FiActivity,
  FiCreditCard,
  FiShoppingCart,
  FiX,
  FiCheck,
  FiSend,
  FiMessageCircle,
} from "react-icons/fi";

const getCatEmoji = (cat) => {
  const map = {
    electronics: "📱",
    food: "🍕",
    travel: "✈️",
    clothing: "👗",
    home: "🏠",
    entertainment: "🎮",
    other: "📦",
  };
  return map[cat] || "📦";
};

// ── Helper: format chat time ──────────────────────────────────────────────────
const formatTime = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};
const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

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
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("expenses");
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [settlementModal, setSettlementModal] = useState(null);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementExpenseIds, setSettlementExpenseIds] = useState([]);
  const [savingSettlement, setSavingSettlement] = useState(false);

  // Wishlist import
  const [wishlistModal, setWishlistModal] = useState(false);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [selectedWishItem, setSelectedWishItem] = useState(null);
  const [wishPaidBy, setWishPaidBy] = useState("");
  const [wishImporting, setWishImporting] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [wishAmount, setWishAmount] = useState("");

  // ── Chat state ────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const pusherRef = useRef(null);

  useEffect(() => {
    fetchAll();
  }, []);

  // ── Pusher setup when chat tab opens ─────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "chat") return;

    fetchChatMessages();

    // Init Pusher
    pusherRef.current = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER,
    });

    const channel = pusherRef.current.subscribe(`group-${groupId}`);

    channel.bind("new-message", (data) => {
      setChatMessages((prev) => {
        // Avoid duplicates (our own optimistic message)
        if (prev.find((m) => m._id === data._id)) return prev;
        return [...prev, data];
      });
    });

    channel.bind("delete-message", ({ messageId }) => {
      setChatMessages((prev) => prev.filter((m) => m._id !== messageId));
    });

    return () => {
      pusherRef.current?.unsubscribe(`group-${groupId}`);
      pusherRef.current?.disconnect();
    };
  }, [activeTab, groupId]);

  // ── Auto scroll to bottom ─────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const fetchChatMessages = async () => {
    setChatLoading(true);
    try {
      const res = await getChatMessages(groupId);
      // Debugging ke liye console log karein
      console.log("Chat API Response:", res.data);

      if (res.data && Array.isArray(res.data)) {
        setChatMessages(res.data);
      } else {
        setChatMessages([]); // Safety net
      }
    } catch (err) {
      console.error("Chat Fetch Error:", err);
      setChatMessages([]);
      toast.error("Failed to load messages");
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const msg = chatInput.trim();
    if (!msg || chatSending) return;

    setChatInput("");
    setChatSending(true);

    try {
      await sendChatMessage(groupId, { message: msg });
      // Pusher will deliver the message via subscription
    } catch {
      toast.error("Failed to send message");
      setChatInput(msg); // restore on error
    } finally {
      setChatSending(false);
      chatInputRef.current?.focus();
    }
  };

  const handleDeleteMessage = async (msgId) => {
    try {
      await deleteChatMessage(groupId, msgId);
      // Pusher will update via delete-message event
    } catch (err) {
      toast.error(err.response?.data?.error || "Cannot delete");
    }
  };

  const fetchAll = async () => {
    try {
      const [expRes, summaryRes, histRes, groupRes] = await Promise.all([
        getExpenses(groupId),
        getSettlementSummary(groupId),
        getGroupHistory(groupId),
        getGroups(),
      ]);
      setExpenses(expRes.data);
      setBalances(summaryRes.data.balances || {});
      setSettlementSummary(summaryRes.data || { suggestions: [] });
      setHistory(histRes.data || []);
      const foundGroup = groupRes.data.find((g) => g._id === groupId);
      if (foundGroup) setGroupMembers(foundGroup.members);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Wishlist
  const openWishlistModal = async () => {
    setWishlistModal(true);
    setSelectedWishItem(null);
    setWishPaidBy(user?.id || "");
    setWishAmount("");
    setWishlistLoading(true);
    try {
      const res = await getWishlist();
      setWishlistItems(res.data.filter((i) => !i.isBought));
    } catch {
      toast.error("Failed to load wishlist");
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleSelectWishItem = (item) => {
    setSelectedWishItem(item);
    setWishAmount(item.price > 0 ? item.price.toString() : "");
  };

  const handleImportFromWishlist = async () => {
    if (!selectedWishItem) {
      toast.error("Select a wishlist item");
      return;
    }
    if (!wishPaidBy) {
      toast.error("Select who paid");
      return;
    }
    if (!wishAmount || parseFloat(wishAmount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setWishImporting(true);
    try {
      await addExpense({
        description: selectedWishItem.title,
        amount: parseFloat(wishAmount),
        groupId,
        paidBy: wishPaidBy,
        splitType: "equal",
        members: groupMembers.map((m) => m._id || m),
      });
      toast.success(`"${selectedWishItem.title}" imported as expense! 🎉`);
      setWishlistModal(false);
      setSelectedWishItem(null);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to import");
    } finally {
      setWishImporting(false);
    }
  };

  // Existing handlers
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
    if (settlement.relatedExpenses?.length > 0) {
      setSettlementExpenseIds(
        settlement.relatedExpenses.map((e) => e._id || e),
      );
    } else if (settlement.relatedExpense) {
      setSettlementExpenseIds([
        settlement.relatedExpense._id || settlement.relatedExpense,
      ]);
    } else {
      setSettlementExpenseIds([]);
    }
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
        relatedExpenses:
          settlementExpenseIds.length > 0 ? settlementExpenseIds : null,
      });
      toast.success("Payment updated!");
      setSettlementModal(null);
      setSettlementAmount("");
      setSettlementExpenseIds([]);
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
      setSettlementExpenseIds([]);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.msg || "Failed to delete payment");
    } finally {
      setSavingSettlement(false);
    }
  };

  const shareOnWhatsApp = () => {
    window.open(
      "https://wa.me/?text=" +
        encodeURIComponent(
          "Hey! Join my group on Splitwise Clone!\nClick here to join: " +
            inviteLink,
        ),
      "_blank",
    );
  };

  const getItemDate = (item) =>
    new Date(item.date || item.createdAt || item.updatedAt || Date.now());

  const activityItems = [
    ...expenses.map((e) => ({
      type: "expense",
      id: `expense-${e._id}`,
      date: getItemDate(e),
      data: e,
    })),
    ...(settlementSummary.settlements || [])
      .filter((s) => !s.isExpenseUpdate)
      .map((s) => ({
        type: "settlement",
        id: `settlement-${s._id}`,
        date: getItemDate(s),
        data: s,
      })),
  ].sort((a, b) => b.date - a.date);

  const userDebts = settlementSummary.userDebts || [];
  const totalUserDebt = userDebts.reduce(
    (t, d) => t + Number(d.amount || 0),
    0,
  );

  const getSettlementText = (s) => {
    const paidById = s.paidBy?._id || s.paidBy?.id;
    const paidToId = s.paidTo?._id || s.paidTo?.id;
    const payerName = paidById === user?.id ? "You" : s.paidBy?.name;
    const payeeName = paidToId === user?.id ? "you" : s.paidTo?.name;
    return `${payerName || "Someone"} paid ${payeeName || "someone"}`;
  };

  const getExpenseOptionsForSettlement = (settlement) => {
    if (!settlement) return [];
    const payerId =
      settlement.paidBy?._id || settlement.paidBy?.id || settlement.paidBy;
    const receiverId =
      settlement.paidTo?._id || settlement.paidTo?.id || settlement.paidTo;
    return expenses.filter((expense) => {
      const expPaidById =
        expense.paidBy?._id || expense.paidBy?.id || expense.paidBy;
      const payerInSplit = expense.splits?.some(
        (split) =>
          (split.user?._id || split.user?.id || split.user) === payerId,
      );
      return expPaidById === receiverId && payerInSplit;
    });
  };

  // ── Group chat messages by date ───────────────────────────────────────────
  // GroupDetail.jsx mein find karein aur replace karein:
  const groupedMessages = (
    Array.isArray(chatMessages) ? chatMessages : []
  ).reduce((acc, msg) => {
    // Check karein ki message valid object hai
    if (!msg || !msg.createdAt) return acc;

    const dateKey = formatDate(msg.createdAt);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(msg);
    return acc;
  }, {});

  const TABS = ["expenses", "balances", "history", "chat"];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Toaster />

      {/* ── Header ──────────────────────────────────────────────── */}
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
        <div className="grid grid-cols-4 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleInvite}
            className="flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white px-2 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition"
          >
            <FiShare2 size={14} className="shrink-0" />
            <span className="truncate">Invite</span>
          </button>
          <button
            onClick={openWishlistModal}
            className="flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-2 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition"
          >
            <FiShoppingCart size={14} className="shrink-0" />
            <span className="truncate hidden sm:inline">Wishlist</span>
            <span className="truncate sm:hidden">Import</span>
          </button>
          <Link
            to={`/group/${groupId}/add-expense`}
            className="flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-2 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition"
          >
            <FiPlus className="shrink-0" />
            <span className="truncate">Add</span>
          </Link>
          <button
            onClick={() => navigate("/group/" + groupId + "/settle-up")}
            className="flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-2 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition"
          >
            <FiDollarSign size={14} className="shrink-0" />
            <span className="truncate">Settle</span>
          </button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-800 px-4 sm:px-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 px-4 text-sm font-medium capitalize border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === tab
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {tab === "chat" && <FiMessageCircle size={14} />}
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab Content ─────────────────────────────────────────── */}
      <div
        className={`max-w-2xl mx-auto px-4 sm:px-6 ${activeTab === "chat" ? "py-0" : "py-6"}`}
      >
        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading...</div>
        ) : activeTab === "expenses" ? (
          /* ── EXPENSES TAB ──────────────────────────────────────── */
          <div className="space-y-3 py-6">
            {/* Debt banner */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                  <FiDollarSign className="text-amber-300" size={20} />
                </div>
                <div className="min-w-0 w-full">
                  {userDebts.length > 0 ? (
                    <DebtBreakdown
                      userDebts={userDebts}
                      totalUserDebt={totalUserDebt}
                    />
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
                  const s = item.data;
                  return (
                    <SettlementCard
                      key={item.id}
                      s={s}
                      item={item}
                      getSettlementText={getSettlementText}
                      openSettlementModal={openSettlementModal}
                      currentUserId={user?.id}
                    />
                  );
                }
                const exp = item.data;
                return (
                  <div
                    key={item.id}
                    className="bg-gray-900 border border-gray-800 rounded-2xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">
                          {exp.description}
                        </h3>
                        <p className="text-gray-400 text-sm mt-0.5 truncate">
                          Paid by{" "}
                          {exp.paidByMultiple?.length > 1
                            ? `${exp.paidBy?.name || "Someone"} and ${exp.paidByMultiple.length - 1} other${exp.paidByMultiple.length > 2 ? "s" : ""}`
                            : exp.paidBy?.name || "Someone"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-emerald-400 font-bold text-lg">
                          ₹{exp.amount}
                        </span>
                        <button
                          onClick={() =>
                            navigate(
                              "/group/" + groupId + "/edit-expense/" + exp._id,
                            )
                          }
                          className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
                        >
                          <FiEdit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteModal(exp)}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {exp.splits?.map((split) => {
                        const splitUserId = split.user?._id || split.user;
                        const isPayer =
                          exp.paidByMultiple?.length > 0
                            ? exp.paidByMultiple.some(
                                (p) =>
                                  (p.user?._id || p.user) === splitUserId &&
                                  p.amount > 0,
                              )
                            : (exp.paidBy?._id || exp.paidBy) === splitUserId;
                        const isGreen = split.settled || isPayer;
                        return (
                          <span
                            key={split._id}
                            className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 ${isGreen ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}
                          >
                            {isGreen ? (
                              <FiCheckCircle size={12} />
                            ) : (
                              <FiXCircle size={12} />
                            )}
                            <span>
                              {split.user?.name}: ₹
                              {Number(split.amount || 0).toFixed(2)}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      {item.date.toLocaleDateString("en-IN")}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        ) : activeTab === "balances" ? (
          /* ── BALANCES TAB ──────────────────────────────────────── */
          <div className="space-y-3 py-6">
            {Object.keys(balances).length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">✅</div>
                <p className="text-gray-400">All settled up!</p>
              </div>
            ) : (
              <>
                {settlementSummary.suggestions?.length > 0 && (
                  <div className="space-y-3">
                    {settlementSummary.suggestions.map((item, i) => (
                      <div
                        key={i}
                        className="bg-gray-900 border border-gray-800 rounded-2xl p-4"
                      >
                        <p className="font-medium text-sm break-words">
                          {item.paidBy.name} borrows ₹{item.amount.toFixed(2)}{" "}
                          from {item.paidTo.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.paidBy.email} owes {item.paidTo.email}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pt-3 space-y-3">
                  {Object.entries(balances).map(([userId, balance]) => (
                    <div
                      key={userId}
                      className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                          <FiUsers className="text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {balance.name || userId.slice(-6)}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {balance.email || "Group member"}
                          </p>
                        </div>
                      </div>
                      {Math.abs(balance.amount) < 0.01 ? (
                        <span className="text-gray-400 text-sm">
                          is settled up
                        </span>
                      ) : (
                        <span
                          className={`font-bold text-lg ${balance.amount > 0 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {balance.amount > 0 ? "+" : "-"}₹
                          {Math.abs(balance.amount).toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : activeTab === "history" ? (
          /* ── HISTORY TAB ───────────────────────────────────────── */
          <div className="space-y-4 py-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-800 before:to-transparent">
            {history.length === 0 ? (
              <div className="text-center py-20 relative z-10">
                <div className="text-5xl mb-4">📝</div>
                <p className="text-gray-400">No activity yet</p>
              </div>
            ) : (
              history.map((item) => {
                let Icon = FiActivity,
                  bgColor = "bg-gray-800",
                  iconColor = "text-gray-400";
                if (item.action === "added" || item.action === "created") {
                  Icon = FiPlus;
                  bgColor = "bg-emerald-500/10";
                  iconColor = "text-emerald-400";
                } else if (item.action === "updated") {
                  Icon = FiEdit2;
                  bgColor = "bg-blue-500/10";
                  iconColor = "text-blue-400";
                } else if (item.action === "deleted") {
                  Icon = FiTrash2;
                  bgColor = "bg-red-500/10";
                  iconColor = "text-red-400";
                } else if (
                  item.action === "paid" ||
                  item.action === "marked_paid"
                ) {
                  Icon = FiCreditCard;
                  bgColor = "bg-emerald-500/10";
                  iconColor = "text-emerald-400";
                }
                return (
                  <div
                    key={item._id}
                    className="relative z-10 flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-gray-950 bg-gray-900 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 mx-auto">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${bgColor}`}
                      >
                        <Icon size={14} className={iconColor} />
                      </div>
                    </div>
                    <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm truncate">
                          {item.user?.name || "Someone"}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(item.date).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 break-words">
                        {item.description}
                      </p>
                      {item.amount > 0 && (
                        <div className="mt-2 text-emerald-400 font-semibold text-sm">
                          ₹{item.amount.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : activeTab === "chat" ? (
          /* ── CHAT TAB ──────────────────────────────────────────── */
          <div
            className="flex flex-col"
            style={{ height: "calc(100vh - 140px)" }}
          >
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto py-4 space-y-1">
              {chatLoading ? (
                <div className="text-center text-gray-400 py-20">
                  Loading messages...
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-5xl mb-4">💬</div>
                  <p className="text-gray-400 font-medium">No messages yet</p>
                  <p className="text-gray-600 text-sm mt-1">
                    Be the first to say something!
                  </p>
                </div>
              ) : (
                Object.entries(groupedMessages).map(([dateLabel, msgs]) => (
                  <div key={dateLabel}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-gray-800" />
                      <span className="text-xs text-gray-500 bg-gray-900 px-3 py-1 rounded-full border border-gray-800">
                        {dateLabel}
                      </span>
                      <div className="flex-1 h-px bg-gray-800" />
                    </div>

                    {msgs.map((msg, idx) => {
                      const senderId = msg.sender?._id || msg.sender;
                      const isMe = senderId === user?.id;
                      const prevMsg = idx > 0 ? msgs[idx - 1] : null;
                      const prevSenderId =
                        prevMsg?.sender?._id || prevMsg?.sender;
                      const showAvatar = !isMe && prevSenderId !== senderId;
                      const showName =
                        !isMe && (idx === 0 || prevSenderId !== senderId);

                      return (
                        <div
                          key={msg._id}
                          className={`flex items-end gap-2 mb-1 group ${isMe ? "flex-row-reverse" : "flex-row"}`}
                        >
                          {/* Avatar placeholder for alignment */}
                          <div className="w-7 shrink-0">
                            {showAvatar && !isMe && (
                              <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                                {msg.sender?.name?.[0]?.toUpperCase() || "?"}
                              </div>
                            )}
                          </div>

                          <div
                            className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col`}
                          >
                            {/* Sender name */}
                            {showName && (
                              <p className="text-xs text-gray-500 mb-1 px-1">
                                {msg.sender?.name}
                              </p>
                            )}

                            <div
                              className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                isMe
                                  ? "bg-emerald-600 text-white rounded-br-md"
                                  : "bg-gray-800 text-gray-100 rounded-bl-md"
                              }`}
                            >
                              <p className="break-words">{msg.message}</p>
                              <p
                                className={`text-xs mt-1 ${isMe ? "text-emerald-200" : "text-gray-500"}`}
                              >
                                {formatTime(msg.createdAt)}
                              </p>

                              {/* Delete button — only for own messages */}
                              {isMe && (
                                <button
                                  onClick={() => handleDeleteMessage(msg._id)}
                                  className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-red-500 text-white hidden group-hover:flex items-center justify-center transition"
                                  title="Delete message"
                                >
                                  <FiX size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* ── Input bar ────────────────────────────────────── */}
            <div className="border-t border-gray-800 py-3 bg-gray-950">
              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-3"
              >
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition placeholder-gray-600"
                  maxLength={1000}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatSending}
                  className="w-11 h-11 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl flex items-center justify-center transition shrink-0"
                >
                  <FiSend size={16} />
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>

      {/* ══ IMPORT FROM WISHLIST MODAL ══════════════════════════════ */}
      {wishlistModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-5 shrink-0">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <FiShoppingCart className="text-purple-400" /> Import from
                  Wishlist
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Select an item to add as group expense
                </p>
              </div>
              <button
                onClick={() => setWishlistModal(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-4 pr-1">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Step 1 — Choose Wishlist Item
                </p>
                {wishlistLoading ? (
                  <p className="text-gray-400 text-sm text-center py-6">
                    Loading wishlist...
                  </p>
                ) : wishlistItems.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-gray-700 rounded-xl">
                    <p className="text-4xl mb-2">🛍️</p>
                    <p className="text-gray-400 text-sm">
                      No pending wishlist items
                    </p>
                  </div>
                ) : (
                  wishlistItems.map((item) => {
                    const isSelected = selectedWishItem?._id === item._id;
                    return (
                      <div
                        key={item._id}
                        onClick={() => handleSelectWishItem(item)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition mb-2 ${isSelected ? "border-purple-500 bg-purple-500/10" : "border-gray-700 bg-gray-800 hover:border-gray-600"}`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-gray-700 flex items-center justify-center text-lg shrink-0">
                          {getCatEmoji(item.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.title}
                          </p>
                          <p className="text-xs text-gray-400">
                            by {item.addedBy?.name || "Someone"}
                            {item.price > 0 && (
                              <span className="text-emerald-400 ml-2">
                                ₹{item.price.toLocaleString()}
                              </span>
                            )}
                          </p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${isSelected ? "border-purple-500 bg-purple-500" : "border-gray-600"}`}
                        >
                          {isSelected && (
                            <FiCheck size={10} className="text-white" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {selectedWishItem && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Step 2 — Confirm Amount
                  </p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={wishAmount}
                      onChange={(e) => setWishAmount(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:border-purple-500 transition text-sm"
                      placeholder="Enter amount"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Wishlist price: ₹
                    {selectedWishItem.price > 0
                      ? selectedWishItem.price.toLocaleString()
                      : "not set"}
                  </p>
                </div>
              )}

              {selectedWishItem && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Step 3 — Who Paid?
                  </p>
                  <div className="space-y-2">
                    {groupMembers.map((member) => {
                      const memberId = member._id || member;
                      const name = member.name || "Member";
                      const isMe = memberId === user?.id;
                      const selected = wishPaidBy === memberId;
                      return (
                        <div
                          key={memberId}
                          onClick={() => setWishPaidBy(memberId)}
                          className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition ${selected ? "border-blue-500 bg-blue-500/10" : "border-gray-700 bg-gray-800 hover:border-gray-600"}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${selected ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-400"}`}
                            >
                              {name[0]?.toUpperCase()}
                            </div>
                            <p className="text-sm font-medium truncate">
                              {name}
                              {isMe && (
                                <span className="text-xs text-gray-400 ml-1">
                                  (you)
                                </span>
                              )}
                            </p>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${selected ? "border-blue-500 bg-blue-500" : "border-gray-600"}`}
                          >
                            {selected && (
                              <div className="w-2 h-2 bg-white rounded-full" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    💡 Split equally among all {groupMembers.length} members
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 shrink-0 border-t border-gray-800 mt-4">
              <button
                onClick={() => setWishlistModal(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleImportFromWishlist}
                disabled={
                  !selectedWishItem ||
                  !wishPaidBy ||
                  !wishAmount ||
                  wishImporting
                }
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition text-sm"
              >
                {wishImporting ? "Importing..." : "🛍️ Import as Expense"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ INVITE MODAL ════════════════════════════════════════════ */}
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
            <div className="bg-gray-800 rounded-xl p-4 mb-4 text-sm text-gray-300 break-words">
              Hey! Join my group on Splitwise Clone 🎉
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

      {/* ══ SETTLEMENT MODAL ════════════════════════════════════════ */}
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
                Related expenses
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {getExpenseOptionsForSettlement(settlementModal).map(
                  (expense) => {
                    const isSelected = settlementExpenseIds.includes(
                      expense._id,
                    );
                    return (
                      <label
                        key={expense._id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${isSelected ? "border-emerald-500 bg-emerald-500/10" : "border-gray-700 bg-gray-800 hover:bg-gray-700"}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked)
                              setSettlementExpenseIds([
                                ...settlementExpenseIds,
                                expense._id,
                              ]);
                            else
                              setSettlementExpenseIds(
                                settlementExpenseIds.filter(
                                  (id) => id !== expense._id,
                                ),
                              );
                          }}
                          className="w-4 h-4 rounded border-gray-600 text-emerald-500 focus:ring-emerald-500 bg-gray-700"
                        />
                        <span className="text-sm font-medium">
                          {expense.description} - ₹
                          {Number(expense.amount || 0).toFixed(2)}
                        </span>
                      </label>
                    );
                  },
                )}
                {getExpenseOptionsForSettlement(settlementModal).length ===
                  0 && (
                  <p className="text-sm text-gray-400">
                    No related expenses found.
                  </p>
                )}
              </div>
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
                  setSettlementExpenseIds([]);
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

      {/* ══ DELETE EXPENSE MODAL ════════════════════════════════════ */}
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

  function DebtBreakdown({ userDebts, totalUserDebt }) {
    const [open, setOpen] = React.useState(false);

    return (
      <div className="w-full">
        <p className="font-semibold text-amber-100">
          You owe ₹{totalUserDebt.toFixed(2)} overall
        </p>
        <div className="mt-1 space-y-0.5">
          {userDebts.map((d) => (
            <p key={d.id} className="text-sm text-amber-50/90">
              You owe {d.name} ₹{Number(d.amount).toFixed(2)}
            </p>
          ))}
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="mt-3 text-xs text-amber-300 hover:text-amber-200 underline underline-offset-2 transition flex items-center gap-1"
        >
          {open ? "▲ Hide breakdown" : "▼ Show how this was calculated"}
        </button>

        {open && (
          <div className="mt-3 space-y-4">
            {userDebts.map((d) => {
              const youOweTotal = (d.expenses || []).reduce(
                (s, e) => s + e.remainingAmount,
                0,
              );
              const theyOweTotal = (d.creditsFromThem || []).reduce(
                (s, e) => s + e.theirShare,
                0,
              );

              return (
                <div
                  key={d.id}
                  className="bg-black/20 rounded-xl p-3 space-y-3"
                >
                  <p className="text-sm font-semibold text-amber-200">
                    📊 You ↔ {d.name}
                  </p>

                  {/* You owe them */}
                  {d.expenses?.length > 0 && (
                    <div>
                      <p className="text-xs text-red-300/80 mb-1">
                        ➕ You owe {d.name} for:
                      </p>
                      <div className="space-y-1">
                        {d.expenses.map((exp) => (
                          <div
                            key={exp.id}
                            className="flex justify-between text-xs text-amber-50/80"
                          >
                            <span className="truncate max-w-[65%]">
                              • {exp.description}
                            </span>
                            <span className="text-red-300 shrink-0">
                              ₹{Number(exp.remainingAmount).toFixed(2)}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between text-xs font-semibold text-red-300 border-t border-amber-500/20 pt-1">
                          <span>Subtotal</span>
                          <span>₹{youOweTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* They owe you */}
                  {d.creditsFromThem?.length > 0 && (
                    <div>
                      <p className="text-xs text-emerald-300/80 mb-1">
                        ➖ {d.name} owes you for:
                      </p>
                      <div className="space-y-1">
                        {d.creditsFromThem.map((exp) => (
                          <div
                            key={exp.id}
                            className="flex justify-between text-xs text-amber-50/80"
                          >
                            <span className="truncate max-w-[65%]">
                              • {exp.description}
                            </span>
                            <span className="text-emerald-300 shrink-0">
                              ₹{Number(exp.theirShare).toFixed(2)}
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between text-xs font-semibold text-emerald-300 border-t border-amber-500/20 pt-1">
                          <span>Subtotal</span>
                          <span>₹{theyOweTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Calculation */}
                  {d.expenses?.length > 0 && d.creditsFromThem?.length > 0 && (
                    <div className="bg-black/20 rounded-lg px-3 py-2 text-xs text-amber-200/80 space-y-0.5">
                      <div className="flex justify-between">
                        <span>You owe {d.name}</span>
                        <span className="text-red-300">
                          ₹{youOweTotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{d.name} owes you</span>
                        <span className="text-emerald-300">
                          - ₹{theyOweTotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-amber-200 border-t border-amber-500/20 pt-1">
                        <span>Net you owe</span>
                        <span>₹{Number(d.amount).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Agar sirf ek taraf hai */}
                  {!(
                    d.expenses?.length > 0 && d.creditsFromThem?.length > 0
                  ) && (
                    <div className="flex justify-between text-xs font-bold text-amber-300 border-t border-amber-500/30 pt-2">
                      <span>Net you owe {d.name}</span>
                      <span>₹{Number(d.amount).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Grand total */}
            <div className="flex justify-between text-sm font-bold text-amber-200 border-t border-amber-500/40 pt-2">
              <span>Total you owe</span>
              <span>₹{totalUserDebt.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }
  function SettlementCard({
    s,
    item,
    getSettlementText,
    openSettlementModal,
    currentUserId,
  }) {
    const [showMore, setShowMore] = React.useState(false);

    const payerId = s.paidBy?._id || s.paidBy?.id;
    const payeeId = s.paidTo?._id || s.paidTo?.id;
    const isCurrentUserPayer = payerId === currentUserId;
    const isCurrentUserPayee = payeeId === currentUserId;

    const allExpenses =
      s.relatedExpenses?.length > 0
        ? s.relatedExpenses
        : s.relatedExpense
          ? [s.relatedExpense]
          : [];

    return (
      <div className="bg-gray-900 border border-emerald-500/30 hover:border-emerald-400 rounded-2xl p-4 transition">
        {/* Main row — click karo modal ke liye */}
        <div
          className="flex items-center justify-between gap-3 cursor-pointer"
          onClick={() => openSettlementModal(s)}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
              <FiDollarSign className="text-emerald-400" size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{getSettlementText(s)}</h3>
              <p className="text-xs text-gray-500">
                {item.date.toLocaleDateString("en-IN")}
              </p>
              {allExpenses.length > 0 && (
                <p className="text-xs text-emerald-300 mt-0.5 truncate">
                  For {allExpenses.map((e) => e.description).join(", ")}
                </p>
              )}
            </div>
          </div>
          <span className="text-emerald-400 font-bold text-lg shrink-0">
            ₹{s.amount.toFixed(2)}
          </span>
        </div>

        {/* Show more button — sirf tab dikhao jab expenses hain */}
        {allExpenses.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMore(!showMore);
            }}
            className="mt-2 text-xs text-emerald-400/70 hover:text-emerald-300 underline underline-offset-2 transition flex items-center gap-1"
          >
            {showMore ? "▲ Hide details" : "▼ Show more details"}
          </button>
        )}

        {/* Breakdown */}
        {showMore && allExpenses.length > 0 && (
          <div className="mt-3 bg-black/20 rounded-xl p-3 space-y-3">
            {/* Payer info */}
            <p className="text-xs font-semibold text-emerald-200">
              📊 {s.paidBy?.name} → {s.paidTo?.name}
            </p>

            {/* Related expenses list */}
            <div>
              <p className="text-xs text-gray-400 mb-1">
                {s.paidBy?.name} paid {s.paidTo?.name} for:
              </p>
              <div className="space-y-1">
                {allExpenses.map((exp, idx) => (
                  <div
                    key={exp._id || idx}
                    className="flex justify-between text-xs text-gray-300"
                  >
                    <span className="truncate max-w-[65%]">
                      • {exp.description}
                    </span>
                    <span className="text-emerald-300 shrink-0">
                      ₹{Number(exp.amount || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Breakdown calculation agar multiple expenses hain */}
            {allExpenses.length > 1 && (
              <div className="border-t border-emerald-500/20 pt-2 space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Total expenses</span>
                  <span>
                    ₹
                    {allExpenses
                      .reduce((s, e) => s + Number(e.amount || 0), 0)
                      .toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold text-emerald-300">
                  <span>Amount paid</span>
                  <span>₹{s.amount.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Context for current user */}
            {(isCurrentUserPayer || isCurrentUserPayee) && (
              <div className="border-t border-emerald-500/20 pt-2">
                {isCurrentUserPayer && (
                  <p className="text-xs text-emerald-300/80">
                    ✅ You paid ₹{s.amount.toFixed(2)} to {s.paidTo?.name}
                  </p>
                )}
                {isCurrentUserPayee && (
                  <p className="text-xs text-emerald-300/80">
                    ✅ {s.paidBy?.name} paid you ₹{s.amount.toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}
