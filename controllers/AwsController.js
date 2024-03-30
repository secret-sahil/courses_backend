import aws from 'aws-sdk'
import multer from 'multer'
import multerS3 from 'multer-s3'

// upading AWS config
aws.config.update({
    secretAccessKey: process.env.AWS_ACCESS_SECRET,
    accessKeyId: process.env.AWS_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const BUCKET = process.env.AWS_BUCKET
const s3 = new aws.S3();

// middleware
export const upload = multer({
    storage: multerS3({
        s3: s3,
        acl: "public-read",
        bucket: BUCKET,
        metadata: function (req, file, cb) {
            cb(null, {
                fieldName: file.fieldname,
                'Content-Type': file.mimetype,
            });
        },
        key: function (req, file, cb) {
            cb(null, Date.now().toString()+ '-' +file.originalname)
        }
    })
})

/** POST: http://localhost:8080/api/uploadfiletoaws
    body:{
        file: file.mp4
    }
**/
export async function uploadFile(req, res) {
    return res.status(200).json({ success: true, message: 'Successfully Uploaded', url: req.file.location });
}

/** GET: http://localhost:8080/api/getfilesfromaws */
export async function getfilesfromaws(req, res) {
    let r = await s3.listObjectsV2({ Bucket: BUCKET }).promise();
    let data = []
    r.Contents.map(item => {
        data.push({
            key: item.Key,
            url:  `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}`
        })
    })
    return res.status(200).json({success: true, data})
}

/** GET: http://localhost:8080/api/getfilefromaws/:filename */
export async function getfilefromaws(req, res) {
    const filename = req.params.filename
    
    if (!filename) {
        return res.status(500).json({success: false, message: "File name is required"})
    }
    try {
        let data = await s3.getObject({ Bucket: BUCKET, Key: filename }).promise();
        return res.send(data.Body)
    } catch (error) {
        return res.status(500).json({success: false, message: "File Not Found"})
    }
}

/** DELETE: http://localhost:8080/api/deletefilefromaws/:filename */
export async function deleteFileFromAWS(req, res) {
    const filename = req.params.filename
    
    if (!filename) {
        return res.status(500).json({success: false, message: "File name is required"})
    }

    try {
        await s3.deleteObject({ Bucket: BUCKET, Key: filename }).promise();
        return res.status(200).json({success: true, message: "File Deleted Successfully"})
    } catch (error) {
        return res.status(500).json({success: false, message: "File Not Found"})
    }
}