const axios = require('axios');

const checkApi = async () => {
    try {
        console.log("Fetching http://localhost:5000/api/products/reviews/featured ...");
        const { data } = await axios.get('http://localhost:5000/api/products/reviews/featured');

        console.log("\n--- API RESPONSE ---");
        console.log(`Count: ${data.length}`);
        if (data.length > 0) {
            console.log("First Review Item:", JSON.stringify(data[0], null, 2));
        } else {
            console.log("Response is EMPTY array.");
        }
        console.log("--------------------\n");
    } catch (err) {
        console.error("API Call Failed:", err.message);
        if (err.response) {
            console.error("Status:", err.response.status);
            console.error("Data:", err.response.data);
        }
    }
};

checkApi();
