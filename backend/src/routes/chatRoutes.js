const express = require('express');
const { body } = require('express-validator');
const { requireUserHttp } = require('../middleware/authHttp');
const userController = require('../controllers/userController');
const messageController = require('../controllers/messageController');
const groupController = require('../controllers/groupController');
const notificationController = require('../controllers/notificationController');
const { buildUpload, validateTotalSize } = require('../config/multer');

const router = express.Router();

router.use(requireUserHttp);

const upload = buildUpload((req) => req.userId);

router.get('/users', userController.listUsers);

router.get('/messages/direct/:userId', messageController.listDirectMessages);
router.get('/messages/group/:groupId', messageController.listGroupMessages);

router.post(
  '/messages/send',
  [
    body('message').optional().isString().isLength({ max: 10000 }),
    body('receiverId').optional().isString(),
    body('groupId').optional().isString(),
    body('attachments').optional().isArray(),
    body('clientMessageId').optional().isString(),
  ],
  messageController.sendMessageHttp
);

router.post(
  '/messages/upload',
  upload.array('files', 50),
  validateTotalSize,
  messageController.uploadAttachments
);

router.patch('/messages/:id/read', messageController.markRead);

router.post(
  '/groups',
  [
    body('name').trim().notEmpty().isLength({ max: 120 }),
    body('memberIds').isArray({ min: 2 }),
  ],
  groupController.createGroup
);

router.get('/groups', groupController.listMyGroups);

router.get('/notifications', notificationController.listNotifications);
router.patch('/notifications/:id/read', notificationController.markNotificationRead);
router.post('/notifications/read-all', notificationController.markAllRead);

module.exports = router;
