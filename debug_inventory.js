const axios = require('axios');

async function testInventory() {
    try {
        console.log("1. Fetching current products...");
        const res1 = await axios.get('http://localhost:5000/api/products');
        console.log(`Current Count: ${res1.data.length}`);

        if (res1.data.length > 0) {
            console.log("Sample:", res1.data[0].name);
        }

        /*
        console.log("2. Creating Test Product...");
        const newProduct = {
            name: "Debug Test Product " + Date.now(),
            price: 100,
            category: "Rings",
            image: "placeholder.jpg",
            countInStock: 10
        };
        // Note: Needs Auth Token to create.
        */

    } catch (err) {
        console.error("Error:", err.message);
        if (err.response) console.error("Response:", err.response.data);
    }
}

testInventory();
