const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Message = require('../models/Message');
const Group = require('../models/Group');
const env = require('../config/env');
const { produceMessageSent } = require('../events/kafkaProducer');
const { v4: uuidv4 } = require('uuid');

function publicUrlForFile(userId, filename) {
  return `${env.publicBaseUrl}/files/${userId}/${filename}`;
}

async function listDirectMessages(req, res) {
  const { userId: otherId } = req.params;
  const me = new mongoose.Types.ObjectId(req.userId);
  const other = new mongoose.Types.ObjectId(otherId);
  const items = await Message.find({
    $or: [
      { senderId: me, receiverId: other },
      { senderId: other, receiverId: me },
    ],
    groupId: { $exists: false },
  })
    .sort({ createdAt: 1 })
    .lean();

  res.json({
    messages: items.map((m) => ({
      id: m._id.toString(),
      senderId: m.senderId.toString(),
      receiverId: m.receiverId?.toString(),
      message: m.message,
      attachments: m.attachments,
      status: m.status,
      createdAt: m.createdAt,
    })),
  });
}

async function listGroupMessages(req, res) {
  const { groupId } = req.params;
  const me = req.userId;
  const group = await Group.findById(groupId).lean();
  if (!group || !group.memberIds.some((id) => id.toString() === me)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const items = await Message.find({ groupId }).sort({ createdAt: 1 }).lean();
  res.json({
    messages: items.map((m) => ({
      id: m._id.toString(),
      senderId: m.senderId.toString(),
      groupId: m.groupId?.toString(),
      message: m.message,
      attachments: m.attachments,
      status: m.status,
      createdAt: m.createdAt,
    })),
  });
}

async function uploadAttachments(req, res) {
  const files = req.files || [];
  const uid = req.userId;
  const mapped = files.map((f) => ({
    url: publicUrlForFile(uid, f.filename),
    mimeType: f.mimetype,
    size: f.size,
    originalName: f.originalname,
  }));
  res.json({ attachments: mapped });
}

async function sendMessageHttp(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { receiverId, groupId, message, attachments, clientMessageId } = req.body;
  const senderId = req.userId;

  if (!receiverId && !groupId) {
    return res.status(400).json({ error: 'receiverId or groupId required' });
  }

  if (groupId) {
    const group = await Group.findById(groupId).lean();
    if (!group || !group.memberIds.some((id) => id.toString() === senderId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  const payload = {
    senderId,
    receiverId: receiverId || undefined,
    groupId: groupId || undefined,
    message: message || '',
    attachments: attachments || [],
    clientMessageId: clientMessageId || uuidv4(),
    timestamp: new Date().toISOString(),
  };

  await produceMessageSent(payload);
  res.status(202).json({ accepted: true, clientMessageId: payload.clientMessageId });
}

async function markRead(req, res) {
  const { id } = req.params;
  const me = new mongoose.Types.ObjectId(req.userId);
  const msg = await Message.findById(id);
  if (!msg) return res.status(404).json({ error: 'Not found' });
  let allowed = false;
  if (msg.receiverId && msg.receiverId.equals(me)) allowed = true;
  if (msg.groupId) {
    const member = await Group.findOne({ _id: msg.groupId, memberIds: me }).lean();
    allowed = !!member;
  }
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });
  msg.status = 'read';
  if (!msg.readBy.some((x) => x.equals(me))) msg.readBy.push(me);
  await msg.save();
  res.json({ ok: true });
}

module.exports = {
  listDirectMessages,
  listGroupMessages,
  uploadAttachments,
  sendMessageHttp,
  markRead,
};
