const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// ROBOTS.TXT
router.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send("User-agent: *\nAllow: /\nSitemap: https://slook.luxury/sitemap.xml");
});

// SITEMAP.XML (Dynamic)
router.get('/sitemap.xml', async (req, res) => {
    try {
        const products = await Product.find({}).select('slug updatedAt');
        const baseUrl = 'https://slook.luxury';

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

        // Static Pages
        const staticPages = ['', '/shop', '/about', '/contact', '/blog'];
        staticPages.forEach(page => {
            xml += `  <url>\n    <loc>${baseUrl}${page}</loc>\n    <changefreq>weekly</changefreq>\n  </url>\n`;
        });

        // Dynamic Products
        products.forEach(p => {
            xml += `  <url>\n    <loc>${baseUrl}/product/${p.slug}</loc>\n    <lastmod>${p.updatedAt.toISOString().split('T')[0]}</lastmod>\n    <changefreq>daily</changefreq>\n  </url>\n`;
        });

        xml += '</urlset>';

        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (error) {
        res.status(500).send("Error generating sitemap");
    }
});

module.exports = router;
