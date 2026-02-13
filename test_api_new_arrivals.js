
const axios = require('axios');

const testApi = async () => {
    try {
        console.log("Fetching products from API...");
        const res = await axios.get('http://localhost:5000/api/products');
        const products = res.data;

        console.log(`Fetched ${products.length} products.`);

        const newArrivals = products.filter(p =>
            (Array.isArray(p.tags) && (p.tags.includes('New Arrival') || p.tags.includes('New'))) ||
            p.isNewArrival
        );

        console.log(`Found ${newArrivals.length} New Arrivals via API.`);
        newArrivals.forEach(p => {
            console.log(`- ${p.name} | Tags: ${p.tags} | isNewArrival: ${p.isNewArrival}`);
        });

    } catch (error) {
        console.error("API Error:", error.message);
    }
};

testApi();
