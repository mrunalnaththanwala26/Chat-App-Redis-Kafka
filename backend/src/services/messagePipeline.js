const mongoose = require('mongoose');
const Message = require('../models/Message');
const Group = require('../models/Group');
const Notification = require('../models/Notification');
const { logger } = require('../utils/logger');

async function ensureDedup(redis, clientMessageId) {
  if (!clientMessageId || !redis) return true;
  const key = `dedup:msg:${clientMessageId}`;
  const r = await redis.set(key, '1', { NX: true, EX: 86400 });
  return r !== null;
}

/**
 * Persist message and notify sockets (same logic as Kafka consumer).
 * @param {import('socket.io').Server} io
 * @param {import('redis').RedisClientType} redis
 * @param {object} data - parsed message payload
 */
async function persistIncomingMessage(io, redis, data) {
  const {
    senderId,
    receiverId,
    groupId,
    message,
    attachments,
    clientMessageId,
    timestamp,
  } = data || {};

  if (!(await ensureDedup(redis, clientMessageId))) {
    logger.debug('Skipping duplicate clientMessageId');
    return;
  }

  const sid = new mongoose.Types.ObjectId(senderId);
  let rid;
  let gid;
  if (groupId) gid = new mongoose.Types.ObjectId(groupId);
  if (receiverId) rid = new mongoose.Types.ObjectId(receiverId);

  const doc = await Message.create({
    senderId: sid,
    receiverId: rid,
    groupId: gid,
    message: message || '',
    attachments: attachments || [],
    status: 'delivered',
    clientMessageId,
    readBy: [sid],
  });

  const payload = {
    id: doc._id.toString(),
    senderId: sid.toString(),
    receiverId: rid?.toString(),
    groupId: gid?.toString(),
    message: doc.message,
    attachments: doc.attachments,
    status: doc.status,
    timestamp: doc.createdAt?.toISOString() || timestamp || new Date().toISOString(),
    clientMessageId,
  };

  if (gid) {
    const group = await Group.findById(gid).lean();
    if (group) {
      const memberIds = group.memberIds.map((m) => m.toString());
      const gidStr = gid.toString();
      memberIds.forEach((uid) => {
        io.to(`user:${uid}`).emit('receive_message', payload);
      });
      const targets = memberIds.filter((id) => id !== sid.toString());
      await Promise.all(
        targets.map((uid) =>
          Notification.create({
            userId: new mongoose.Types.ObjectId(uid),
            title: 'New group message',
            body: doc.message?.slice(0, 160) || 'Attachment',
            type: 'message',
            data: { messageId: doc._id.toString(), groupId: gidStr },
          }).catch(() => {})
        )
      );
      const notifPayload = {
        title: 'New message',
        body: doc.message?.slice(0, 120) || 'New activity',
        data: { groupId: gidStr, messageId: doc._id.toString() },
      };
      targets.forEach((uid) => {
        io.to(`user:${uid}`).emit('notification', notifPayload);
      });
    }
  } else if (rid) {
    const ridStr = rid.toString();
    const sidStr = sid.toString();
    io.to(`user:${ridStr}`).emit('receive_message', payload);
    io.to(`user:${sidStr}`).emit('receive_message', payload);
    await Notification.create({
      userId: rid,
      title: 'New message',
      body: doc.message?.slice(0, 160) || 'Attachment',
      type: 'message',
      data: { messageId: doc._id.toString(), senderId: sidStr },
    }).catch(() => {});
    io.to(`user:${ridStr}`).emit('notification', {
      title: 'New message',
      body: doc.message?.slice(0, 120) || 'You have a new message',
      data: { messageId: doc._id.toString(), senderId: sidStr },
    });
  }
}

module.exports = { persistIncomingMessage, ensureDedup };
