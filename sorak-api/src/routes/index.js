import { Router } from 'express';
import authRoutes from './auth.routes.js';
import accountsRoutes from './accounts.routes.js';
import academicYearsRoutes from './academic-years.routes.js';
import classesRoutes from './classes.routes.js';
import teachersRoutes from './teachers.routes.js';
import studentsRoutes from './students.routes.js';
import classTransfersRoutes from './class-transfers.routes.js';
import outgoingTransfersRoutes from './outgoing-transfers.routes.js';
import incomingTransfersRoutes from './incoming-transfers.routes.js';
import healthAssessmentsRoutes from './health-assessments.routes.js';
import nutritionAssessmentsRoutes from './nutrition-assessments.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/accounts', accountsRoutes);
router.use('/academic-years', academicYearsRoutes);
router.use('/classes', classesRoutes);
router.use('/teachers', teachersRoutes);
router.use('/students', studentsRoutes);
router.use('/class-transfers', classTransfersRoutes);
router.use('/outgoing-transfers', outgoingTransfersRoutes);
router.use('/incoming-transfers', incomingTransfersRoutes);
router.use('/health-assessments', healthAssessmentsRoutes);
router.use('/nutrition-assessments', nutritionAssessmentsRoutes);

export default router;
