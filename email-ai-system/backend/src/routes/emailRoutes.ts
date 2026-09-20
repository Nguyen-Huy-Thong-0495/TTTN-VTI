import { Router } from 'express';
import { getEmails, syncEmails } from '../controllers/emailController';

const router = Router();

router.get('/', getEmails);
router.post('/sync', syncEmails);

export default router;