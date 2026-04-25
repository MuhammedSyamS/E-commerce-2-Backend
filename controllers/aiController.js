const Product = require('../models/Product');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

// @desc    Get AI-driven fashion advice and product recommendations
// @route   POST /api/ai/stylist
// @access  Public
exports.getFashionAdvice = async (req, res) => {
    try {
        const { query } = req.body;
        console.log(`[AI] Request received: "${query}"`);
        if (!query) return res.status(400).json({ message: "What's on your mind? Ask the SLOOK AI!" });

        let aiResponse = "";
        let searchKeywords = [];

        // System prompt for SLOOK Brand Identity
        const fashionPrompt = `You are the SLOOK Elite AI Stylist. A user asks: "${query}". 
        Respond in a premium, minimalist, and slightly arrogant street-fashion expert tone (SLOOK brand identity).
        Keep the response under 60 words.
        At the end of your response, provide exactly 3-4 keywords that best describe the style/items needed, separated by commas, in this format: [KEYWORDS: key1, key2, key3]`;

        // --- AI PROVIDER LOGIC (Priority: BluesMinds -> Anthropic -> Gemini) ---

        // 1. BluesMinds (OpenAI-compatible)
        if (process.env.BLUESMINDS_API_KEY) {
            try {
                const baseUrl = process.env.BLUESMINDS_BASE_URL || 'https://api.bluesminds.com/v1';
                const model = process.env.BLUESMINDS_MODEL || 'gpt-4o-mini';

                const response = await axios.post(`${baseUrl}/chat/completions`, {
                    model: model,
                    messages: [
                        { role: "system", content: "You are the SLOOK Elite Stylist. Respond in a premium, minimalist street-fashion expert tone." },
                        { role: "user", content: fashionPrompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 300
                }, {
                    headers: {
                        'Authorization': `Bearer ${process.env.BLUESMINDS_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });

                const text = response.data.choices[0].message.content;
                console.log("[AI] BluesMinds Success");
                const keywordMatch = text.match(/\[KEYWORDS: (.*?)\]/);
                if (keywordMatch) {
                    searchKeywords = keywordMatch[1].split(',').map(k => k.trim());
                    aiResponse = text.replace(/\[KEYWORDS: .*?\]/, '').trim();
                } else {
                    aiResponse = text;
                }
            } catch (err) {
                console.error("BluesMinds API Failure:", err.response?.data || err.message);
            }
        }

        // 2. Fallback to Anthropic if BluesMinds fails or is not configured
        if (!aiResponse && process.env.ANTHROPIC_API_KEY) {
            try {
                const response = await axios.post('https://api.anthropic.com/v1/messages', {
                    model: "claude-3-5-sonnet-20240620",
                    max_tokens: 1024,
                    messages: [{ role: "user", content: fashionPrompt }],
                    system: "You are the SLOOK Elite Stylist. Respond in a premium, minimalist, and slightly arrogant street-fashion expert tone."
                }, {
                    headers: {
                        'x-api-key': process.env.ANTHROPIC_API_KEY,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    }
                });

                const text = response.data.content[0].text;
                const keywordMatch = text.match(/\[KEYWORDS: (.*?)\]/);
                if (keywordMatch) {
                    searchKeywords = keywordMatch[1].split(',').map(k => k.trim());
                    aiResponse = text.replace(/\[KEYWORDS: .*?\]/, '').trim();
                } else {
                    aiResponse = text;
                }
            } catch (anthropicErr) {
                console.error("Anthropic Failure:", anthropicErr.response?.data || anthropicErr.message);
            }
        }

        // 3. Fallback to Gemini
        if (!aiResponse && process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

                const result = await model.generateContent(fashionPrompt);
                const text = result.response.text();

                const keywordMatch = text.match(/\[KEYWORDS: (.*?)\]/);
                if (keywordMatch) {
                    searchKeywords = keywordMatch[1].split(',').map(k => k.trim());
                    aiResponse = text.replace(/\[KEYWORDS: .*?\]/, '').trim();
                } else {
                    aiResponse = text;
                }
            } catch (aiErr) {
                console.error("Gemini Failure:", aiErr.message);
            }
        }

        // --- PRODUCT RECOMMENDATION LOGIC ---
        
        // Semantic Matcher
        const stopWords = ['i', 'want', 'am', 'looking', 'for', 'a', 'the', 'some', 'me', 'show', 'find', 'outfit', 'style', 'what', 'should', 'wear'];
        const fallbackKeywords = query.toLowerCase()
            .replace(/[^\w\s]/gi, '')
            .split(' ')
            .filter(k => k.length > 2 && !stopWords.includes(k));

        const activeKeywords = searchKeywords.length > 0 ? searchKeywords : fallbackKeywords;

        // Fetch products
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

        // Fill empty spots
        if (recommendations.length < 2) {
            const fallback = allProducts
                .filter(p => !recommendations.find(r => r._id === p._id))
                .sort(() => 0.5 - Math.random())
                .slice(0, 4 - recommendations.length);
            recommendations = [...recommendations, ...fallback];
        }

        recommendations = recommendations.slice(0, 4);

        // Final Response
        if (!aiResponse) {
            aiResponse = recommendations.length > 0
                ? `I've analyzed the '${query}' trend. These SLOOK artifacts are the definitive choice for your collection.`
                : `The '${query}' aesthetic is rare. Here are some elite trending pieces to bridge the gap.`;
        }

        res.json({
            text: aiResponse,
            recommendations
        });
    } catch (err) {
        console.error("Stylist Controller Error:", err);
        res.status(500).json({ message: "SLOOK AI is momentarily unavailable." });
    }
};
