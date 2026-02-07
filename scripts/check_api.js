const axios = require('axios');

async function checkApi() {
    try {
        const { data } = await axios.get('http://localhost:5000/api/products');
        console.log("--- API RESPONSE SAMPLE ---");
        if (data.length > 0) {
            const p = data[0];
            console.log(`Name: ${p.name}`);
            console.log(`Stock (countInStock): ${p.countInStock}`);
            console.log(`Stock Type: ${typeof p.countInStock}`);
            console.log("Full Object Keys:", Object.keys(p));
        } else {
            console.log("No products returned");
        }
        console.log("--- END REPORT ---");
    } catch (err) {
        console.error("API Call Failed:", err.message);
    }
}

checkApi();
