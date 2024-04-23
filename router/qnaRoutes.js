import {Router} from 'express'
const router = Router()

import * as TestModuleControllers from '../controllers/TestModuleController.js'
import * as QnaControllers from '../controllers/QnaController.js'
import AdminAuth from '../middleware/adminauth.js'
import Abort from '../middleware/abort.js'
import Auth from '../middleware/auth.js'
// POST ROUTES
router.route('/createtestmodule').post(AdminAuth,TestModuleControllers.createTestModule);
router.route('/addquestiontomodule').post(AdminAuth,QnaControllers.addQuestionToModule);
router.route('/updatedQuestionViaCSV').post(AdminAuth,QnaControllers.updatedQuestionViaCSV);
// GET ROUTES
router.route('/gettestquestions').get(Abort, QnaControllers.getTestQuestions);
router.route('/getmodulequestions').get(Auth, QnaControllers.getModuleQuestions);
router.route('/getallmodules').get(Auth,TestModuleControllers.getAllModules);
router.route('/getallmodulesadmin').get(AdminAuth,TestModuleControllers.getAllModulesAdmin);
router.route('/gettestreport').get(Auth, TestModuleControllers.getTestReport)

// PUT ROUTES
router.route('/submittestanswer').put(Auth, QnaControllers.submitAnswer);
router.route('/submitmodule').put(Auth, TestModuleControllers.submitModule);

// DELETE ROUTES

export default router