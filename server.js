// server.js
require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
// Parse webhook requests as raw buffer
app.use('/webhook', express.raw({ type: 'application/json' }));
// Parse regular requests as JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Store payment status (In production, use a database)
const paymentStatus = new Map();

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Webhook handler
app.post('/webhook', (req, res) => {
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('Webhook secret is not configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    try {
        // Get razorpay signature from headers
        const razorpaySignature = req.headers['x-razorpay-signature'];

        if (!razorpaySignature) {
            console.error('Razorpay signature is missing');
            return res.status(400).json({ error: 'Signature is missing' });
        }

        // Parse the raw body
        const webhookBody = req.body.toString();
        
        // Create signature
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(webhookBody)
            .digest('hex');

        // Verify signature
        if (razorpaySignature === expectedSignature) {
            const payload = JSON.parse(webhookBody);
            console.log('Webhook verified. Payload:', payload);

            // Handle payment events
            if (payload.event === 'payment.captured') {
                const paymentId = payload.payload.payment.entity.id;
                paymentStatus.set(paymentId, {
                    status: 'success',
                    details: payload.payload.payment.entity
                });
                console.log(`Payment ${paymentId} successful`);
            } else if (payload.event === 'payment.failed') {
                const paymentId = payload.payload.payment.entity.id;
                paymentStatus.set(paymentId, {
                    status: 'failed',
                    details: payload.payload.payment.entity
                });
                console.log(`Payment ${paymentId} failed`);
            }

            res.json({ status: 'ok' });
        } else {
            console.error('Webhook signature verification failed');
            res.status(400).json({ error: 'Invalid signature' });
        }
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// Check payment status
app.get('/payment-status/:paymentId', (req, res) => {
    const status = paymentStatus.get(req.params.paymentId);
    if (status) {
        res.json(status);
    } else {
        res.json({ status: 'pending' });
    }
});

// Create order
app.post('/create-order', async (req, res) => {
    try {
        const options = {
            amount: 100, // ₹1
            currency: 'INR',
            receipt: 'order_' + Date.now(),
            payment_capture: 1
        };

        console.log('Creating order with options:', options);
        const order = await razorpay.orders.create(options);
        console.log('Order created:', order);
        res.json(order);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Something went wrong!', details: error.message });
    }
});

// Verify payment
app.post('/verify-payment', (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSign = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(sign)
            .digest('hex');

        if (razorpay_signature === expectedSign) {
            res.json({ status: 'success' });
        } else {
            res.status(400).json({ status: 'failure', message: 'Invalid signature' });
        }
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Environment variables loaded:');
    console.log('- RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID ? 'Set' : 'Not set');
    console.log('- RAZORPAY_KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET ? 'Set' : 'Not set');
    console.log('- WEBHOOK_SECRET:', process.env.WEBHOOK_SECRET ? 'Set' : 'Not set');
});