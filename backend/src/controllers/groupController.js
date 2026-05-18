const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Group = require('../models/Group');

async function createGroup(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { name, memberIds } = req.body;
  const adminId = req.userId;
  const ids = (memberIds || []).map((id) => String(id));
  const unique = new Set([adminId, ...ids]);
  if (unique.size < 3) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'A group must include at least three distinct members (including you).',
    });
  }
  const memberObjectIds = [...unique].map((id) => new mongoose.Types.ObjectId(id));
  const group = await Group.create({
    name: name.trim(),
    memberIds: memberObjectIds,
    adminId: new mongoose.Types.ObjectId(adminId),
  });
  res.status(201).json({
    group: {
      id: group._id.toString(),
      name: group.name,
      memberIds: group.memberIds.map((m) => m.toString()),
      adminId: group.adminId.toString(),
    },
  });
}

async function listMyGroups(req, res) {
  const me = new mongoose.Types.ObjectId(req.userId);
  const groups = await Group.find({ memberIds: me }).lean();
  res.json({
    groups: groups.map((g) => ({
      id: g._id.toString(),
      name: g.name,
      memberIds: g.memberIds.map((m) => m.toString()),
      adminId: g.adminId.toString(),
    })),
  });
}

module.exports = { createGroup, listMyGroups };
