import slugify from "slugify";
import cartModel from '../model/Cart.model.js'
import wishlistModel from '../model/Wishlist.model.js'
import CoursesModel from "../model/Courses.model.js";
import UserModel from "../model/User.model.js";
/** POST: http://localhost:8080/api/addcourse
* @body : {
    dummy.json
}
*/
export async function addcourse(req, res) {
	try {
		const courseData = req.body
        courseData.slug = slugify(courseData.title)
		let course = new CoursesModel(courseData)
		await course.save()
		res.status(201).json({ success: true, msg: 'Course added successfully' })
	} catch (error) {
		console.error(error)
		res.status(500).json({ success: false, msg: 'Internal server error' })
	}
}

/** GET: http://localhost:8080/api/courses */
export async function getCourses(req, res) {
    let {category,subcategory,sort,price_min,price_max,search,populate} = req.query
	try {
		let query = {};

		// Add category and subcategory to the query if provided
		if (category) {
			query.category = category;
		}
		if (subcategory) {
			query.subcategory = subcategory;
		}

		// Add price range to the query if provided
		if (price_min !== undefined && price_max !== undefined) {
			query.base_price = { $gte: price_min, $lte: price_max };
		} else if (price_min !== undefined) {
			query.base_price = { $gte: price_min };
		} else if (price_max !== undefined) {
			query.base_price = { $lte: price_max };
		}

        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }

		// Build the sort object based on the 'sort' parameter
		let sortObj = {};
		if (sort === 'price_asc') {
			sortObj.base_price = 1;
		} else if (sort === 'price_desc') {
			sortObj.base_price = -1;
		}
		
		const courses = await CoursesModel.find(query).sort(sortObj).populate(populate)
		res.status(200).json(courses)
	} catch (err) {
		res.status(500).send('Internal Server Error')
	}
}

/** GET: http://localhost:8080/api/course/:coursename */
export async function getCourseBySlug(req, res) {
	try {
        const { coursename } = req.params
        const course = await CoursesModel.findOne({slug:coursename})

        if (!course) {
            return res.status(404).json({ success: false, message: 'Courses not found' });
        }

        res.status(200).json({ success: true, course });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

/** PUT: http://localhost:8080/api/purchasecourse 
 * @param: {
    "header" : "Bearer <token>"
}
body: {
    "courseId": "65eee9fa38d32c2479937d44"
}
*/
export async function purchasedCourse(req, res) {
    try {
        const { userID } = req.user;
        const { courseId } = req.body;

        if (!userID || !courseId) {
            return res.status(400).json({ message: 'Both user ID and course ID are required' });
        }

        const user = await UserModel.findById(userID);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the course is already purchased
        if (user.purchased_courses.includes(courseId)) {
            return res.status(400).json({ message: 'Course already purchased' });
        }

        const course = await CoursesModel.findById(courseId);

        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        user.purchased_courses.push(courseId);

        await user.save();

        return res.status(200).json({ message: 'Course purchased successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

/** POST: http://localhost:8080/api/addtocart
body: {
    "email": "example@gmail.com",
    "courseid": "65c4ba60866d0d5a6fc4a82b",
    "quantity":1,
}
*/
export async function addToCart(req, res) {
	let userID = req.userID
	try {
        const { courseid } = req.body;
        
        const course = await CoursesModel.findById(courseid);
        if (!course) {
            return res.status(404).json({ success: false, message: 'course not found' });
        }
        // Find the cart for the user
        let cart = await cartModel.findOne({ _id:userID }).populate('courses.course');

        // If the user has no cart, create a new one
        if (!cart) {
            cart = new cartModel({ _id:userID, courses: [] });
        }

        const existingCartIndex = cart.courses.findIndex(p => p.course.equals(course._id));
        if (existingCartIndex == -1) {
            cart.courses.push({ course:courseid });
        }
        
        await cart.save();

        res.status(201).json({success: true, msg: 'Course added to cart successfully', data: cart.courses });
    } catch (error) {
        console.error(error);
        res.status(500).json({success: false, msg: 'Internal server error' });
    }
}

/** POST: http://localhost:8080/api/removefromcart
body: {
    "email": "example@gmail.com",
    "courseid": "65c4ba60866d0d5a6fc4a82b",
}
*/
export async function removeFromCart(req, res) {
    let userID = req.userID;
    try {
        const { courseid } = req.body;

        const course = await CoursesModel.findById(courseid);
        if (!course) {
            return res.status(404).json({ success: false, message: 'course not found' });
        }

        // Find the cart for the user
        let cart = await cartModel.findOne({ _id: userID }).populate('courses.course');

        // If the user has no cart, return with a message
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found for the user' });
        }

        const existingCartIndex = cart.courses.findIndex(p => p.course.equals(courseid));

        // If the course is not found in the cart, return with a message
        if (existingCartIndex === -1) {
            return res.status(404).json({ success: false, message: 'course not found in the cart' });
        }

        cart.courses.splice(existingCartIndex, 1);

        await cart.save();

        res.status(200).json({ success: true, message: 'Operation successful', data:cart.courses });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

/** GET: http://localhost:8080/api/getcart
query: {
    "email": "example@gmail.com",
}
*/
export async function getcart(req, res) {
	let userID = req.userID
	try {
        // Find the cart document and populate the courses field with course data
        const cart = await cartModel.findOne({_id:userID}).populate('courses.course');

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        res.status(200).json({ success: true, cart:cart.courses });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

/** POST: http://localhost:8080/api/addtowishlist
body: {
    "email": "example@gmail.com",
    "courseid": "65c4ba60866d0d5a6fc4a82b",
}
*/
export async function addtowishlist(req, res) {
	let userID = req.userID
	try {
        const { courseid } = req.body;
		
		// Fetch the course data
		const course = await CoursesModel.findById(courseid);
        if (!course) {
            return res.status(404).json({ success: false, message: 'course not found' });
        }

        // Find the wishlist for the user
        let wishlist = await wishlistModel.findOne({ _id:userID });

        // If the user has no wishlist, create a new one
        if (!wishlist) {
            wishlist = new wishlistModel({ _id:userID, courses: [] });
        }

        const existingCartIndex = wishlist.courses.findIndex(p => p.course.equals(course._id));

        if (existingCartIndex == -1) {
            wishlist.courses.push({ course:course._id});
        }

        await wishlist.save();
        res.status(201).json({success: true, msg: 'course added to wishlist successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({success: false, msg: 'Internal server error' });
    }
}

/** POST: http://localhost:8080/api/removefromwishlist
body: {
    "email": "example@gmail.com",
    "courseid": "65c4ba60866d0d5a6fc4a82b",
}
*/
export async function removeFromWishlist(req, res) {
    let userID = req.userID;
    try {
        const { courseid } = req.body;

        // Find the wishlist for the user
        let wishlist = await wishlistModel.findOne({ _id: userID }).populate('courses.course');

        // If the user has no wishlist, return with a message
        if (!wishlist) {
            return res.status(404).json({ success: false, message: 'Wishlist not found for the user' });
        }

        const existingCartIndex = wishlist.courses.findIndex(p => p.course.equals(courseid));

        // If the course is not found in the wishlist, return with a message
        if (existingCartIndex === -1) {
            return res.status(404).json({ success: false, message: 'course not found in the wishlist' });
        }

        // Remove the course from the wishlist
        wishlist.courses.splice(existingCartIndex, 1);

        await wishlist.save();
        res.status(200).json({ success: true, message: 'course removed from wishlist successfully', data:wishlist.courses });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

/** GET: http://localhost:8080/api/getwishlist
query: {
    "email": "example@gmail.com",
}
*/
export async function getwishlist(req, res) {
	let userID = req.userID
	try {
        // Find the cart document and populate the courses field with course data
        const wishlist = await wishlistModel.findOne({_id:userID}).populate('courses.course');

        if (!wishlist) {
            return res.status(404).json({ success: false, message: 'wishlist not found' });
        }

        res.status(200).json({ success: true, wishlist:wishlist.courses });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}