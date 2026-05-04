import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { getGroups, createGroup, deleteGroup } from "../services/api";
import { logout } from "../store/authSlice";
import toast, { Toaster } from "react-hot-toast";
import {
  FiPlus,
  FiLogOut,
  FiUsers,
  FiHome,
  FiShoppingBag,
  FiMap,
  FiTrash2,
  FiMoreVertical,
} from "react-icons/fi";

const categoryIcon = {
  home: <FiHome />,
  trip: <FiMap />,
  food: <FiShoppingBag />,
  other: <FiUsers />,
};

const categoryColor = {
  home: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  trip: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  food: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  other: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export default function Dashboard() {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null); // group to delete
  const [menuOpen, setMenuOpen] = useState(null); // group id with open menu
  const [form, setForm] = useState({ name: "", category: "home", members: [] });

  useEffect(() => {
    fetchGroups();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handler = () => setMenuOpen(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await getGroups();
      setGroups(res.data);
    } catch {
      toast.error("Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createGroup(form);
      toast.success("Group created!");
      setShowModal(false);
      setForm({ name: "", category: "home", members: [] });
      fetchGroups();
    } catch {
      toast.error("Failed to create group");
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      await deleteGroup(deleteModal._id);
      toast.success(`"${deleteModal.name}" deleted!`);
      setDeleteModal(null);
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.msg || "Failed to delete group");
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Toaster />

      {/* Navbar */}
      <nav className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-sm shrink-0">
            S
          </div>
          <span className="font-bold text-lg truncate">Splitwise</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <span className="text-gray-400 text-sm truncate max-w-[120px] sm:max-w-none">
            Hi, {user?.name}
          </span>
          <Link
            to="/wishlist"
            className="flex items-center gap-1.5 sm:gap-2 text-gray-400 hover:text-emerald-400 transition text-sm shrink-0"
          >
            🛍️ <span className="hidden sm:inline">Wishlist</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 sm:gap-2 text-gray-400 hover:text-red-400 transition text-sm shrink-0"
          >
            <FiLogOut /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Your Groups</h1>
            <p className="text-gray-400 text-sm mt-1">
              {groups.length} groups total
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition w-full sm:w-auto"
          >
            <FiPlus /> New Group
          </button>
        </div>

        {/* Groups Grid */}
        {loading ? (
          <div className="text-center text-gray-400 py-20">Loading...</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">💸</div>
            <p className="text-gray-400 text-lg">No groups yet</p>
            <p className="text-gray-600 text-sm mt-1">
              Create a group to start splitting expenses
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => (
              <div
                key={group._id}
                className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 sm:p-6 transition relative min-w-0"
              >
                {/* 3-dot menu button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(menuOpen === group._id ? null : group._id);
                  }}
                  className="absolute top-4 right-4 text-gray-500 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"
                >
                  <FiMoreVertical size={16} />
                </button>

                {/* Dropdown Menu */}
                {menuOpen === group._id && (
                  <div
                    className="absolute top-12 right-4 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setDeleteModal(group);
                        setMenuOpen(null);
                      }}
                      className="flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-gray-700 w-full transition"
                    >
                      <FiTrash2 size={14} /> Delete Group
                    </button>
                  </div>
                )}

                {/* Card content — clickable to open group */}
                <Link to={`/group/${group._id}`} className="block">
                  <div className="flex items-start justify-between gap-3 mb-4 pr-6">
                    <div
                      className={`p-2 rounded-xl border text-lg shrink-0 ${categoryColor[group.category]}`}
                    >
                      {categoryIcon[group.category]}
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full border truncate max-w-[120px] ${categoryColor[group.category]}`}
                    >
                      {group.category}
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg truncate">
                    {group.name}
                  </h3>
                  <p className="text-gray-400 text-sm mt-1 flex items-center gap-1">
                    <FiUsers size={12} /> {group.members.length} members
                  </p>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">Create New Group</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Group Name
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition"
                  placeholder="Goa Trip, Flat Mates..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition"
                >
                  <option value="home">🏠 Home</option>
                  <option value="trip">✈️ Trip</option>
                  <option value="food">🍕 Food</option>
                  <option value="other">📦 Other</option>
                </select>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-semibold transition"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiTrash2 className="text-red-400" size={24} />
              </div>
              <h2 className="text-xl font-bold">Delete Group?</h2>
              <p className="text-gray-400 text-sm mt-2">
                Are you sure you want to delete{" "}
                <span className="text-white font-medium">
                  "{deleteModal.name}"
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
                onClick={handleDelete}
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
