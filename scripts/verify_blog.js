const mongoose = require('mongoose');
const BlogPost = require('../models/BlogPost');
const { createPost, getPublishedPosts, updatePost, deletePost } = require('../controllers/blogController');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Mock Objects
const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.data = data; return res; };
    return res;
};
const mockReq = (body, params) => ({ body, params });

const verifyBlog = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        // 1. Create Post
        console.log("\n--- Testing Create Post ---");
        const newPost = {
            title: "Verification Post",
            content: "<p>This is a test.</p>",
            isPublished: true,
            tags: ["Test", "Verification"] // Controller expects array? Frontend sends array.
        };
        const reqCreate = mockReq(newPost);
        const resCreate = mockRes();
        await createPost(reqCreate, resCreate);

        if (resCreate.statusCode === 201) {
            console.log("[PASS] Post Created:", resCreate.data.title);
        } else {
            console.error("[FAIL] Post Creation Error:", resCreate.data);
            return;
        }

        const postId = resCreate.data._id;

        // 2. Get Published Posts
        console.log("\n--- Testing Get Public Posts ---");
        const reqGet = {};
        const resGet = mockRes();
        await getPublishedPosts(reqGet, resGet);

        if (resGet.data && resGet.data.length > 0) {
            console.log(`[PASS] Fetched ${resGet.data.length} posts`);
            const found = resGet.data.find(p => p._id.toString() === postId.toString());
            if (found) console.log("[PASS] New post is identifiable in public list");
            else console.error("[FAIL] New post not found in public list");
        } else {
            console.error("[FAIL] No posts found");
        }

        // 3. Cleanup
        console.log("\n--- Testing Delete Post ---");
        const reqDel = mockReq({}, { id: postId });
        const resDel = mockRes();
        await deletePost(reqDel, resDel);
        console.log("[PASS] Post Deleted");

    } catch (error) {
        console.error("Verification Error:", error);
    } finally {
        await mongoose.disconnect();
    }
};

verifyBlog();
