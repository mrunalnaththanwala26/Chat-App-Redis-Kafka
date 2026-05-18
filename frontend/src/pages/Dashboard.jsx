import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { chatApi } from '../services/api';
import { useChatSocket } from '../hooks/useChatSocket';
import GroupModal from '../components/GroupModal';

const MAX_TOTAL_BYTES = 1073741824;

function matchesThread(selection, payload, userId) {
  if (!payload) return false;
  if (selection?.type === 'group') {
    return payload.groupId === selection.id;
  }
  if (selection?.type === 'dm') {
    const peer = selection.id;
    return (
      !payload.groupId &&
      ((payload.senderId === peer && payload.receiverId === userId) ||
        (payload.senderId === userId && payload.receiverId === peer))
    );
  }
  return false;
}

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const { socket, connected } = useChatSocket(token, !!user);

  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selection, setSelection] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [online, setOnline] = useState(() => new Set());
  const [typing, setTyping] = useState(false);
  const [toast, setToast] = useState(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [groupModal, setGroupModal] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  const typingTimer = useRef(null);
  const selectionRef = useRef(selection);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  const title = useMemo(() => {
    if (!selection) return 'Chat';
    if (selection.type === 'dm') return selection.label || 'Direct';
    return selection.label || 'Group';
  }, [selection]);

  const refreshCatalog = useCallback(async () => {
    try {
      const [{ data: u }, { data: g }] = await Promise.all([
        chatApi.get('users'),
        chatApi.get('groups'),
      ]);
      setUsers(u.users || []);
      setGroups(g.groups || []);
    } catch {
      setUsers([]);
      setGroups([]);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const { data } = await chatApi.get('notifications');
      const unread = (data.notifications || []).filter((n) => !n.read).length;
      setNotifCount(unread);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshCatalog();
    refreshNotifications();
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [refreshCatalog, refreshNotifications]);

  useEffect(() => {
    if (!socket || !connected) return;
    socket.emit('sync_groups');
  }, [socket, connected, groups]);

  useEffect(() => {
    async function loadMessages() {
      if (!selection) {
        setMessages([]);
        return;
      }
      try {
        if (selection.type === 'dm') {
          const { data } = await chatApi.get(`messages/direct/${selection.id}`);
          setMessages(data.messages || []);
        } else {
          const { data } = await chatApi.get(`messages/group/${selection.id}`);
          setMessages(data.messages || []);
        }
      } catch {
        setMessages([]);
      }
    }
    loadMessages();
  }, [selection]);

  useEffect(() => {
    if (!socket || !user) return undefined;

    const onReceive = (payload) => {
      setMessages((prev) => {
        const sel = selectionRef.current;
        if (!matchesThread(sel, payload, user.id)) return prev;
        const exists = prev.some((m) => m.id === payload.id || m.clientMessageId === payload.clientMessageId);
        if (exists) return prev;
        return [
          ...prev,
          {
            id: payload.id,
            senderId: payload.senderId,
            receiverId: payload.receiverId,
            groupId: payload.groupId,
            message: payload.message,
            attachments: payload.attachments || [],
            status: payload.status,
            createdAt: payload.timestamp,
            clientMessageId: payload.clientMessageId,
          },
        ];
      });
    };

    const onOnline = ({ userId }) => {
      setOnline((prev) => new Set(prev).add(userId));
    };
    const onOffline = ({ userId }) => {
      setOnline((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    const onTyping = (evt) => {
      if (!evt || evt.userId === user.id) return;
      if (!selection) return;
      if (selection.type === 'group') {
        if (evt.groupId === selection.id) setTyping(!!evt.typing);
        return;
      }
      if (evt.userId === selection.id) setTyping(!!evt.typing);
    };

    const onNotification = (n) => {
      setToast({ title: n.title, body: n.body });
      setNotifCount((c) => c + 1);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(n.title || 'Notification', { body: n.body || '' });
      }
    };

    socket.on('receive_message', onReceive);
    socket.on('user_online', onOnline);
    socket.on('user_offline', onOffline);
    socket.on('typing', onTyping);
    socket.on('notification', onNotification);

    return () => {
      socket.off('receive_message', onReceive);
      socket.off('user_online', onOnline);
      socket.off('user_offline', onOffline);
      socket.off('typing', onTyping);
      socket.off('notification', onNotification);
    };
  }, [socket, user, selection]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    const total = files.reduce((s, f) => s + f.size, 0);
    if (total > MAX_TOTAL_BYTES) {
      alert('Total attachment size cannot exceed 1GB.');
      return;
    }
    setPendingFiles(files);
  }

  async function send() {
    if (!socket || !selection) return;
    let attachments = [];
    if (pendingFiles.length) {
      const fd = new FormData();
      pendingFiles.forEach((f) => fd.append('files', f));
      const { data } = await chatApi.post('messages/upload', fd);
      attachments = data.attachments || [];
    }
    const clientMessageId = crypto.randomUUID();
    const payload =
      selection.type === 'dm'
        ? {
            receiverId: selection.id,
            message: text,
            attachments,
            clientMessageId,
          }
        : {
            groupId: selection.id,
            message: text,
            attachments,
            clientMessageId,
          };

    socket.emit('send_message', payload, () => {});
    setText('');
    setPendingFiles([]);
    socket.emit(
      'typing',
      selection.type === 'dm'
        ? { receiverId: selection.id, typing: false }
        : { groupId: selection.id, typing: false }
    );
  }

  function onTypingInput(val) {
    setText(val);
    if (!socket || !selection) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    socket.emit(
      'typing',
      selection.type === 'dm'
        ? { receiverId: selection.id, typing: true }
        : { groupId: selection.id, typing: true }
    );
    typingTimer.current = setTimeout(() => {
      socket.emit(
        'typing',
        selection.type === 'dm'
          ? { receiverId: selection.id, typing: false }
          : { groupId: selection.id, typing: false }
      );
    }, 1200);
  }

  async function createGroup({ name, memberIds }) {
    await chatApi.post('groups', { name, memberIds });
    await refreshCatalog();
  }

  function selectDm(u) {
    setSelection({ type: 'dm', id: u.id, label: u.name });
    setChatOpen(true);
  }

  function selectGroup(g) {
    setSelection({ type: 'group', id: g.id, label: g.name });
    setChatOpen(true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-surface-900">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-lg">Team Chat</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              connected ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-200'
            }`}
          >
            {connected ? 'Live' : 'Offline'}
          </span>
          {notifCount > 0 && (
            <span className="text-xs bg-amber-600 px-2 py-0.5 rounded-full">{notifCount} unread</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-sm text-slate-400 hover:text-white"
            onClick={() => refreshNotifications()}
          >
            Refresh alerts
          </button>
          <span className="text-sm text-slate-400">{user?.email}</span>
          <button
            type="button"
            className="text-sm rounded-lg bg-slate-800 px-3 py-1 hover:bg-slate-700"
            onClick={() => logout()}
          >
            Logout
          </button>
        </div>
      </header>

      {toast && (
        <div className="fixed top-16 right-4 z-40 max-w-sm rounded-lg border border-slate-700 bg-surface-900 px-4 py-3 shadow-lg">
          <p className="font-medium">{toast.title}</p>
          <p className="text-sm text-slate-400">{toast.body}</p>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <aside className="w-80 border-r border-slate-800 bg-surface-900 flex flex-col">
          <div className="p-3 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm"
              onClick={() => setGroupModal(true)}
            >
              New group
            </button>
          </div>
          <div className="px-3 pb-2 text-xs uppercase text-slate-500">Direct messages</div>
          <div className="flex-1 overflow-y-auto">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => selectDm(u)}
                className={`w-full text-left px-3 py-2 hover:bg-surface-800 flex justify-between ${
                  selection?.type === 'dm' && selection.id === u.id ? 'bg-surface-800' : ''
                }`}
              >
                <span>{u.name}</span>
                <span className="text-xs text-emerald-400">{online.has(u.id) ? '● online' : ''}</span>
              </button>
            ))}
          </div>
          <div className="px-3 py-2 text-xs uppercase text-slate-500">Groups</div>
          <div className="pb-4 overflow-y-auto">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => selectGroup(g)}
                className={`w-full text-left px-3 py-2 hover:bg-surface-800 ${
                  selection?.type === 'group' && selection.id === g.id ? 'bg-surface-800' : ''
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        </aside>

        {chatOpen && (
          <main className="flex-1 flex flex-col min-w-0 bg-surface-950">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div>
                <h2 className="font-semibold">{title}</h2>
                {typing && <p className="text-xs text-slate-400">Typing…</p>}
              </div>
              <button
                type="button"
                className="text-sm text-slate-400 hover:text-white"
                onClick={() => setChatOpen(false)}
              >
                Close chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id || m.clientMessageId}
                  className={`flex ${m.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      m.senderId === user?.id ? 'bg-indigo-600 text-white' : 'bg-surface-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.message}</p>
                    {m.attachments?.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs underline">
                        {m.attachments.map((a) => (
                          <li key={a.url}>
                            <a href={a.url} target="_blank" rel="noreferrer">
                              {a.originalName}
                            </a>{' '}
                            <span className="text-slate-400">
                              ({Math.round(a.size / 1024)} KB)
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-[10px] opacity-70 mt-1">
                      {m.status} · {new Date(m.createdAt || m.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {!messages.length && selection && (
                <p className="text-sm text-slate-500">No messages yet. Say hello.</p>
              )}
              {!selection && <p className="text-sm text-slate-500">Select a conversation.</p>}
            </div>

            <div className="border-t border-slate-800 p-3 space-y-2 bg-surface-900">
              <input type="file" multiple onChange={handleFiles} className="text-xs text-slate-400" />
              {pendingFiles.length > 0 && (
                <p className="text-xs text-slate-400">
                  {pendingFiles.length} file(s) ready (
                  {(pendingFiles.reduce((s, f) => s + f.size, 0) / (1024 * 1024)).toFixed(2)} MB)
                </p>
              )}
              <div className="flex gap-2">
                <textarea
                  className="flex-1 rounded-lg bg-surface-800 border border-slate-700 px-3 py-2 text-sm min-h-[44px]"
                  placeholder="Write a message…"
                  value={text}
                  onChange={(e) => onTypingInput(e.target.value)}
                  rows={2}
                />
                <button
                  type="button"
                  className="self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm disabled:opacity-40"
                  disabled={!selection || (!text.trim() && pendingFiles.length === 0)}
                  onClick={() => send()}
                >
                  Send
                </button>
              </div>
            </div>
          </main>
        )}

        {!chatOpen && (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm border-l border-slate-800">
            Chat closed — pick a user or group from the sidebar, then open the composer from the list.
            <button
              type="button"
              className="ml-4 text-indigo-400 underline"
              onClick={() => setChatOpen(true)}
            >
              Open chat panel
            </button>
          </div>
        )}
      </div>

      <GroupModal
        open={groupModal}
        users={users}
        currentUserId={user?.id}
        onClose={() => setGroupModal(false)}
        onCreate={createGroup}
      />
    </div>
  );
}
