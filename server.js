import 'dotenv/config'; 
import express from 'express';
import Stripe from 'stripe';
import axios from 'axios';
// Note: This file uses ES Module syntax (import/export). Ensure your package.json has "type": "module".

// --- Configuration & Environment Variables ---

// Read all secrets and the deployment URL from Render's environment variables.
const PORT = process.env.PORT || 4242;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET; 
const RENDER_SERVICE_URL = process.env.RENDER_SERVICE_URL; 

// Critical check before starting the server
if (!STRIPE_SECRET_KEY || !DISCORD_WEBHOOK_URL || !STRIPE_WEBHOOK_SECRET || !RENDER_SERVICE_URL) {
    console.error("FATAL ERROR: One or more required environment variables are missing.");
    console.error("Please ensure STRIPE_SECRET_KEY, DISCORD_WEBHOOK_URL, STRIPE_WEBHOOK_SECRET, and RENDER_SERVICE_URL are set on Render.");
    // In a production environment, you should stop execution if critical secrets are missing.
}

// Initialize Stripe client
const stripe = new Stripe(STRIPE_SECRET_KEY);
const app = express();

// Serve static assets (index.html, success.html, cancel.html) from the 'public' folder
app.use(express.static('public')); 

// Middleware to parse JSON bodies for our API endpoint (/create-checkout-session)
app.use(express.json()); 

// --- Discord Notification Function ---
async function sendDiscordNotification(embeds) {
    if (!DISCORD_WEBHOOK_URL) return; 
    try {
        await axios.post(DISCORD_WEBHOOK_URL, { embeds });
        console.log('Successfully sent payment notification to Discord.');
    } catch (error) {
        console.error('Failed to send Discord notification:', error.message);
    }
}

// --- API Endpoint: Create Stripe Checkout Session ---
// This endpoint is called by your frontend when the user clicks 'Pay'.
app.post('/create-checkout-session', async (req, res) => {
    try {
        // RENDER_SERVICE_URL is used to correctly redirect the user back to your deployed pages
        const domain = RENDER_SERVICE_URL; 
        
        // This is where you define the product and price
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Premium Service Access', 
                        },
                        unit_amount: 5000, // $50.00 in cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            // Redirect URLs use the dynamic domain from the Render environment variable
            success_url: `${domain}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${domain}/cancel.html`,
            // Custom metadata to help you identify the order later in the webhook
            metadata: {
                user_id: 'user_12345',
                product_sku: 'PREMIUM_TRIAL_2025'
            }
        });

        // Send the session URL back to the frontend for client-side redirection
        res.status(200).json({ id: session.id, url: session.url });

    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message });
    }
});


// --- Webhook Listener: Receives Confirmation from Stripe ---

// This route must use express.raw to get the raw body needed for signature verification
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];
    let event;
    
    // 1. Verify the event signature
    try {
        event = stripe.webhooks.constructEvent(
            req.body, 
            signature, 
            STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.log(`⚠️ Webhook signature verification failed: ${err.message}`);
        return res.sendStatus(400);
    }

    const dataObject = event.data.object;

    // 2. Handle the successful payment event
    if (event.type === 'checkout.session.completed') {
        console.log('✅ Payment success: checkout.session.completed received.');
        
        // This is the secure place to fulfill the order (e.g., enable service access)
        
        const customerEmail = dataObject.customer_details ? dataObject.customer_details.email : 'N/A';
        const totalAmount = (dataObject.amount_total / 100).toFixed(2);
        const currency = dataObject.currency.toUpperCase();
        
        const discordEmbed = [{
            title: '💰 New Payment Received!',
            description: `Checkout Session ID: ${dataObject.id}`,
            color: 5763719, // Green color code for Discord embeds
            fields: [
                { name: 'Customer Email', value: customerEmail, inline: true },
                { name: 'Amount Paid', value: `${totalAmount} ${currency}`, inline: true },
                { name: 'Product SKU (Metadata)', value: dataObject.metadata.product_sku || 'N/A', inline: false },
            ],
            timestamp: new Date().toISOString(),
        }];

        await sendDiscordNotification(discordEmbed);
    } else {
        // Log other events but respond with 200 to acknowledge receipt
        console.log(`Unhandled event type ${event.type}. Ignoring.`);
    }

    // Acknowledge receipt of the event
    res.sendStatus(200);
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
    console.log(`Service URL (Render): ${RENDER_SERVICE_URL}`);
});
```eof

The video below shows how to set up Stripe Checkout for subscriptions, which includes the necessary server-side Node.js logic for creating sessions and integrating webhooks.
[Stripe Checkout Subscriptions + Webhooks with Node.js](https://www.youtube.com/watch?v=iUJ82_mVEVI)
http://googleusercontent.com/youtube_content/5
