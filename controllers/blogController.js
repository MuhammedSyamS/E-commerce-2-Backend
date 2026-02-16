const BlogPost = require('../models/BlogPost');

// @desc    Get all published posts (Public)
// @route   GET /api/blog
// @access  Public
exports.getPublishedPosts = async (req, res) => {
    try {
        const posts = await BlogPost.find({ isPublished: true }).sort({ publishedAt: -1 });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch posts' });
    }
};

// @desc    Get all posts (Admin)
// @route   GET /api/blog/admin
// @access  Private/Admin
exports.getAllPosts = async (req, res) => {
    try {
        const posts = await BlogPost.find({}).sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch posts' });
    }
};

// @desc    Get single post by slug
// @route   GET /api/blog/:slug
// @access  Public
exports.getPostBySlug = async (req, res) => {
    try {
        const post = await BlogPost.findOne({ slug: req.params.slug });
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }
        res.json(post);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch post' });
    }
};

// @desc    Create new post
// @route   POST /api/blog
// @access  Private/Admin
exports.createPost = async (req, res) => {
    try {
        const { title, content, coverImage, tags, isPublished } = req.body;

        let slug = req.body.slug;
        if (!slug && title) {
            slug = title.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
        }

        const post = new BlogPost({
            title,
            slug,
            content,
            coverImage,
            tags,
            isPublished,
            publishedAt: isPublished ? Date.now() : null
        });

        await post.save();
        res.status(201).json(post);
    } catch (error) {
        console.error(error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Slug already exists. Choose a different title.' });
        }
        res.status(500).json({ message: 'Failed to create post' });
    }
};

// @desc    Update post
// @route   PUT /api/blog/:id
// @access  Private/Admin
exports.updatePost = async (req, res) => {
    try {
        const { title, content, coverImage, tags, isPublished } = req.body;

        const post = await BlogPost.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        post.title = title || post.title;
        post.content = content || post.content;
        post.coverImage = coverImage || post.coverImage;
        post.tags = tags || post.tags;

        if (isPublished !== undefined) {
            // If publishing now and wasn't before
            if (isPublished && !post.isPublished) {
                post.publishedAt = Date.now();
            }
            post.isPublished = isPublished;
        }

        // Slug regen logic if title changes? Maybe optional. For now, let's keep slug stable to avoid broken links.

        await post.save();
        res.json(post);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update post' });
    }
};

// @desc    Delete post
// @route   DELETE /api/blog/:id
// @access  Private/Admin
exports.deletePost = async (req, res) => {
    try {
        const post = await BlogPost.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }
        await post.deleteOne();
        res.json({ message: 'Post removed' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete post' });
    }
};
