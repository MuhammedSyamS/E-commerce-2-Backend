const axios = require('axios');

const test = async () => {
    try {
        console.log("Calling subscribe endpoint...");
        const res = await axios.post('http://127.0.0.1:5005/api/marketing/subscribe', {
            email: "debug_test_4@example.com"
        });
        console.log("Response:", res.data);
    } catch (err) {
        console.log("Error status:", err.response?.status);
        console.log("Error data:", err.response?.data);
    }
}

test();
