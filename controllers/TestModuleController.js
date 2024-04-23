import TestModuleModel from "../model/Testmodule.model.js";
import UserModel from "../model/User.model.js";
import UsertestreportModel from "../model/Usertestreport.model.js";

/** POST: http://localhost:8080/api/createtestmodule
* @param: {
    "header" : "Admin <token>"
}
body: {
    "module_name": "React Js"
}
*/
export async function createTestModule(req, res) {
	try {
		const { module_name} = req.body

		const existingModule_name = await TestModuleModel.findOne({
			module_name
		})

		if (existingModule_name) {
			return res
				.status(400)
				.json({ error: 'Module with this name already exists' })
		}

		const newTestModule = new TestModuleModel({
			module_name
		})

		await newTestModule.save()

		return res.status(201).json({
			message: 'Test Module added successfully',
			category: newTestModule.module_name,
		})
	} catch (error) {
		return res.status(500).json({ error: 'Internal server error' })
	}
}

/** PUT: http://localhost:8080/api/submitmodule
* @param: {
    "header" : "User <token>"
}
body: {
    "moduleID": ""
}
*/
export async function submitModule(req, res) {
    const { userID } = req.user;
    const { moduleID } = req.body;

    try {
        const result = await UsertestreportModel.findOneAndUpdate(
            { user: userID, module: moduleID },
            { $set: { isModuleCompleted: true } },
            { new: true }
        );

        if (!result) {
            return res.status(404).send({success: false, message: 'User Test Report not found or already completed.' });
        }

        return res.status(200).send({ success: true, message: "Module submitted successfully." });
    } catch (error) {
        return res.status(500).send({ success: false, message: 'Internal Server Error', error });
    }
}

/** GET: http://localhost:8080/api/getallmodules 
* @param: {
    "header" : "User/Admin <token>"
}
*/
export async function getAllModules(req, res) {
	try {
		const { userID } = req.user;
        let isTestCompleted = true;
		if (!userID) {
			return res.status(500).send({ error: 'User Not Found!' });
		}

		// Fetch all modules and user progress in parallel
		const [modules, userProgress] = await Promise.all([
			TestModuleModel.find({}).lean(),
			UsertestreportModel.find({ user: userID }).lean()
		]);

		// Create a map to store module progress for constant time lookup
		const progressMap = new Map();
		userProgress.forEach(module => {
			const progress = calculateProgress(module);
            const isModuleCompleted = module.isModuleCompleted
			progressMap.set(module.module.toString(), {progress, isModuleCompleted});
		});

        userProgress.forEach((report) => {
            if (report.isModuleCompleted === false) {
                isTestCompleted = false;
                return;
            }
        });
		// Update progress for each module
		const data = modules.map(module => {
			const { questions, ...rest } = module;
			const progress = progressMap.get(module._id.toString()).progress || 0; // Default to 0 if progress not found
			const isModuleCompleted = progressMap.get(module._id.toString()).isModuleCompleted || false; // Default to 0 if progress not found
			return { ...rest, isModuleCompleted, progress };
		});

		return res.status(200).send({ success: true, isTestCompleted, data });
	} catch (error) {
		return res.status(500).send({ error: 'Internal Server Error', error });
	}
}

function calculateProgress(module) {
	const submittedCount = module.generatedQustionSet.filter(question => question.isSubmitted).length;
	const totalQuestions = module.generatedQustionSet.length;
	return (submittedCount / totalQuestions) * 100;
}

/** GET: http://localhost:8080/api/getallmodulesadmin 
* @param: {
    "header" : "User/Admin <token>"
}
*/
export async function getAllModulesAdmin(req, res) {
	try {
		let Module = await TestModuleModel.find({ }).lean();
		let data  = Module.map((module)=>{
			const { questions, ...rest } = module
			return rest
		})
		return res.status(200).send({ success: true, data: data })
	} catch (error) {
		return res.status(500).send({ error: 'Internal Server Error', error })
	}
}

/** GET: http://localhost:8080/api/gettestreport 
* @param: {
    "header" : "User <token>"
}
*/
export async function getTestReport(req, res) {
    try {
        const { userID } = req.user;
        let isTestCompleted = true;
		let testReport = {
            totalQuestion: 0,
            attemptedQuestions: 0,
            unAttemptedQuestions: 0,
            correctAnswers: 0,
            incorrectAnswers: 0,
            totalMarks: 0,
            obtainedMarks: 0,
            scorePercentage: 0
        };
		
        if (!userID) {
            return res.status(500).send({ error: 'User Not Found!' });
        }

        let Report = await UsertestreportModel.find({ user: userID }).populate('module').populate('generatedQustionSet.question').lean();
        Report.forEach((report) => {
            if (report.isModuleCompleted === false) {
                isTestCompleted = false;
                return;
            }
        });

        if (!isTestCompleted) {
            return res.status(501).send({ success: false, message: "Test Not Submitted Yet!", isTestCompleted });
        }

        let newData = Report.map((data) => {
            const { module, ...restData } = data;
            const { questions, __v, ...restModule } = module;
            const updatedQuestions = data.generatedQustionSet.map(question => {
                const isCorrect = question.isSubmitted ? question.submittedAnswer === question.question.answer : null;
                return {
                    ...question,
                    isCorrect
                };
            });
            return { ...restData, module: { ...restModule }, generatedQustionSet: updatedQuestions };
        });

		Report.forEach(data => {
            data.generatedQustionSet.forEach(question => {
                testReport.totalQuestion++;
                if (question.isSubmitted) {
                    testReport.attemptedQuestions++;
                    if (question.submittedAnswer === question.question.answer) {
                        testReport.correctAnswers++;
                        testReport.obtainedMarks += question.question.maxMarks;
                    } else {
                        testReport.incorrectAnswers++;
                    }
                } else {
                    testReport.unAttemptedQuestions++;
                }
                testReport.totalMarks += question.question.maxMarks;
            });
        });
		testReport.scorePercentage = ((testReport.obtainedMarks / testReport.totalMarks) * 100).toFixed(2);

        return res.status(200).send({ success: true, isTestCompleted, testReport, data: newData,  });
    } catch (error) {
        return res.status(500).send({ error: 'Internal Server Error', error });
    }
}

/** GET: http://localhost:8080/api/getalltestreport 
* @param: {
    "header" : "Admin <token>"
}
*/
export async function getAllTestReport(req, res) {
    try {
        const allUsers = await UserModel.find({});
        
        const testReports = [];

        for (const user of allUsers) {
            const { _id: userID } = user;
            let isTestCompleted = true;
            let testReport = {
                totalQuestion: 0,
                attemptedQuestions: 0,
                unAttemptedQuestions: 0,
                correctAnswers: 0,
                incorrectAnswers: 0,
                totalMarks: 0,
                obtainedMarks: 0,
                scorePercentage: 0
            };

            if (!userID) {
                return res.status(500).send({ error: 'User Not Found!' });
            }

            let Report = await UsertestreportModel.find({ user: userID }).populate('module').populate('generatedQustionSet.question').lean();
            if (Report.length === 0) {
                continue;
            }

            Report.forEach((report) => {
                if (report.isModuleCompleted === false) {
                    isTestCompleted = false;
                    return;
                }
            });

            if (!isTestCompleted) {
                testReports.push({ user: user, isTestCompleted: false, message: "Test Not Submitted Yet!" });
                continue;
            }

            let newData = Report.map((data) => {
                const { module, ...restData } = data;
                const { questions, __v, ...restModule } = module;
                const updatedQuestions = data.generatedQustionSet.map(question => {
                    const isCorrect = question.isSubmitted ? question.submittedAnswer === question.question.answer : null;
                    return {
                        ...question,
                        isCorrect
                    };
                });
                return { ...restData, module: { ...restModule }, generatedQustionSet: updatedQuestions };
            });

            Report.forEach(data => {
                data.generatedQustionSet.forEach(question => {
                    testReport.totalQuestion++;
                    if (question.isSubmitted) {
                        testReport.attemptedQuestions++;
                        if (question.submittedAnswer === question.question.answer) {
                            testReport.correctAnswers++;
                            testReport.obtainedMarks += question.question.maxMarks;
                        } else {
                            testReport.incorrectAnswers++;
                        }
                    } else {
                        testReport.unAttemptedQuestions++;
                    }
                    testReport.totalMarks += question.question.maxMarks;
                });
            });
            testReport.scorePercentage = ((testReport.obtainedMarks / testReport.totalMarks) * 100).toFixed(2);

            let {password, token, purchased_courses, blocked_courses, __v, ...rest} = user.toObject()
            testReports.push({ user:rest, isTestCompleted: true, testReport: testReport, data: newData });
        }

        return res.status(200).send({ success: true, testReports });
    } catch (error) {
        return res.status(500).send({ error: 'Internal Server Error', error });
    }
}