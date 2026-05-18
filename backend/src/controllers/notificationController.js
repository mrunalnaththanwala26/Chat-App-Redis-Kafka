const mongoose = require('mongoose');
const Notification = require('../models/Notification');

async function listNotifications(req, res) {
  const me = new mongoose.Types.ObjectId(req.userId);
  const items = await Notification.find({ userId: me }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({
    notifications: items.map((n) => ({
      id: n._id.toString(),
      title: n.title,
      body: n.body,
      type: n.type,
      read: n.read,
      data: n.data,
      createdAt: n.createdAt,
    })),
  });
}

async function markNotificationRead(req, res) {
  const me = new mongoose.Types.ObjectId(req.userId);
  const n = await Notification.findOne({ _id: req.params.id, userId: me });
  if (!n) return res.status(404).json({ error: 'Not found' });
  n.read = true;
  await n.save();
  res.json({ ok: true });
}

async function markAllRead(req, res) {
  const me = new mongoose.Types.ObjectId(req.userId);
  await Notification.updateMany({ userId: me, read: false }, { $set: { read: true } });
  res.json({ ok: true });
}

module.exports = { listNotifications, markNotificationRead, markAllRead };
