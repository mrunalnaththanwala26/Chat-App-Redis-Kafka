import { useMemo, useState } from 'react';

export default function GroupModal({ open, users, currentUserId, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  const others = useMemo(
    () => users.filter((u) => u.id !== currentUserId),
    [users, currentUserId]
  );

  if (!open) return null;

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    const memberIds = [...selected];
    if (memberIds.length < 2) return;
    await onCreate({ name: name.trim(), memberIds });
    setName('');
    setSelected(new Set());
    onClose();
  }

  const totalMembers = 1 + selected.size;
  const canSubmit = name.trim().length > 0 && selected.size >= 2 && totalMembers >= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-surface-900 p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">New group</h2>
          <button type="button" className="text-slate-400 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Pick at least two other people — together with you that makes three members minimum.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <input
            className="w-full rounded-lg bg-surface-800 border border-slate-700 px-3 py-2"
            placeholder="Group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div className="max-h-56 overflow-y-auto space-y-2 border border-slate-800 rounded-lg p-2">
            {others.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
                <span>
                  {u.name} <span className="text-slate-500">({u.email})</span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Total members (including you): {totalMembers} — minimum 3 required
          </p>
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2 disabled:opacity-40"
          >
            Create group
          </button>
        </form>
      </div>
    </div>
  );
}
