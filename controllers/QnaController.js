import QnaModel from "../model/Qna.model.js"
import TestModuleModel from "../model/Testmodule.model.js"
import UsertestreportModel from "../model/Usertestreport.model.js";

/** POST: http://localhost:8080/api/addquestiontomodule
* @param: {
    "header" : "Admin <token>"
}
body: {
    "module_id":"6620b6b7a3340a8de1a70bc0",
    "question": "This is a question",
    "options":{
        "opt_1":"Option 1",
        "opt_2":"Option 2",
        "opt_3":"Option 3",
        "opt_4":"Option 4"
    },
    "answer": "opt_3"
}
*/
export async function addQuestionToModule(req, res) {
	try {
		const question = req.body
        // console.log(question);
        const TestModule = await TestModuleModel.findOne({
			_id:question.module_id
		})

		if (!TestModule) {
			return res
				.status(404)
				.json({ error: 'Invalid module ID' })
		}

		const newQuestion = new QnaModel(question)
		await newQuestion.save()
        if (newQuestion.id) {
            TestModule.questions.push(newQuestion.id)
            await TestModule.save()
        }

		return res.status(201).json({
			message: 'Question added successfully',
			data: newQuestion,
		})
	} catch (error) {
        console.log(error);
		return res.status(500).json({ message: 'Internal server error', error })
	}
}

/** GET: http://localhost:8080/api/gettestquestions NOT IN USE RN*/  
export async function getTestQuestions(req, res) {
	try {
		TestModuleModel.find({ }).populate('questions')
			.exec()
			.then((questions) => {
				let extractedData = questions.map(questionSet => {
					let { _id, module_name, module_description, questions } = questionSet;
					let processedQuestions = questions.map(({ _id, question, options, __v, maxMarks }) => ({ _id, question, options, __v, maxMarks }));
					return { _id, module_name, module_description, questions: processedQuestions };
				})
				return res.status(200).send({ success: true, data: extractedData })
			})
			.catch((err) => {
				return res.status(404).send({ error: 'Cannot Find questions Data', err })
			})
	} catch (error) {
		return res.status(500).send({ error: 'Internal Server Error', error })
	}
}

/** GET: http://localhost:8080/api/getmodulequestions?module_id=6620c1a48cb4bcb50f84748f&index=1 
* @param: {
    "header" : "User <token>"
}
*/ 
export async function getModuleQuestions(req, res) {
    function shuffleArray(array) {
        const shuffledIds = array.map(item => item._id);
        for (let i = shuffledIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
        }
        return shuffledIds.map(id => ({ "question": id }));
    }    

    try {
        const { userID } = req.user;
        const { module_id, index } = req.query;

        if (!module_id) {
            return res.status(500).send({ success: false, message: 'module_id required.' });
        }
        
        if (!index) {
            return res.status(500).send({ success: false, message: 'index required.' });
        }

        let Usertestreport = await UsertestreportModel.findOne({ user: userID, module: module_id }).populate('generatedQustionSet.question');
        if (!Usertestreport) {
            Usertestreport = new UsertestreportModel({ user: userID, module: module_id, generatedQustionSet: [] }); // Change {} to []
        }

        let questions = await TestModuleModel.findOne({ _id: module_id }).populate('questions');
        let QuestionsData = questions.questions.map((question) => {
            const { answer, ...rest } = question.toObject();
            return rest;
        });

        if (!Usertestreport.generatedQustionSet.length) { // Check for array length instead of existence
            // console.log(shuffleArray(QuestionsData));
            Usertestreport.generatedQustionSet = shuffleArray(QuestionsData);
            await Usertestreport.save(); // Save the document after setting the generatedQustionSet
        }

        const fetchAgain = await UsertestreportModel.findOne({ user: userID, module: module_id }).populate('generatedQustionSet.question').populate('module')
        const data = fetchAgain.generatedQustionSet.map((data)=> {
            const {question, ...rest} = data.toObject()
            const {answer, ...restdata} = question
            return({module: fetchAgain.module.module_name, ...rest, question:restdata,});
        })

        // if (index) {
        return res.status(200).send({ success: data[index - 1] ? true : false, length: data.length, data: data[index - 1] ? data[index - 1] : `Max index = ${data.length}` });
        // } else {
        //     return res.status(200).send({ success: true, data: data });
        // }
    } catch (error) {
        return res.status(500).send({ error: 'Internal Server Error', error });
    }
}

/** PUT: http://localhost:8080/api/submittestanswer
 * @param: {
    "header" : "User <token>"
}
 * @body : {
    "moduleID": { type: mongoose.Schema.Types.ObjectId, ref: 'Qnas' }
    "questionID": { type: mongoose.Schema.Types.ObjectId, ref: 'Qnas' },
    "answer": { type: String }
}
*/
export async function submitAnswer(req, res) {
    try {
        const { userID } = req.user;
        const { questionID, moduleID, answer } = req.body;
        // Find the user's test report based on userID and moduleID
        const testReport = await UsertestreportModel.findOne({ user: userID, module: moduleID });

        if (!testReport) {
            return res.status(404).send({ success: false, message: 'Test report not found' })
        }

        // Find the index of the question in the generatedQustionSet array
        const questionIndex = testReport.generatedQustionSet.findIndex(item => item.question.toString() === questionID);

        if (questionIndex === -1) {
            return res.status(404).send({ success: false, message: 'Question not found in the generated question set' })
        }

        // Check if the answer for this question is already submitted
        if (testReport.generatedQustionSet[questionIndex].isSubmitted) {
            return res.status(500).send({ success: false, message: 'Answer for this question is already submitted' })
        }

        // Update the submitted answer for the question
        testReport.generatedQustionSet[questionIndex].submittedAnswer = answer;
        testReport.generatedQustionSet[questionIndex].isSubmitted = true; // Optionally, mark the question as submitted

        // Save the updated test report
        await testReport.save();
        return res.status(200).send({ success: true, message: 'Answer submitted successfully' })
    } catch (error) {
        return res.status(501).send({ success: false, message: 'Error submitting answer' + error.message })
    }
}

/** GET http://localhost:8080/api/testsubmitteduserslist  */
export async function testSubmittedUsersList(req, res) {
    try {
        const completedReports = await UsertestreportModel.find({}).populate('user', 'name phone').exec();

        const userData = {};

        completedReports.forEach(report => {
            const userId = report.user._id.toString();

            if (!userData[userId]) {
                userData[userId] = {
                    name: report.user.name,
                    phone: hidePhone(report.user.phone),
                    allModulesCompleted: true
                };
            }

            if (!report.isModuleCompleted) {
                userData[userId].allModulesCompleted = false;
            }
        });

        const uniqueUsers = Object.values(userData).filter(user => user.allModulesCompleted);

        return res.status(200).send({ success: true, data: uniqueUsers });
    } catch (error) {
        return res.status(501).send({ success: false, message: 'Error fetching completed users: ' + error.message });
    }
}
function hidePhone(phone) {
    phone = phone.toString()
    if (phone && phone.length >= 10) {
        return phone.substring(0, 3) + '****' + phone.substring(phone.length - 3);
    }
    return phone;
}

/** PUT: http://localhost:8080/api/updatedQuestionViaCSV
 * @param: {
    "header" : "User <token>"
}
 * @body : {
    "moduleID": { type: mongoose.Schema.Types.ObjectId, ref: 'Qnas' }
    "questionID": { type: mongoose.Schema.Types.ObjectId, ref: 'Qnas' },
    "answer": { type: String }
}
*/
export async function updatedQuestionViaCSV(req, res) {
    
}