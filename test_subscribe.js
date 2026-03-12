const axios = require('axios');

async function testSubscribe() {
    try {
        const response = await axios.post('http://localhost:5005/api/marketing/subscribe', {
            email: 'test' + Date.now() + '@example.com'
        });
        console.log('SUCCESS:', response.data);
    } catch (error) {
        console.error('ERROR:', error.response ? error.response.data : error.message);
    }
}

testSubscribe();
