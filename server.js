// server.js
const express = require('express');
const Razorpay = require('razorpay');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public')); // Serve frontend from public folder

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// server.js
app.post('/api/create-order', async (req, res) => {
    try {
        console.log('Creating order for amount:', req.body.amount);
        const options = {
            amount: req.body.amount * 100,
            currency: 'INR',
            receipt: 'order_' + Date.now()
        };
        const order = await razorpay.orders.create(options);
        console.log('Order created:', order);
        res.json(order);
    } catch (error) {
        console.error('Order creation failed:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/verify-payment', async (req, res) => {
    try {
        console.log('📌 Verification started');
        console.log('Received payment data:', JSON.stringify(req.body, null, 2));

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            console.log('❌ Missing required fields');
            return res.status(400).json({ 
                status: 'error',
                message: 'Missing required fields',
                received: req.body 
            });
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        console.log('Expected signature:', expectedSignature);
        console.log('Received signature:', razorpay_signature);

        const isValid = expectedSignature === razorpay_signature;
        console.log('Signature valid?:', isValid);

        if (isValid) {
            console.log('✅ Payment verified successfully');
            res.json({ status: 'success' });
        } else {
            console.log('❌ Signature verification failed');
            res.status(400).json({ 
                status: 'failure',
                debug: {
                    expected: expectedSignature,
                    received: razorpay_signature
                }
            });
        }
    } catch (error) {
        console.error('💥 Verification error:', error);
        res.status(500).json({ 
            status: 'error',
            message: error.message 
        });
    }
});

// Add this debug endpoint
app.get('/api/debug', (req, res) => {
    res.json({
        env: {
            nodeEnv: process.env.NODE_ENV,
            port: process.env.PORT,
            // Don't expose the actual keys, just check if they exist
            hasRazorpayKeyId: !!process.env.RAZORPAY_KEY_ID,
            hasRazorpayKeySecret: !!process.env.RAZORPAY_KEY_SECRET,
            // Show first 4 chars of keys to verify they're correct
            keyIdPrefix: process.env.RAZORPAY_KEY_ID?.substring(0, 4),
            keySecretPrefix: process.env.RAZORPAY_KEY_SECRET?.substring(0, 4)
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});