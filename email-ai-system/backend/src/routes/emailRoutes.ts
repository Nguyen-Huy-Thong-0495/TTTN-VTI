import { Router } from 'express';
import { getEmails, syncEmails, sendReply, getQuickReplies } from '../controllers/emailController';
import { verifyToken } from '../middleware/authMiddleware';

const router = Router();

router.use(verifyToken);
router.get('/', getEmails);
router.post('/sync', syncEmails);
router.post('/send-reply', sendReply);
router.post('/quick-replies', getQuickReplies);

export default router;