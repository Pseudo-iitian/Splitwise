import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast, { Toaster } from 'react-hot-toast';
import {
  FiArrowLeft, FiPlus, FiTrash2, FiEdit2, FiHeart,
  FiShoppingBag, FiCheck, FiX, FiExternalLink,
  FiTag, FiUser, FiStar, FiFilter
} from 'react-icons/fi';
import {
  getWishlist, addWishlistItem, deleteWishlistItem,
  updateWishlistItem, voteWishlistItem, markBoughtWishlistItem
} from '../services/api';

const CATEGORIES = [
  { value: 'all',           label: 'All',           emoji: '✨' },
  { value: 'electronics',   label: 'Electronics',   emoji: '📱' },
  { value: 'food',          label: 'Food',          emoji: '🍕' },
  { value: 'travel',        label: 'Travel',        emoji: '✈️' },
  { value: 'clothing',      label: 'Clothing',      emoji: '👗' },
  { value: 'home',          label: 'Home',          emoji: '🏠' },
  { value: 'entertainment', label: 'Entertainment', emoji: '🎮' },
  { value: 'other',         label: 'Other',         emoji: '📦' },
];

const PRIORITIES = [
  { value: 'low',    label: 'Low',    color: 'text-gray-400  bg-gray-500/20  border-gray-500/30'  },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30' },
  { value: 'high',   label: 'High',   color: 'text-red-400   bg-red-500/20   border-red-500/30'   },
];

const getCatEmoji = (cat) => CATEGORIES.find(c => c.value === cat)?.emoji || '📦';
const getPriority = (p)   => PRIORITIES.find(x => x.value === p) || PRIORITIES[1];

export default function Wishlist() {
  const navigate = useNavigate();
  const { user } = useSelector(state => state.auth);

  const [items,       setItems]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [editItem,    setEditItem]    = useState(null);
  const [filterCat,   setFilterCat]   = useState('all');
  const [filterStatus,setFilterStatus]= useState('all'); // all | pending | bought
  const [members,     setMembers]     = useState([]);

  const [form, setForm] = useState({
    title: '', description: '', price: '', link: '',
    category: 'other', assignedTo: '', priority: 'medium',
  });

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try {
      const res = await getWishlist();
      setItems(res.data);
      // Collect unique members from items
      const seen = new Set();
      const mems = [];
      res.data.forEach(item => {
        if (item.addedBy && !seen.has(item.addedBy._id)) {
          seen.add(item.addedBy._id);
          mems.push(item.addedBy);
        }
      });
      setMembers(mems);
    } catch {
      toast.error('Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({ title: '', description: '', price: '', link: '', category: 'other', assignedTo: '', priority: 'medium' });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      title:       item.title       || '',
      description: item.description || '',
      price:       item.price?.toString() || '',
      link:        item.link        || '',
      category:    item.category    || 'other',
      assignedTo:  item.assignedTo?._id || '',
      priority:    item.priority    || 'medium',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Title required'); return; }
    try {
      const payload = {
        ...form,
        price:      form.price ? parseFloat(form.price) : 0,
        assignedTo: form.assignedTo || null,
      };
      if (editItem) {
        await updateWishlistItem(editItem._id, payload);
        toast.success('Item updated!');
      } else {
        await addWishlistItem(payload);
        toast.success('Item added to wishlist! 🎉');
      }
      setShowModal(false);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save item');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await deleteWishlistItem(id);
      toast.success('Item removed');
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cannot delete');
    }
  };

  const handleVote = async (id) => {
    try {
      const res = await voteWishlistItem(id);
      setItems(prev => prev.map(i => i._id === id ? res.data : i));
    } catch { toast.error('Failed to vote'); }
  };

  const handleBought = async (id) => {
    try {
      const res = await markBoughtWishlistItem(id);
      setItems(prev => prev.map(i => i._id === id ? res.data : i));
      toast.success(res.data.isBought ? '✅ Marked as bought!' : 'Marked as pending');
    } catch { toast.error('Failed to update'); }
  };

  const filteredItems = items.filter(item => {
    const catOk    = filterCat    === 'all' || item.category === filterCat;
    const statusOk = filterStatus === 'all'
      || (filterStatus === 'bought'  &&  item.isBought)
      || (filterStatus === 'pending' && !item.isBought);
    return catOk && statusOk;
  });

  const totalValue   = filteredItems.reduce((s, i) => s + (i.price || 0), 0);
  const boughtCount  = filteredItems.filter(i => i.isBought).length;
  const pendingCount = filteredItems.filter(i => !i.isBought).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Toaster />

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition shrink-0">
            <FiArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-lg flex items-center gap-2">
              🛍️ Wishlist
            </h1>
            <p className="text-gray-400 text-sm">{items.length} items · ₹{totalValue.toFixed(0)} total</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition shrink-0"
        >
          <FiPlus size={16} /> Add Item
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ── Stats bar ──────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Items', value: items.length,   color: 'text-white'        },
            { label: 'Pending',     value: items.filter(i=>!i.isBought).length, color: 'text-yellow-400' },
            { label: 'Bought',      value: items.filter(i=> i.isBought).length, color: 'text-emerald-400'},
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Category filter ─────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setFilterCat(cat.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition border ${
                filterCat === cat.value
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>

        {/* ── Status filter ───────────────────────────────────── */}
        <div className="flex gap-2">
          {[
            { value: 'all',     label: '📋 All'     },
            { value: 'pending', label: '⏳ Pending'  },
            { value: 'bought',  label: '✅ Bought'   },
          ].map(s => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition border ${
                filterStatus === s.value
                  ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Items list ──────────────────────────────────────── */}
        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🛍️</div>
            <p className="text-gray-400">No items yet</p>
            <button onClick={openAdd} className="mt-4 text-emerald-400 hover:underline text-sm">
              Add first item
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map(item => {
              const isMyItem   = (item.addedBy?._id || item.addedBy) === user?.id;
              const hasVoted   = item.votes?.some(v => (v._id || v) === user?.id);
              const priority   = getPriority(item.priority);

              return (
                <div
                  key={item._id}
                  className={`bg-gray-900 border rounded-2xl p-4 transition ${
                    item.isBought
                      ? 'border-emerald-500/30 opacity-75'
                      : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Category emoji */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                        item.isBought ? 'bg-emerald-500/20' : 'bg-gray-800'
                      }`}>
                        {getCatEmoji(item.category)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`font-semibold text-base ${item.isBought ? 'line-through text-gray-500' : ''}`}>
                            {item.title}
                          </h3>
                          {/* Priority badge */}
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${priority.color}`}>
                            {priority.label}
                          </span>
                          {item.isBought && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                              ✅ Bought
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>
                        )}
                        {/* Meta info */}
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {item.price > 0 && (
                            <span className="text-emerald-400 font-semibold text-sm">₹{item.price.toLocaleString()}</span>
                          )}
                          <span className="text-xs text-gray-500">by {item.addedBy?.name || 'Someone'}</span>
                          {item.assignedTo && (
                            <span className="text-xs text-blue-400 flex items-center gap-1">
                              <FiUser size={10} /> {item.assignedTo.name}
                            </span>
                          )}
                          {item.isBought && item.boughtBy && (
                            <span className="text-xs text-emerald-400">
                              bought by {item.boughtBy.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
                          title="Open link"
                        >
                          <FiExternalLink size={14} />
                        </a>
                      )}
                      {isMyItem && (
                        <>
                          <button
                            onClick={() => openEdit(item)}
                            className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
                          >
                            <FiEdit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(item._id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bottom row — votes + bought */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-800">
                    {/* Vote button */}
                    <button
                      onClick={() => handleVote(item._id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                        hasVoted
                          ? 'bg-pink-500/20 border-pink-500/50 text-pink-400'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-pink-500/50 hover:text-pink-400'
                      }`}
                    >
                      <FiHeart size={12} className={hasVoted ? 'fill-pink-400' : ''} />
                      {item.votes?.length || 0} {item.votes?.length === 1 ? 'vote' : 'votes'}
                    </button>

                    {/* Mark bought */}
                    <button
                      onClick={() => handleBought(item._id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
                        item.isBought
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-emerald-500/50 hover:text-emerald-400'
                      }`}
                    >
                      {item.isBought ? <FiCheck size={12} /> : <FiShoppingBag size={12} />}
                      {item.isBought ? 'Bought' : 'Mark Bought'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{editItem ? '✏️ Edit Item' : '🛍️ Add to Wishlist'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white transition">
                <FiX size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Item Name *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="iPhone 16, Trip to Goa, New Shoes..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Any details about this item..."
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition text-sm resize-none"
                />
              </div>

              {/* Price + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    placeholder="0"
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition text-sm"
                  >
                    {CATEGORIES.filter(c => c.value !== 'all').map(c => (
                      <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {PRIORITIES.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setForm({ ...form, priority: p.value })}
                      className={`py-2 rounded-xl text-xs font-medium transition border ${
                        form.priority === p.value
                          ? p.color + ' border-current'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Link */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Link (optional)</label>
                <input
                  type="url"
                  value={form.link}
                  onChange={e => setForm({ ...form, link: e.target.value })}
                  placeholder="https://amazon.in/..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition text-sm"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-semibold transition text-sm"
                >
                  {editItem ? 'Update Item' : 'Add to Wishlist'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}