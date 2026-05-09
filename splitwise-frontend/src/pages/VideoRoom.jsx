import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast, { Toaster } from 'react-hot-toast';
import { getGroupVideoRoom, createGroupVideoRoom } from '../services/api';
import { FiArrowLeft, FiCopy, FiVideo, FiExternalLink } from 'react-icons/fi';

export default function VideoRoom() {
  const { groupId } = useParams();
  const { user } = useSelector((state) => state.auth);
  const [videoRoom, setVideoRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showIframe, setShowIframe] = useState(true);

  const copyInviteLink = async () => {
    if (!videoRoom?.inviteLink) return;
    await navigator.clipboard.writeText(videoRoom.inviteLink);
    toast.success('Invite link copied.');
  };

  const fetchRoom = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getGroupVideoRoom(groupId);
      setVideoRoom(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setVideoRoom(null);
      } else {
        setError(err.response?.data?.error || 'Unable to load video call.');
      }
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await createGroupVideoRoom(groupId);
      setVideoRoom(res.data);
      setShowIframe(true);
      toast.success('Video room ready.');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to create video call.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoom();
  }, [groupId]);

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-10">
      <Toaster />
      <div className="bg-gray-900 border-b border-gray-800 px-4 sm:px-6 py-4 flex items-center gap-4">
        <Link to={`/group/${groupId}`} className="text-gray-400 hover:text-white transition">
          <FiArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="font-bold text-lg">Group Video Call</h1>
          <p className="text-sm text-gray-400">Secure group meeting for invited group members only.</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-400">Room link:</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  readOnly
                  value={videoRoom?.inviteLink || `${window.location.origin}/group/${groupId}/video`}
                  className="flex-1 bg-gray-950 border border-gray-800 rounded-2xl px-4 py-3 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={copyInviteLink}
                  disabled={!videoRoom?.inviteLink}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-2xl px-4 py-3 text-sm font-medium transition"
                >
                  <FiCopy className="inline mr-2" /> Copy
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={videoRoom ? () => setShowIframe((prev) => !prev) : createRoom}
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-2xl px-4 py-3 text-sm font-medium transition flex items-center gap-2"
            >
              <FiVideo /> {videoRoom ? (showIframe ? 'Hide call' : 'Show call') : 'Start call'}
            </button>
          </div>

          {loading && (
            <div className="text-gray-400">Loading…</div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {!loading && !videoRoom && !error && (
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 text-sm text-gray-400">
              No active room found. Click "Start call" to create a group video room.
            </div>
          )}
        </div>

        {videoRoom && showIframe && (
          <div className="bg-black rounded-3xl overflow-hidden border border-gray-800 h-[70vh]">
            <iframe
              title="Group video call"
              src={`https://meet.jit.si/${videoRoom.roomId}`}
              className="w-full h-full"
              allow="camera; microphone; fullscreen; display-capture"
            />
          </div>
        )}

        {videoRoom && (
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-4 text-sm text-gray-400">
            <p>Room ID: <span className="text-white">{videoRoom.roomId}</span></p>
            <p className="mt-1">Only users signed in and in this group can access the room.</p>
          </div>
        )}
      </div>
    </div>
  );
}
