import { Router } from 'express';
import { sedeController } from './sede.controller';

const router = Router();

router.post('/', sedeController.createSede);

export default router;
