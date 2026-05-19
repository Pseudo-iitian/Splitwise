import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
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
  sendChatMedia,
  createPoll,
  voteOnPoll,
  aiAssistExpense,
  sendPaymentReminder,
  getGroupVideoRoom,
  createGroupVideoRoom,
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
  FiImage,
  FiVideo,
  FiFile,
  FiMic,
  FiMicOff,
  FiBarChart2,
  FiDownload,
  FiPaperclip,
  FiCpu,
  FiZap,
  FiBell,
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

const TABS = [
  "expenses",
  "balances",
  "history",
  "chat",
  "spending",
  "pay-me",
  "video",
];

export default function GroupDetail() {
  const { id: groupId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useSelector((state) => state.auth);

  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({});
  const [settlementSummary, setSettlementSummary] = useState({
    suggestions: [],
    settlements: [],
  });
  const [history, setHistory] = useState([]);
  const requestedTab = searchParams.get("tab");
  const initialTab = TABS.includes(requestedTab) ? requestedTab : "expenses";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [expenseSubTab, setExpenseSubTab] = useState("expenses"); // ✅ new
  const [expenseFilter, setExpenseFilter] = useState("all"); // ✅ new
  const [unpaidFilter, setUnpaidFilter] = useState("all");
  const [settlementFilter, setSettlementFilter] = useState("all"); // ✅ new
  const [settlementToFilter, setSettlementToFilter] = useState("all"); // ✅ new
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [settlementModal, setSettlementModal] = useState(null);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementNote, setSettlementNote] = useState("");
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
  const [videoRoom, setVideoRoom] = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [showVideoIframe, setShowVideoIframe] = useState(false);
  const [wishAmount, setWishAmount] = useState("");

  // ── Chat state ────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const pusherRef = useRef(null);

  // ── Attachment menu ───────────────────────────────────────────────────────
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Audio recording ───────────────────────────────────────────────────────
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // ── Poll modal ────────────────────────────────────────────────────────────
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollCreating, setPollCreating] = useState(false);

  // ── AI Expense Assistant ──────────────────────────────────────────────────
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    {
      role: "bot",
      text: '👋 Hi! Main aapka AI Expense Assistant hoon.\n\nBas natural language mein batao — Hindi, English, ya Hinglish sab chalega!\n\n**Example:**\n• "Sahil ne dinner pay kiya 1200 ka"\n• "Maine petrol bhara 500 ka"\n• "Pizza 1500 Vikas ne pay kiya 60% mera 40% Sahil ka"',
    },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState(null); // parsed expense to confirm
  const aiChatEndRef = useRef(null);

  const fetchVideoRoom = async () => {
    setVideoError("");
    setVideoLoading(true);
    try {
      const res = await getGroupVideoRoom(groupId);
      setVideoRoom(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setVideoRoom(null);
      } else {
        setVideoError(err.response?.data?.error || "Unable to load video room");
      }
    } finally {
      setVideoLoading(false);
    }
  };

  const handleCreateVideoRoom = async () => {
    setVideoError("");
    setVideoLoading(true);
    try {
      const res = await createGroupVideoRoom(groupId);
      setVideoRoom(res.data);
      setShowVideoIframe(true);
      toast.success(
        "Video room created. Share the invite link with group members.",
      );
    } catch (err) {
      setVideoError(err.response?.data?.error || "Unable to create video room");
    } finally {
      setVideoLoading(false);
    }
  };

  const copyVideoInvite = async () => {
    if (!videoRoom?.inviteLink) return;
    await navigator.clipboard.writeText(videoRoom.inviteLink);
    toast.success("Invite link copied to clipboard");
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (requestedTab && TABS.includes(requestedTab) && requestedTab !== activeTab) {
      setActiveTab(requestedTab);
      return;
    }

    if (!requestedTab && activeTab !== "expenses") {
      setActiveTab("expenses");
    }
  }, [requestedTab, activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);

    if (tab === "expenses") {
      setSearchParams({}, { replace: true });
      return;
    }

    setSearchParams({ tab }, { replace: true });
  };

  useEffect(() => {
    if (activeTab === "pay-me") {
      fetchAll();
    }
  }, [activeTab]);

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

    channel.bind("poll-update", (updatedMsg) => {
      setChatMessages((prev) =>
        prev.map((m) => (m._id === updatedMsg._id ? updatedMsg : m)),
      );
    });

    return () => {
      pusherRef.current?.unsubscribe(`group-${groupId}`);
      pusherRef.current?.disconnect();
    };
  }, [activeTab, groupId]);

  // ── Load video room when the video tab is opened ───────────────────────────
  useEffect(() => {
    if (activeTab === "video") {
      fetchVideoRoom();
    }
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
    } catch (err) {
      toast.error(err.response?.data?.error || "Cannot delete");
    }
  };

  // ── Send media file ───────────────────────────────────────────────────────
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = null; // reset input
    setShowAttachMenu(false);
    setChatSending(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await sendChatMedia(groupId, fd);
    } catch {
      toast.error("Failed to send file");
    } finally {
      setChatSending(false);
    }
  };

  // ── Audio recording ───────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        setChatSending(true);
        try {
          const fd = new FormData();
          fd.append("file", file);
          await sendChatMedia(groupId, fd);
        } catch {
          toast.error("Failed to send audio");
        } finally {
          setChatSending(false);
        }
      };
      mr.start();
      setRecordingAudio(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(
        () => setRecordingTime((t) => t + 1),
        1000,
      );
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordingTimerRef.current);
    setRecordingAudio(false);
    setRecordingTime(0);
  };

  // ── Poll create ───────────────────────────────────────────────────────────
  const handleCreatePoll = async () => {
    if (!pollQuestion.trim()) return toast.error("Enter a question");
    const opts = pollOptions.filter((o) => o.trim());
    if (opts.length < 2) return toast.error("Add at least 2 options");
    setPollCreating(true);
    try {
      await createPoll(groupId, {
        question: pollQuestion.trim(),
        options: opts,
      });
      setShowPollModal(false);
      setPollQuestion("");
      setPollOptions(["", ""]);
    } catch {
      toast.error("Failed to create poll");
    } finally {
      setPollCreating(false);
    }
  };

  // ── Poll vote ─────────────────────────────────────────────────────────────
  const handleVote = async (msgId, optionIndex) => {
    try {
      const res = await voteOnPoll(groupId, msgId, optionIndex);
      setChatMessages((prev) =>
        prev.map((m) => (m._id === msgId ? res.data : m)),
      );
    } catch {
      toast.error("Vote failed");
    }
  };

  // ── AI Expense Assistant handlers ─────────────────────────────────────────
  const handleAISend = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = aiInput.trim();
    setAiInput("");
    setAiMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setAiLoading(true);
    setAiPreview(null);
    try {
      // Build history from current messages (exclude welcome message at index 0)
      const history = aiMessages
        .slice(1)
        .map((m) => ({ role: m.role, text: m.text }));
      const res = await aiAssistExpense(groupId, userMsg, history);
      const data = res.data;
      if (data.action === "ADD_EXPENSE") {
        const payer = groupMembers?.find((m) => (m._id || m) === data.paidBy);
        const memberNames = (data.splitBetween || [])
          .map(
            (id) => groupMembers?.find((m) => (m._id || m) === id)?.name || id,
          )
          .join(", ");
        setAiPreview(data);
        setAiMessages((prev) => [
          ...prev,
          {
            role: "bot",
            text: `✅ **Expense parsed!**\n\n📝 **${data.description}**\n💰 ₹${data.amount}\n👤 Paid by: ${payer?.name || data.paidBy}\n🔀 Split: ${data.splitType}\n👥 Among: ${memberNames || "All members"}`,
            isPreview: true,
          },
        ]);
      } else if (data.action === "ASK_USER") {
        setAiMessages((prev) => [
          ...prev,
          { role: "bot", text: data.question },
        ]);
      } else {
        setAiMessages((prev) => [
          ...prev,
          { role: "bot", text: "Kuch samajh nahi aaya, dobara try karo!" },
        ]);
      }
    } catch (err) {
      console.error("AI Error:", err);
      const msg =
        err?.response?.data?.details || err?.message || "Unknown error";
      setAiMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: `❌ Error: ${msg}\n\nServer check karo ya thodi der baad try karo.`,
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAIConfirm = async () => {
    if (!aiPreview) return;
    try {
      await addExpense({
        description: aiPreview.description,
        amount: parseFloat(aiPreview.amount),
        groupId,
        paidBy: aiPreview.paidBy,
        splitType: (aiPreview.splitType || "equal").toLowerCase(),
        members: aiPreview.splitBetween?.length
          ? aiPreview.splitBetween
          : groupMembers?.map((m) => m._id || m),
        splits: aiPreview.splits || [],
      });
      toast.success("✅ Expense added by AI!");
      setAiPreview(null);
      setAiMessages((prev) => [
        ...prev,
        { role: "bot", text: "🎉 Expense successfully add ho gaya! 🚀" },
      ]);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add expense");
    }
  };

  const handleAIReject = () => {
    setAiPreview(null);
    setAiMessages((prev) => [
      ...prev,
      { role: "bot", text: "↩️ Ok! Modify karke dobara batao." },
    ]);
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
    setSettlementNote(settlement.note || ""); // ← ye add karo
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
        note: settlementNote,
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
  const receivables = settlementSummary.receivables || [];
  const totalUserDebt = userDebts.reduce(
    (t, d) => t + Number(d.amount || 0),
    0,
  );
  const currentUserId = user?.id || user?._id;

  const getSettlementText = (s) => {
    const paidById = s.paidBy?._id || s.paidBy?.id;
    const paidToId = s.paidTo?._id || s.paidTo?.id;
    const payerName = paidById === currentUserId ? "You" : s.paidBy?.name;
    const payeeName = paidToId === currentUserId ? "you" : s.paidTo?.name;
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
            onClick={() => handleTabChange(tab)}
            className={`py-3 px-4 text-sm font-medium capitalize border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === tab
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {tab === "chat" && <FiMessageCircle size={14} />}
            {tab === "spending" && <FiActivity size={14} />}
            {tab === "pay-me" && <FiCreditCard size={14} />}
            {tab === "pay-me" ? "Pay me" : tab}
          </button>
        ))}
      </div>

      {/* ── Tab Content ─────────────────────────────────────────── */}
      <div
        className={`max-w-2xl mx-auto px-4 sm:px-6 ${activeTab === "chat" ? "py-0" : "py-6"}`}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
            <p className="text-gray-400 animate-pulse">
              Loading group details...
            </p>
          </div>
        ) : activeTab === "expenses" ? (
          /* ── EXPENSES TAB ──────────────────────────────────────── */
          <div className="space-y-3 py-6">
            {/* ── Sub tabs: Expenses | Settlements ── */}
            {/* ── Sub tabs: Expenses | Settlements ── */}
            <div className="flex gap-2 bg-gray-900 border border-gray-800 rounded-2xl p-1">
              <button
                onClick={() => {
                  setExpenseSubTab("expenses");
                  setExpenseFilter("all");
                  setUnpaidFilter("all");
                }}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition ${
                  expenseSubTab === "expenses"
                    ? "bg-emerald-500 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                💸 Expenses
              </button>
              <button
                onClick={() => {
                  setExpenseSubTab("settlements");
                  setSettlementFilter("all");
                }}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition ${
                  expenseSubTab === "settlements"
                    ? "bg-emerald-500 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                ✅ Settlements
              </button>
            </div>

            {/* ── Filter by member ── */}
            <div className="pb-1">
              {expenseSubTab === "expenses" ? (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <div className="flex gap-2 min-w-max">
                      <button
                        onClick={() => setExpenseFilter("all")}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
                          expenseFilter === "all"
                            ? "bg-emerald-500 text-white"
                            : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
                        }`}
                      >
                        All
                      </button>

                      {groupMembers.map((member) => (
                        <button
                          key={member._id || member}
                          onClick={() =>
                            setExpenseFilter(
                              member._id?.toString() || member?.toString(),
                            )
                          }
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
                            expenseFilter ===
                            (member._id?.toString() || member?.toString())
                              ? "bg-emerald-500 text-white"
                              : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
                          }`}
                        >
                          {member.name || "Member"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gray-900 border border-gray-800 rounded-2xl px-3 py-3">
                    <label className="text-xs text-gray-500 mb-2 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                      Unpaid by
                    </label>
                    <select
                      value={unpaidFilter}
                      onChange={(e) => setUnpaidFilter(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-400 transition"
                    >
                      <option value="all">All members</option>
                      {groupMembers.map((member) => {
                        const memberId =
                          member._id?.toString() || member?.toString();
                        return (
                          <option key={memberId} value={memberId}>
                            {member.name || "Member"}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex gap-2 min-w-max">
                    <div className="space-y-2">
                      {/* FROM filter */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1.5 font-medium">
                          From (who paid):
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => setSettlementFilter("all")}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
                              settlementFilter === "all"
                                ? "bg-emerald-500 text-white"
                                : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
                            }`}
                          >
                            All
                          </button>
                          {groupMembers.map((member) => (
                            <button
                              key={member._id || member}
                              onClick={() =>
                                setSettlementFilter(
                                  member._id?.toString() || member?.toString(),
                                )
                              }
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
                                settlementFilter ===
                                (member._id?.toString() || member?.toString())
                                  ? "bg-emerald-500 text-white"
                                  : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
                              }`}
                            >
                              {member.name || "Member"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* TO filter */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1.5 font-medium">
                          To (who received):
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => setSettlementToFilter("all")}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
                              settlementToFilter === "all"
                                ? "bg-blue-500 text-white"
                                : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
                            }`}
                          >
                            All
                          </button>
                          {groupMembers.map((member) => (
                            <button
                              key={member._id || member}
                              onClick={() =>
                                setSettlementToFilter(
                                  member._id?.toString() || member?.toString(),
                                )
                              }
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
                                settlementToFilter ===
                                (member._id?.toString() || member?.toString())
                                  ? "bg-blue-500 text-white"
                                  : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
                              }`}
                            >
                              {member.name || "Member"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
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

            {/* Filter based on sub tab */}
            {(() => {
              const getMemberId = (value) =>
                value?._id?.toString() ||
                value?.id?.toString() ||
                value?.toString();

              const isExpensePaidByMember = (expense, memberId) => {
                if (!memberId || memberId === "all") return true;
                if (expense.paidByMultiple?.length > 0) {
                  return expense.paidByMultiple.some(
                    (payer) =>
                      getMemberId(payer.user) === memberId &&
                      Number(payer.amount || 0) > 0,
                  );
                }
                return getMemberId(expense.paidBy) === memberId;
              };

              const getSplitForMember = (expense, memberId) =>
                expense.splits?.find(
                  (split) => getMemberId(split.user) === memberId,
                );

              const isMemberUnpaidForExpense = (expense, memberId) => {
                if (!memberId || memberId === "all") return true;
                const split = getSplitForMember(expense, memberId);
                if (!split) return false;
                if (isExpensePaidByMember(expense, memberId)) return false;
                return !split.settled;
              };

              const filteredItems =
                expenseSubTab === "expenses"
                  ? activityItems
                      .filter((i) => i.type === "expense")
                      .filter((i) => {
                        const paidByMatches = isExpensePaidByMember(
                          i.data,
                          expenseFilter,
                        );
                        const unpaidMatches = isMemberUnpaidForExpense(
                          i.data,
                          unpaidFilter,
                        );
                        return paidByMatches && unpaidMatches;
                      })
                  : activityItems
                      .filter((i) => i.type === "settlement")
                      .filter((i) => {
                        const paidById =
                          i.data.paidBy?._id?.toString() ||
                          i.data.paidBy?.toString();
                        const paidToId =
                          i.data.paidTo?._id?.toString() ||
                          i.data.paidTo?.toString();
                        const fromMatch =
                          settlementFilter === "all" ||
                          paidById === settlementFilter;
                        const toMatch =
                          settlementToFilter === "all" ||
                          paidToId === settlementToFilter;
                        return fromMatch && toMatch;
                      });

              if (filteredItems.length === 0) {
                return (
                  <div className="text-center py-20">
                    <div className="text-5xl mb-4">💸</div>
                    <p className="text-gray-400">
                      {expenseSubTab === "expenses"
                        ? "No expenses found"
                        : "No settlements found"}
                    </p>
                  </div>
                );
              }

              const total = filteredItems.reduce(
                (sum, i) => sum + Number(i.data.amount || 0),
                0,
              );

              const unpaidSelectionTotal =
                unpaidFilter !== "all"
                  ? filteredItems.reduce((sum, item) => {
                      const split = getSplitForMember(item.data, unpaidFilter);
                      return sum + Number(split?.amount || 0);
                    }, 0)
                  : 0;

              const filterMember =
                expenseFilter !== "all"
                  ? groupMembers.find(
                      (m) =>
                        (m._id?.toString() || m?.toString()) === expenseFilter,
                    )
                  : null;
              const unpaidMember =
                unpaidFilter !== "all"
                  ? groupMembers.find(
                      (m) =>
                        (m._id?.toString() || m?.toString()) === unpaidFilter,
                    )
                  : null;
              const fromMember =
                settlementFilter !== "all"
                  ? groupMembers.find(
                      (m) =>
                        (m._id?.toString() || m?.toString()) ===
                        settlementFilter,
                    )
                  : null;
              const toMember =
                settlementToFilter !== "all"
                  ? groupMembers.find(
                      (m) =>
                        (m._id?.toString() || m?.toString()) ===
                        settlementToFilter,
                    )
                  : null;

              return (
                <>
                  {unpaidMember && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm text-red-300 font-medium">
                          {filteredItems.length} unpaid expense
                          {filteredItems.length !== 1 ? "s" : ""} by{" "}
                          {unpaidMember.name || "Member"}
                        </span>
                      </div>
                      <span className="text-red-400 font-bold text-base">
                        ₹{unpaidSelectionTotal.toFixed(2)} unpaid
                      </span>
                    </div>
                  )}

                  {filteredItems.map((item) => {
                    if (item.type === "settlement") {
                      const s = item.data;
                      return (
                        <SettlementCard
                          key={item.id}
                          s={s}
                          item={item}
                          getSettlementText={getSettlementText}
                          openSettlementModal={openSettlementModal}
                          currentUserId={currentUserId}
                          userDebts={userDebts}
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
                                  "/group/" +
                                    groupId +
                                    "/edit-expense/" +
                                    exp._id,
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
                                : (exp.paidBy?._id || exp.paidBy) ===
                                  splitUserId;
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
                  })}

                  {/* ── Total summary ── */}
                  {expenseSubTab === "expenses" ? (
                    <div className="bg-gray-900 border border-emerald-500/20 rounded-2xl px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-gray-400">
                        Total paid by{" "}
                        <span className="text-white font-medium">
                          {filterMember ? filterMember.name : "Everyone"}
                        </span>
                      </span>
                      <span className="font-bold text-emerald-400 text-sm">
                        ₹{total.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <div className="bg-gray-900 border border-emerald-500/20 rounded-2xl px-4 py-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">
                          {fromMember ? (
                            <>
                              <span className="text-white font-medium">
                                {fromMember.name}
                              </span>{" "}
                              paid{" "}
                              {toMember ? (
                                <span className="text-white font-medium">
                                  {toMember.name}
                                </span>
                              ) : (
                                "everyone"
                              )}
                            </>
                          ) : (
                            <>
                              Total settlements{" "}
                              {toMember ? (
                                <>
                                  to{" "}
                                  <span className="text-white font-medium">
                                    {toMember.name}
                                  </span>
                                </>
                              ) : (
                                ""
                              )}
                            </>
                          )}
                        </span>
                        <span className="font-bold text-emerald-400 text-sm">
                          ₹{total.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {filteredItems.length} settlement
                        {filteredItems.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
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

                      // ── Message content renderer ──
                      const renderContent = () => {
                        if (msg.type === "image")
                          return (
                            <img
                              src={msg.fileUrl}
                              alt="image"
                              className="max-w-[220px] rounded-xl cursor-pointer"
                              onClick={() => window.open(msg.fileUrl, "_blank")}
                            />
                          );
                        if (msg.type === "video")
                          return (
                            <video
                              src={msg.fileUrl}
                              controls
                              className="max-w-[220px] rounded-xl"
                            />
                          );
                        if (msg.type === "audio")
                          return (
                            <audio
                              src={msg.fileUrl}
                              controls
                              className="max-w-[220px]"
                            />
                          );
                        if (msg.type === "file")
                          return (
                            <a
                              href={msg.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 text-sm underline"
                            >
                              <FiFile size={16} />
                              <span className="truncate max-w-[160px]">
                                {msg.fileName || "Download file"}
                              </span>
                              <FiDownload size={14} />
                            </a>
                          );
                        if (msg.type === "poll") {
                          const totalVotes =
                            msg.poll?.options?.reduce(
                              (s, o) => s + (o.votes?.length || 0),
                              0,
                            ) || 0;
                          const myVote = msg.poll?.options?.findIndex((o) =>
                            o.votes?.some((v) => (v._id || v) === user?.id),
                          );
                          return (
                            <div className="min-w-[200px]">
                              <p className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                                <FiBarChart2 size={14} className="shrink-0" />
                                {msg.poll?.question}
                              </p>
                              <div className="space-y-2">
                                {msg.poll?.options?.map((opt, oi) => {
                                  const pct =
                                    totalVotes > 0
                                      ? Math.round(
                                          ((opt.votes?.length || 0) /
                                            totalVotes) *
                                            100,
                                        )
                                      : 0;
                                  const voted = myVote === oi;
                                  return (
                                    <button
                                      key={oi}
                                      onClick={() => handleVote(msg._id, oi)}
                                      className={`w-full text-left rounded-xl overflow-hidden border transition ${
                                        voted
                                          ? "border-emerald-500"
                                          : "border-gray-600 hover:border-gray-400"
                                      }`}
                                    >
                                      <div className="relative px-3 py-2">
                                        <div
                                          className="absolute inset-0 bg-emerald-500/20 transition-all"
                                          style={{ width: `${pct}%` }}
                                        />
                                        <div className="relative flex justify-between items-center">
                                          <span className="text-xs font-medium">
                                            {opt.text}
                                          </span>
                                          <span className="text-xs text-gray-400 ml-2">
                                            {pct}%
                                          </span>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                              <p className="text-xs text-gray-400 mt-2">
                                {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
                              </p>
                            </div>
                          );
                        }
                        return <p className="break-words">{msg.message}</p>;
                      };

                      return (
                        <div
                          key={msg._id}
                          className={`flex items-end gap-2 mb-1 group ${isMe ? "flex-row-reverse" : "flex-row"}`}
                        >
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
                            {showName && (
                              <p className="text-xs text-gray-500 mb-1 px-1">
                                {msg.sender?.name}
                              </p>
                            )}
                            <div
                              className={`relative rounded-2xl text-sm leading-relaxed ${
                                msg.type === "poll"
                                  ? isMe
                                    ? "bg-emerald-900/60 text-white px-4 py-3 rounded-br-md"
                                    : "bg-gray-800 text-gray-100 px-4 py-3 rounded-bl-md"
                                  : msg.type === "image" || msg.type === "video"
                                    ? "overflow-hidden"
                                    : isMe
                                      ? "bg-emerald-600 text-white px-4 py-2.5 rounded-br-md"
                                      : "bg-gray-800 text-gray-100 px-4 py-2.5 rounded-bl-md"
                              }`}
                            >
                              {renderContent()}
                              {msg.type !== "poll" && (
                                <p
                                  className={`text-xs mt-1 ${
                                    msg.type === "image" || msg.type === "video"
                                      ? "px-2 pb-1 text-gray-300"
                                      : isMe
                                        ? "text-emerald-200"
                                        : "text-gray-500"
                                  }`}
                                >
                                  {formatTime(msg.createdAt)}
                                </p>
                              )}
                              {isMe && (
                                <button
                                  onClick={() => handleDeleteMessage(msg._id)}
                                  className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-red-500 text-white hidden group-hover:flex items-center justify-center transition"
                                  title="Delete"
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

            {/* ── Hidden file inputs ───────────────────────────── */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* ── Input bar ────────────────────────────────────── */}
            <div className="border-t border-gray-800 py-3 bg-gray-950">
              {/* Attachment popup menu */}
              {showAttachMenu && (
                <div className="mb-3 p-2 bg-gray-900 border border-gray-700 rounded-2xl flex gap-2 flex-wrap">
                  {[
                    {
                      icon: <FiImage size={18} />,
                      label: "Image",
                      color: "text-blue-400",
                      action: () => {
                        setShowAttachMenu(false);
                        imageInputRef.current?.click();
                      },
                    },
                    {
                      icon: <FiVideo size={18} />,
                      label: "Video",
                      color: "text-purple-400",
                      action: () => {
                        setShowAttachMenu(false);
                        videoInputRef.current?.click();
                      },
                    },
                    {
                      icon: <FiFile size={18} />,
                      label: "Document",
                      color: "text-yellow-400",
                      action: () => {
                        setShowAttachMenu(false);
                        fileInputRef.current?.click();
                      },
                    },
                    {
                      icon: <FiBarChart2 size={18} />,
                      label: "Poll",
                      color: "text-emerald-400",
                      action: () => {
                        setShowAttachMenu(false);
                        setShowPollModal(true);
                      },
                    },
                  ].map(({ icon, label, color, action }) => (
                    <button
                      key={label}
                      onClick={action}
                      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition ${color}`}
                    >
                      {icon}
                      <span className="text-xs text-gray-300">{label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Recording indicator */}
              {recordingAudio && (
                <div className="mb-2 flex items-center gap-2 text-red-400 text-sm">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Recording... {recordingTime}s
                </div>
              )}

              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-2"
              >
                {/* + Attach button */}
                <button
                  type="button"
                  onClick={() => setShowAttachMenu((v) => !v)}
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center transition shrink-0 ${
                    showAttachMenu
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  <FiPlus
                    size={18}
                    className={`transition-transform ${showAttachMenu ? "rotate-45" : ""}`}
                  />
                </button>

                {/* Text input */}
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={
                    recordingAudio ? "Recording audio..." : "Type a message..."
                  }
                  disabled={recordingAudio}
                  className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition placeholder-gray-600 disabled:opacity-50"
                  maxLength={1000}
                />

                {/* Mic button */}
                <button
                  type="button"
                  onClick={recordingAudio ? stopRecording : startRecording}
                  disabled={chatSending}
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center transition shrink-0 disabled:opacity-40 ${
                    recordingAudio
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  {recordingAudio ? (
                    <FiMicOff size={16} />
                  ) : (
                    <FiMic size={16} />
                  )}
                </button>

                {/* Send button */}
                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatSending || recordingAudio}
                  className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl flex items-center justify-center transition shrink-0"
                >
                  {chatSending ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FiSend size={16} />
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : activeTab === "spending" ? (
          /* ── SPENDING TAB ──────────────────────────────────────── */
          <SpendingTab expenses={expenses} groupMembers={groupMembers} />
        ) : activeTab === "pay-me" ? (
          /* ── PAY ME TAB ─────────────────────────────────────────── */
          <PayMeTab receivables={receivables} />
        ) : activeTab === "video" ? (
          /* ── VIDEO CHAT TAB ─────────────────────────────────────── */
          <div className="space-y-4 py-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Group Video Call</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Free group video chat using Jitsi Meet. Only signed-in group
                    members can create and open the call.
                  </p>
                </div>
                <button
                  onClick={handleCreateVideoRoom}
                  disabled={videoLoading}
                  className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white py-3 px-4 rounded-xl text-sm font-medium transition disabled:opacity-50"
                >
                  {videoLoading ? "Starting call..." : "Start / Open call"}
                </button>
              </div>

              {videoError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 text-sm text-red-200">
                  {videoError}
                </div>
              )}

              {videoRoom ? (
                <div className="space-y-4">
                  <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4">
                    <p className="text-xs text-gray-500 mb-2">
                      Invite link for group members
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        readOnly
                        value={videoRoom.inviteLink}
                        className="flex-1 bg-gray-900 border border-gray-800 text-white rounded-2xl px-4 py-3 text-sm focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={copyVideoInvite}
                        className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-2xl text-sm font-medium transition"
                      >
                        Copy link
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => setShowVideoIframe(true)}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-2xl text-sm font-medium transition"
                    >
                      Join call in app
                    </button>
                    <a
                      href={videoRoom.meetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center w-full bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-2xl text-sm font-medium transition"
                    >
                      Open in Jitsi
                    </a>
                  </div>

                  <div className="rounded-3xl overflow-hidden border border-gray-800 bg-black">
                    <div className="px-4 py-3 border-b border-gray-800 bg-gray-950 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          Room: {videoRoom.roomId}
                        </p>
                        <p className="text-xs text-gray-500">
                          Share only with group members.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowVideoIframe((prev) => !prev)}
                        className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-xl text-xs"
                      >
                        {showVideoIframe ? "Hide live view" : "Show live view"}
                      </button>
                    </div>
                    {showVideoIframe ? (
                      <iframe
                        title="Group video call"
                        src={`https://meet.jit.si/${videoRoom.roomId}`}
                        className="w-full h-[70vh]"
                        allow="camera; microphone; fullscreen; display-capture"
                      />
                    ) : (
                      <div className="p-6 text-gray-400 text-sm">
                        Click <strong>Join call in app</strong> to open the
                        embedded meeting window.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 text-sm text-gray-400">
                  No active video room exists yet. Click start to create a
                  secure group call.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* ══ POLL MODAL ══════════════════════════════════════════════ */}
      {showPollModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FiBarChart2 className="text-emerald-400" /> Create Poll
              </h2>
              <button
                onClick={() => setShowPollModal(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Question
                </label>
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Ask something..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-2 block">
                  Options
                </label>
                <div className="space-y-2">
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const copy = [...pollOptions];
                          copy[i] = e.target.value;
                          setPollOptions(copy);
                        }}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition"
                        maxLength={100}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          onClick={() =>
                            setPollOptions(
                              pollOptions.filter((_, j) => j !== i),
                            )
                          }
                          className="text-gray-500 hover:text-red-400 transition"
                        >
                          <FiX size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {pollOptions.length < 6 && (
                  <button
                    onClick={() => setPollOptions([...pollOptions, ""])}
                    className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
                  >
                    <FiPlus size={12} /> Add option
                  </button>
                )}
              </div>

              <button
                onClick={handleCreatePoll}
                disabled={pollCreating}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2"
              >
                {pollCreating ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FiBarChart2 size={16} />
                )}
                {pollCreating ? "Creating..." : "Create Poll"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                📝 Remarks (optional)
              </label>
              <input
                type="text"
                value={settlementNote}
                onChange={(e) => setSettlementNote(e.target.value)}
                placeholder="e.g., For dinner, electricity bill..."
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition text-sm placeholder-gray-600"
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

      {/* ── AI Expense Assistant Floating Button ───────────────────────────── */}
      <button
        onClick={() => setShowAIChat(true)}
        style={{
          position: "fixed",
          bottom: "88px",
          right: "20px",
          zIndex: 9999,
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 24px rgba(99,102,241,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        title="AI Expense Assistant"
      >
        <span style={{ fontSize: "24px" }}>🤖</span>
      </button>

      {/* ── AI Expense Assistant Modal ─────────────────────────────────────── */}
      {showAIChat && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#0f172a",
              borderRadius: "24px 24px 0 0",
              width: "100%",
              maxWidth: "480px",
              height: "85vh",
              display: "flex",
              flexDirection: "column",
              border: "1px solid rgba(99,102,241,0.3)",
              boxShadow: "0 -8px 40px rgba(99,102,241,0.2)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))",
                borderRadius: "24px 24px 0 0",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                }}
              >
                🤖
              </div>
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    margin: 0,
                    fontWeight: 700,
                    color: "#fff",
                    fontSize: "15px",
                  }}
                >
                  AI Expense Assistant
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#a78bfa" }}>
                  Hindi • English • Hinglish
                </p>
              </div>
              <button
                onClick={() => setShowAIChat(false)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#fff",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  cursor: "pointer",
                  fontSize: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
            {/* Messages */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {aiMessages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "85%",
                      padding: "12px 16px",
                      borderRadius:
                        msg.role === "user"
                          ? "18px 18px 4px 18px"
                          : "18px 18px 18px 4px",
                      background:
                        msg.role === "user"
                          ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                          : "rgba(255,255,255,0.07)",
                      color: "#fff",
                      fontSize: "14px",
                      lineHeight: "1.6",
                      border:
                        msg.role === "user"
                          ? "none"
                          : "1px solid rgba(255,255,255,0.1)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {msg.text.replace(/\*\*(.*?)\*\*/g, "$1")}
                  </div>
                  {msg.isPreview && aiPreview && (
                    <div
                      style={{ display: "flex", gap: "8px", marginTop: "4px" }}
                    >
                      <button
                        onClick={handleAIConfirm}
                        style={{
                          background:
                            "linear-gradient(135deg, #10b981, #059669)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "12px",
                          padding: "8px 20px",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: "14px",
                        }}
                      >
                        ✅ Confirm
                      </button>
                      <button
                        onClick={handleAIReject}
                        style={{
                          background: "rgba(239,68,68,0.2)",
                          color: "#f87171",
                          border: "1px solid rgba(239,68,68,0.3)",
                          borderRadius: "12px",
                          padding: "8px 20px",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: "14px",
                        }}
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {aiLoading && (
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: "18px 18px 18px 4px",
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    alignSelf: "flex-start",
                  }}
                >
                  <span style={{ color: "#a78bfa" }}>⚡ Thinking...</span>
                </div>
              )}
              <div ref={aiChatEndRef} />
            </div>
            {/* Input */}
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                gap: "10px",
                alignItems: "center",
              }}
            >
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleAISend()
                }
                placeholder='e.g. "Sahil ne dinner pay kiya 1200 ka"'
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "14px",
                  padding: "12px 16px",
                  color: "#fff",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              <button
                onClick={handleAISend}
                disabled={aiLoading || !aiInput.trim()}
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  background: aiInput.trim()
                    ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                    : "rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                }}
              >
                🚀
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
    userDebts,
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

    // ✅ splits se current user ka share nikalo
    const getUserShare = (exp) => {
      if (!exp.splits?.length) return Number(exp.amount || 0);
      const split = exp.splits.find((sp) => {
        const uid = sp.user?._id?.toString() || sp.user?.toString();
        return uid === (isCurrentUserPayer ? currentUserId : payerId);
      });
      return split ? Number(split.amount) : Number(exp.amount || 0);
    };

    // ✅ userDebts se "Sahil ne mujhe diya" wala data nikalo
    const otherPersonId = isCurrentUserPayer ? payeeId : payerId;
    const debtEntry = (userDebts || []).find((d) => d.id === otherPersonId);
    const creditsFromThem = debtEntry?.creditsFromThem || [];

    const youOweTotal = allExpenses.reduce(
      (sum, e) => sum + getUserShare(e),
      0,
    );
    const theyOweTotal = creditsFromThem.reduce(
      (sum, e) => sum + Number(e.theirShare || 0),
      0,
    );

    return (
      <div className="bg-gray-900 border border-emerald-500/30 hover:border-emerald-400 rounded-2xl p-4 transition">
        {/* ── Main row ── */}
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
              {s.note && (
                <p className="text-xs text-purple-300 mt-0.5 truncate">
                  📝 {s.note}
                </p>
              )}
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

        {/* ── Show more button ── */}
        {(allExpenses.length > 0 || creditsFromThem.length > 0) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMore(!showMore);
            }}
            className="mt-2 text-xs text-emerald-400/70 hover:text-emerald-300 underline underline-offset-2 transition"
          >
            {showMore ? "▲ Hide details" : "▼ Show more details"}
          </button>
        )}

        {/* ── Full Breakdown ── */}
        {showMore && (
          <div className="mt-3 bg-black/20 rounded-xl p-3 space-y-3 text-xs">
            {/* Header */}
            <p className="font-semibold text-emerald-200 text-sm">
              📊 {isCurrentUserPayer ? "You" : s.paidBy?.name} ↔{" "}
              {isCurrentUserPayee ? "you" : s.paidTo?.name}
            </p>

            {/* ➕ You owe them */}
            {allExpenses.length > 0 && (
              <div>
                <p className="text-red-300/80 mb-1 font-medium">
                  ➕ {isCurrentUserPayer ? "You owe" : `${s.paidBy?.name} owes`}{" "}
                  {isCurrentUserPayee ? "you" : s.paidTo?.name} for:
                </p>
                <div className="space-y-1 pl-1">
                  {allExpenses.map((exp, idx) => (
                    <div
                      key={exp._id || idx}
                      className="flex justify-between text-gray-300"
                    >
                      <span className="truncate max-w-[65%]">
                        • {exp.description}
                      </span>
                      <span className="text-red-300 shrink-0">
                        ₹{getUserShare(exp).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold text-red-300 border-t border-white/10 pt-1 mt-1">
                    <span>Subtotal</span>
                    <span>₹{youOweTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ➖ They owe you (creditsFromThem) */}
            {creditsFromThem.length > 0 && (
              <div>
                <p className="text-emerald-300/80 mb-1 font-medium">
                  ➖ {isCurrentUserPayee ? "You owe" : `${s.paidTo?.name} owes`}{" "}
                  {isCurrentUserPayer ? "you" : s.paidBy?.name} for:
                </p>
                <div className="space-y-1 pl-1">
                  {creditsFromThem.map((exp, idx) => (
                    <div
                      key={exp.id || idx}
                      className="flex justify-between text-gray-300"
                    >
                      <span className="truncate max-w-[65%]">
                        • {exp.description}
                      </span>
                      <span className="text-emerald-300 shrink-0">
                        ₹{Number(exp.theirShare).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold text-emerald-300 border-t border-white/10 pt-1 mt-1">
                    <span>Subtotal</span>
                    <span>₹{theyOweTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Final calculation ── */}
            <div className="bg-black/30 rounded-lg px-3 py-2 space-y-1">
              {allExpenses.length > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span>
                    {isCurrentUserPayer ? "You owe" : `${s.paidBy?.name} owes`}{" "}
                    {isCurrentUserPayee ? "you" : s.paidTo?.name}
                  </span>
                  <span className="text-red-300">
                    ₹{youOweTotal.toFixed(2)}
                  </span>
                </div>
              )}
              {creditsFromThem.length > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span>
                    {isCurrentUserPayee ? "You" : s.paidTo?.name} owe
                    {isCurrentUserPayee ? "" : "s"} back
                  </span>
                  <span className="text-emerald-300">
                    - ₹{theyOweTotal.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-white/10 pt-1" />
              <div className="flex justify-between font-bold text-emerald-300">
                <span>
                  Net {isCurrentUserPayer ? "you owe" : "amount paid"}
                </span>
                <span>₹{s.amount.toFixed(2)}</span>
              </div>
            </div>

            {/* ── Context line ── */}
            <div className="border-t border-white/10 pt-2">
              {isCurrentUserPayer && (
                <p className="text-emerald-300/80">
                  ✅ You paid ₹{s.amount.toFixed(2)} to {s.paidTo?.name}
                </p>
              )}
              {isCurrentUserPayee && (
                <p className="text-emerald-300/80">
                  ✅ {s.paidBy?.name} paid you ₹{s.amount.toFixed(2)}
                </p>
              )}
              {!isCurrentUserPayer && !isCurrentUserPayee && (
                <p className="text-gray-400">
                  ℹ️ {s.paidBy?.name} paid {s.paidTo?.name} ₹
                  {s.amount.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  function PayMeTab({ receivables }) {
    const [reminding, setReminding] = React.useState({});
    const rows = Array.isArray(receivables) ? receivables : [];
    const totalReceivable = rows.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );
    const hasPendingAmount = rows.some(
      (item) => Number(item.amount || 0) > 0.009,
    );

    const handleReminder = async (item) => {
      const amount = Number(item.amount || 0);
      if (amount <= 0.009 || reminding[item.memberId]) return;

      setReminding((prev) => ({ ...prev, [item.memberId]: true }));
      try {
        await sendPaymentReminder(groupId, item.memberId);
        toast.success(`Reminder sent to ${item.name || "member"}`);
      } catch (err) {
        const nextAllowedAt = err.response?.data?.nextAllowedAt;
        if (err.response?.status === 429 && nextAllowedAt) {
          const nextTime = new Date(nextAllowedAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          });
          toast.error(`Reminder already sent. Try after ${nextTime}`);
        } else {
          toast.error(err.response?.data?.msg || "Failed to send reminder");
        }
      } finally {
        setReminding((prev) => ({ ...prev, [item.memberId]: false }));
      }
    };

    if (rows.length === 0 || !hasPendingAmount) {
      return (
        <div className="py-6">
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <FiCheckCircle className="text-emerald-400" size={26} />
            </div>
            <p className="text-gray-400">
              No one owes you money in this group.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="py-6 space-y-4">
        <div className="bg-gray-900 border border-emerald-500/20 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                How much people should pay me
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Pending amount other members have to return.
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xl font-bold text-emerald-400">
                ₹{totalReceivable.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {rows.map((item) => {
            const amount = Number(item.amount || 0);
            return (
              <div
                key={item.memberId}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      amount > 0.009 ? "bg-emerald-500/15" : "bg-gray-800"
                    }`}
                  >
                    <FiUsers
                      className={
                        amount > 0.009 ? "text-emerald-400" : "text-gray-500"
                      }
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {item.name || "Member"} will pay me
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.email || "Group member"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <span
                    className={`font-bold text-lg shrink-0 ${
                      amount > 0.009 ? "text-emerald-400" : "text-gray-500"
                    }`}
                  >
                    ₹{amount.toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleReminder(item)}
                    disabled={amount <= 0.009 || reminding[item.memberId]}
                    className="inline-flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:border-gray-700 disabled:cursor-not-allowed text-white border border-emerald-500 px-3 py-2 rounded-xl text-xs font-semibold transition"
                  >
                    {reminding[item.memberId] ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FiBell size={13} />
                    )}
                    Reminder
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function SpendingTab({ expenses, groupMembers }) {
    const monthlyData = React.useMemo(() => {
      const months = {};
      expenses.forEach((exp) => {
        const d = new Date(exp.date || exp.createdAt);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const monthLabel = d.toLocaleString("en-IN", {
          month: "long",
          year: "numeric",
        });
        if (!months[monthKey]) {
          months[monthKey] = { label: monthLabel, expenses: [] };
        }
        months[monthKey].expenses.push(exp);
      });
      return Object.entries(months)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([, val]) => val);
    }, [expenses]);

    const getMemberId = (member) =>
      member?._id?.toString() || member?.toString();

    const getMemberSplit = (exp, member) => {
      const memberId = getMemberId(member);
      const split = exp.splits?.find((sp) => {
        const uid = sp.user?._id?.toString() || sp.user?.toString();
        return uid === memberId;
      });
      return split ? Number(split.amount) : 0;
    };

    const isPayer = (exp, member) => {
      const memberId = getMemberId(member);
      return (
        exp.paidBy?._id?.toString() === memberId ||
        exp.paidBy?.toString() === memberId
      );
    };

    if (groupMembers.length === 0) {
      return <div className="text-center py-20 text-gray-400">Loading...</div>;
    }

    return (
      <div className="py-6 space-y-10">
        {monthlyData.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-gray-400">No expenses yet</p>
          </div>
        ) : (
          monthlyData.map((month, mIdx) => {
            const memberTotals = groupMembers.map((member) => ({
              member,
              total: month.expenses.reduce(
                (sum, exp) => sum + getMemberSplit(exp, member),
                0,
              ),
            }));
            const grandTotal = memberTotals.reduce((s, m) => s + m.total, 0);
            const totalExpenses = month.expenses.reduce(
              (s, e) => s + Number(e.amount),
              0,
            );

            return (
              <div
                key={mIdx}
                className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
              >
                {/* ── Month header ── */}
                <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
                  <h3 className="font-bold text-emerald-400 text-sm sm:text-base flex items-center gap-2">
                    📅 {month.label}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {month.expenses.length} expense
                    {month.expenses.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* ── Scrollable table ── */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        {/* Sticky first column */}
                        <th className="text-left px-4 py-3 text-gray-400 font-medium min-w-[140px] sticky left-0 bg-gray-900 z-10">
                          Expense
                        </th>
                        <th className="text-right px-3 py-3 text-gray-400 font-medium min-w-[80px]">
                          Total
                        </th>
                        {groupMembers.map((member) => (
                          <th
                            key={getMemberId(member)}
                            className="text-right px-3 py-3 text-gray-400 font-medium min-w-[90px]"
                          >
                            <span className="truncate block max-w-[90px] ml-auto">
                              {member.name || "Member"}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {month.expenses.map((exp, eIdx) => (
                        <tr
                          key={exp._id || eIdx}
                          className="border-b border-gray-800/50 hover:bg-gray-800/30 transition"
                        >
                          {/* Expense name — sticky */}
                          <td className="px-4 py-3 sticky left-0 bg-gray-900 z-10">
                            <p className="text-white font-medium truncate max-w-[130px]">
                              {exp.description}
                            </p>
                            <p className="text-gray-500 text-xs mt-0.5">
                              {new Date(
                                exp.date || exp.createdAt,
                              ).toLocaleDateString("en-IN")}
                            </p>
                          </td>

                          {/* Total amount */}
                          <td className="px-3 py-3 text-right text-emerald-400 font-semibold whitespace-nowrap">
                            ₹{Number(exp.amount).toFixed(0)}
                          </td>

                          {/* Per member split */}
                          {groupMembers.map((member) => {
                            const share = getMemberSplit(exp, member);
                            const paid = isPayer(exp, member);
                            return (
                              <td
                                key={getMemberId(member)}
                                className={`px-3 py-3 text-right font-medium whitespace-nowrap ${
                                  share > 0
                                    ? paid
                                      ? "text-emerald-400"
                                      : "text-red-300"
                                    : "text-gray-600"
                                }`}
                              >
                                {share > 0 ? (
                                  <span className="flex items-center justify-end gap-1">
                                    {paid && (
                                      <span className="text-[10px] text-emerald-500 font-bold">
                                        paid
                                      </span>
                                    )}
                                    ₹{share.toFixed(0)}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* ── Monthly subtotal row ── */}
                      <tr className="border-t-2 border-gray-700 bg-gray-800/50">
                        <td className="px-4 py-3 sticky left-0 bg-gray-800/50 z-10 font-bold text-white text-xs sm:text-sm">
                          Monthly Total
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-emerald-400 whitespace-nowrap">
                          ₹{totalExpenses.toFixed(0)}
                        </td>
                        {memberTotals.map(({ member, total }) => (
                          <td
                            key={getMemberId(member)}
                            className="px-3 py-3 text-right font-bold text-amber-300 whitespace-nowrap"
                          >
                            ₹{total.toFixed(0)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ── Grand total footer ── */}
                <div className="px-4 py-3 bg-gray-800/60 border-t border-gray-700">
                  <div className="flex flex-wrap gap-x-6 gap-y-1 items-center justify-between">
                    <span className="text-xs text-gray-400">
                      Total group spend this month:
                    </span>
                    <span className="font-bold text-emerald-400 text-sm">
                      ₹{grandTotal.toFixed(2)}
                    </span>
                  </div>
                  {/* Per person summary */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {memberTotals.map(({ member, total }) => (
                      <span
                        key={getMemberId(member)}
                        className="text-xs text-gray-400"
                      >
                        {member.name}:{" "}
                        <span className="text-amber-300 font-semibold">
                          ₹{total.toFixed(0)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }
}
