const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const env = require('../config/env');
const Group = require('../models/Group');
const { produceMessageSent } = require('../events/kafkaProducer');
const { v4: uuidv4 } = require('uuid');

function initChatSocket(io, redisClient) {
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.query?.token && String(socket.handshake.query.token));
      if (!token) {
        return next(new Error('Unauthorized'));
      }
      const payload = jwt.verify(token, env.jwtSecret);
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    socket.join(`user:${userId}`);

    try {
      const groups = await Group.find({ memberIds: new mongoose.Types.ObjectId(userId) }).lean();
      groups.forEach((g) => socket.join(`group:${g._id}`));
    } catch {
      /* ignore */
    }

    try {
      const count = await redisClient.incr(`presence:${userId}`);
      if (Number(count) === 1) {
        socket.broadcast.emit('user_online', { userId });
      }
    } catch {
      /* ignore */
    }

    socket.on('send_message', async (payload, ack) => {
      try {
        const {
          receiverId,
          groupId,
          message,
          attachments,
          clientMessageId,
        } = payload || {};
        if (!receiverId && !groupId) {
          ack?.({ ok: false, error: 'receiverId or groupId required' });
          return;
        }
        if (groupId) {
          const group = await Group.findById(groupId).lean();
          if (!group || !group.memberIds.some((id) => id.toString() === userId)) {
            ack?.({ ok: false, error: 'Forbidden' });
            return;
          }
          socket.join(`group:${groupId}`);
        }
        const event = {
          senderId: userId,
          receiverId: receiverId || undefined,
          groupId: groupId || undefined,
          message: message || '',
          attachments: attachments || [],
          clientMessageId: clientMessageId || uuidv4(),
          timestamp: new Date().toISOString(),
        };
        await produceMessageSent(event);
        ack?.({ ok: true, clientMessageId: event.clientMessageId });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on('sync_groups', async () => {
      try {
        const groups = await Group.find({ memberIds: new mongoose.Types.ObjectId(userId) }).lean();
        groups.forEach((g) => socket.join(`group:${g._id}`));
      } catch {
        /* ignore */
      }
    });

    socket.on('typing', (payload) => {
      const { receiverId, groupId, typing } = payload || {};
      if (groupId) {
        socket.join(`group:${groupId}`);
        socket.to(`group:${groupId}`).emit('typing', { userId, groupId, typing: !!typing });
      } else if (receiverId) {
        socket.to(`user:${receiverId}`).emit('typing', { userId, typing: !!typing });
      }
    });

    socket.on('disconnect', async () => {
      try {
        const key = `presence:${userId}`;
        const c = await redisClient.decr(key);
        if (Number(c) <= 0) {
          await redisClient.del(key);
          socket.broadcast.emit('user_offline', { userId });
        }
      } catch {
        /* ignore */
      }
    });
  });
}

module.exports = { initChatSocket };
