require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Serve the payment page
app.get('/', (req, res) => {
    // Pass the public key to the frontend
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint to get public key
app.get('/get-razorpay-key', (req, res) => {
    res.json({
        key: process.env.RAZORPAY_KEY_ID
    });
});

// Create order
app.post('/create-order', async (req, res) => {
    try {
        const options = {
            amount: 100, // amount in paise (100 paise = ₹1)
            currency: 'INR',
            receipt: 'receipt_' + Date.now()
        };

        const order = await razorpay.orders.create(options);
        res.json({
            success: true,
            order_id: order.id
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Verify payment
app.post('/verify-payment', (req, res) => {
    const {
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature
    } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
        res.json({
            success: true,
            message: 'Payment verified successfully'
        });
    } else {
        res.json({
            success: false,
            message: 'Payment verification failed'
        });
    }
});

// Webhook endpoint
app.post('/webhook', (req, res) => {
    const shasum = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (digest === req.headers['x-razorpay-signature']) {
        console.log('Payment successful');
        const event = req.body.event;
        
        // Handle different webhook events
        switch (event) {
            case 'payment.captured':
                // Payment successful
                break;
            case 'payment.failed':
                // Payment failed
                break;
            // Add more event handlers as needed
        }

        res.json({ status: 'ok' });
    } else {
        res.status(400).json({ status: 'invalid signature' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});