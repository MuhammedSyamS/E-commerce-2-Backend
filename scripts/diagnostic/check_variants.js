const axios = require('axios');
const fs = require('fs');

async function checkProduct() {
    try {
        const res = await axios.get('http://localhost:5005/api/products');
        const products = res.data;
        const productList = Array.isArray(products) ? products : (products.products || []);
        const target = productList.find(p => p.variants && p.variants.length > 0);

        if (target) {
            const data = {
                name: target.name,
                countInStock: target.countInStock,
                variants: target.variants.map(v => ({
                    size: v.size,
                    color: v.color,
                    stock: v.stock
                }))
            };
            fs.writeFileSync('c:/Users/Admin/Desktop/HighPhaus/variant_debug.json', JSON.stringify(data, null, 2));
            console.log("Written to variant_debug.json");
        } else {
            console.log("No products with variants found.");
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

checkProduct();
