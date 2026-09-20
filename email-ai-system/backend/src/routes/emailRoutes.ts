import { Router } from 'express';
import { getEmails, syncEmails, sendReply } from '../controllers/emailController';

const router = Router();

router.get('/', getEmails);
router.post('/sync', syncEmails);
router.post('/send-reply', sendReply);

export default router;