import {Router} from 'express'
const router = Router()

import * as collegeUserController from '../controllers/CollegeUserController.js'
import CollegeUserAuth from '../middleware/collegeUserauth.js'
import AdminAuth from '../middleware/adminauth.js'

// POST ROUTES
router.route('/registercollegeUser').post(AdminAuth, collegeUserController.register)
router.route('/authenticatecollegeUser').post(CollegeUserAuth,(req,res)=>res.end())
router.route('/loginCollegeUserWithEmail').post(collegeUserController.verifyCollegeUser,collegeUserController.loginWithEmail)
router.route('/loginCollegeUserWithMobile').post(collegeUserController.verifyCollegeUser,collegeUserController.loginWithMobile)

// GET ROUTES
router.route('/collegeUser').get(collegeUserController.verifyCollegeUser, collegeUserController.getCollegeUser)
router.route('/collegeUsers').get(AdminAuth, collegeUserController.getallCollegeUsers)
router.route('/get-college-students').get(CollegeUserAuth, collegeUserController.getAllCollegeStudents)

// PUT ROUTES
router.route('/updatecollegeUser').put(CollegeUserAuth, collegeUserController.updateCollegeUser)
router.route('/resetcollegeUserPassword').put(collegeUserController.verifyCollegeUser, collegeUserController.resetPassword)

// DELETE ROUTES

export default router