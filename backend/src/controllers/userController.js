const User = require('../models/User');

async function listUsers(req, res) {
  const users = await User.find({}).select('name email').lean();
  const me = req.userId;
  res.json({
    users: users
      .filter((u) => u._id.toString() !== me)
      .map((u) => ({ id: u._id.toString(), name: u.name, email: u.email })),
  });
}

module.exports = { listUsers };
