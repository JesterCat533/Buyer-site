// --- FILE: server.js ---

import express from 'express';
import Stripe from 'stripe';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

// Utility for __dirname in ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- ENVIRONMENT SETUP ---
// NOTE: We assume environment variables are available via Render or other means
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const PORT = process.env.PORT || 3000;

if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !DISCORD_WEBHOOK_URL) {
    console.error("Missing critical environment variables! Check STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, or DISCORD_WEBHOOK_URL.");
}

const stripe = new Stripe(STRIPE_SECRET_KEY);
const app = express();

// --- Middleware for JSON Parsing ---
// NOTE: For webhooks, we must use raw body first, then apply JSON parsing only to non-webhook routes.

// 1. Webhook middleware (raw body needed for signature verification)
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`⚠️ Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event based on type
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log(`✅ Checkout session completed for session ID: ${session.id}`);

        // --- Discord Notification Logic ---
        try {
            const amountInDollars = (session.amount_total / 100).toFixed(2);
            const currency = session.currency.toUpperCase();
            
            const discordPayload = {
                username: "Stripe Custom Store Bot",
                embeds: [{
                    title: "✅ NEW ORDER RECEIVED (Custom Form)",
                    description: `A new payment of **${amountInDollars} ${currency}** has been processed.`,
                    color: 3066993, // Green
                    fields: [
                        { name: "Session ID", value: session.id, inline: false },
                        { name: "Customer Email", value: session.customer_details?.email || "N/A", inline: true },
                        { name: "Payment Status", value: session.payment_status.toUpperCase(), inline: true },
                    ],
                    timestamp: new Date().toISOString(),
                }]
            };

            await axios.post(DISCORD_WEBHOOK_URL, discordPayload);
            console.log('Purchase receipt sent to Discord successfully.');

        } catch (discordError) {
            console.error('Failed to send Discord notification:', discordError.message);
        }
    } else {
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({received: true});
});


// 2. Standard JSON middleware for API routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (index.html, etc.)
app.use(express.static(path.join(__dirname)));


// --- NEW API ENDPOINT: CREATE PAYMENT INTENT ---
// This endpoint is called from the client to begin the payment process.
app.post('/create-payment-intent', async (req, res) => {
    const { amount, currency } = req.body; // Expect amount in cents
    
    // Safety check and default
    if (!amount || amount < 50 || !currency) {
        return res.status(400).send({ error: 'Invalid amount or currency.' });
    }

    try {
        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount, // e.g., 400 for $4.00
            currency: currency,
            payment_method_types: ['card'],
            description: 'Custom Store Payment',
        });
        
        // Send the client secret back to the client
        res.send({
            clientSecret: paymentIntent.client_secret,
            publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_YourPublishableKey'
        });

    } catch (e) {
        console.error('Error creating payment intent:', e.message);
        res.status(500).send({ error: e.message });
    }
});


// --- NEW API ENDPOINT: PROCESS SUCCESS ---
// This endpoint simulates the confirmation process after payment
app.get('/payment-success', (req, res) => {
    // In a real app, you would verify payment_intent_client_secret here
    // For now, we'll just redirect to the success page.
    res.sendFile(path.join(__dirname, 'success.html'));
});


// --- START SERVER ---
app.listen(PORT, () => console.log(`Node server listening on port ${PORT}!`));
