const mongoose = require('mongoose');
const { createBroadcast } = require('./controllers/marketingController');
require('dotenv').config();

const simulate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const req = {
            body: {
                subject: 'Simulation Test',
                content: '<p>Testing the broadcast logic from simulation script.</p>',
                targetAudience: 'Subscribers',
                status: 'Sent'
            }
        };

        const res = {
            status: function (code) {
                console.log('Status Called:', code);
                return this;
            },
            json: function (data) {
                console.log('JSON Called with:', JSON.stringify(data, null, 2));
                return this;
            }
        };

        console.log('Invoking createBroadcast...');
        await createBroadcast(req, res);

        console.log('Simulation complete');
        process.exit(0);
    } catch (error) {
        console.error('Simulation failed:', error);
        process.exit(1);
    }
};

simulate();
