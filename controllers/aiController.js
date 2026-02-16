const Product = require('../models/Product');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// @desc    Get AI-driven fashion advice and product recommendations
// @route   POST /api/ai/stylist
// @access  Public
exports.getFashionAdvice = async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ message: "What's on your mind? Ask the SLOOK Stylist!" });

        let aiResponse = "";
        let searchKeywords = [];

        // 1. Try Google Gemini for True Intelligence
        if (process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

                const prompt = `You are the SLOOK Elite Stylist. A user asks: "${query}". 
                Respond in a premium, minimalist, and slightly arrogant street-fashion expert tone (SLOOK brand identity).
                Keep the response under 60 words.
                At the end of your response, provide exactly 3-4 keywords that best describe the style/items needed, separated by commas, in this format: [KEYWORDS: key1, key2, key3]`;

                const result = await model.generateContent(prompt);
                const text = result.response.text();

                // Extract keywords from AI response
                const keywordMatch = text.match(/\[KEYWORDS: (.*?)\]/);
                if (keywordMatch) {
                    searchKeywords = keywordMatch[1].split(',').map(k => k.trim());
                    aiResponse = text.replace(/\[KEYWORDS: .*?\]/, '').trim();
                } else {
                    aiResponse = text;
                }
            } catch (aiErr) {
                console.error("Gemini Failure, Falling back...", aiErr.message);
            }
        }

        // 2. Semantic-ish Matcher (Fallback or Primary if no API key)
        const stopWords = ['i', 'want', 'am', 'looking', 'for', 'a', 'the', 'some', 'me', 'show', 'find', 'outfit', 'style', 'what', 'should', 'wear'];
        const fallbackKeywords = query.toLowerCase()
            .replace(/[^\w\s]/gi, '')
            .split(' ')
            .filter(k => k.length > 2 && !stopWords.includes(k));

        const activeKeywords = searchKeywords.length > 0 ? searchKeywords : fallbackKeywords;

        // Find products
        const allProducts = await Product.find({ isApproved: true }).select('name price category images description slug tags');

        let recommendations = allProducts.map(p => {
            let score = 0;
            const searchStr = `${p.name} ${p.category} ${p.description} ${p.tags?.join(' ')}`.toLowerCase();

            activeKeywords.forEach(k => {
                const keyword = k.toLowerCase();
                if (searchStr.includes(keyword)) score += 1;
                if (p.name.toLowerCase().includes(keyword)) score += 2;
                if (p.category.toLowerCase().includes(keyword)) score += 3;
            });

            return { product: p, score };
        })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.product);

        // Fallback or broaden if too few
        if (recommendations.length < 2) {
            const fallback = allProducts
                .filter(p => !recommendations.find(r => r._id === p._id))
                .sort(() => 0.5 - Math.random())
                .slice(0, 4 - recommendations.length);
            recommendations = [...recommendations, ...fallback];
        }

        recommendations = recommendations.slice(0, 4);

        // Final Text Construction
        if (!aiResponse) {
            aiResponse = recommendations.length > 0
                ? `Based on the '${query}' aesthetic, I've curated these specific pieces. They represent the peak of HighPhaus style.`
                : `I couldn't find a direct match for '${query}', but these trending elite pieces elevate any outfit.`;
        }

        res.json({
            text: aiResponse,
            recommendations
        });
    } catch (err) {
        console.error("Stylist Error:", err);
        res.status(500).json({ message: "Stylist is busy, try again soon!" });
    }
};
