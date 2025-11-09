import express from 'express';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Standard setup for ES Modules path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.RENDER_SERVICE_URL || `http://localhost:${PORT}`; 
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET_KEY || !DISCORD_WEBHOOK_URL) {
    console.error("FATAL ERROR: Stripe Secret Key or Discord Webhook URL not set in environment.");
}

const stripe = new Stripe(STRIPE_SECRET_KEY);
const app = express();


// --- Route 1: Stripe Webhook Listener (MUST be placed FIRST) ---
// This route uses express.raw() to get the raw body needed for signature verification.
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];
    let event;
    
    if (!STRIPE_WEBHOOK_SECRET) {
        console.error("STRIPE_WEBHOOK_SECRET is not set in environment variables.");
        return res.status(500).send('Server Error: Webhook secret missing.');
    }

    try {
        // Verify the event signature against the secret
        event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        // If verification fails, send an error back to Stripe
        console.error(`Webhook signature verification failed: ${err.message}`);
        // If the secret is wrong, it still returns a 400 error here, but the 404 from earlier will be gone.
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log(`Checkout session completed for session ID: ${session.id}`);

        try {
            // Retrieve line items to get product details
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
            const item = lineItems.data.length > 0 ? lineItems.data[0] : null;

            const itemName = item?.description || item?.price?.product?.name || "Unknown Item";
            const amountPaid = (session.amount_total / 100).toFixed(2);
            const customerEmail = session.customer_details?.email || "N/A";

            // --- Send Purchase Receipt to Discord ---
            const discordPayload = {
                username: "Stripe Purchase Bot",
                embeds: [
                    {
                        title: "✅ NEW PURCHASE RECEIVED",
                        description: `A new successful payment was registered!`,
                        color: 3066993, // Green color
                        fields: [
                            { name: "Product", value: `**${itemName}**`, inline: true },
                            { name: "Amount Paid (USD)", value: `$${amountPaid}`, inline: true },
                            { name: "Customer Email", value: customerEmail, inline: false },
                            { name: "Stripe Session ID", value: `\`${session.id}\``, inline: false },
                        ],
                        timestamp: new Date().toISOString(),
                    }
                ]
            };
            
            await axios.post(DISCORD_WEBHOOK_URL, discordPayload);
            console.log('Purchase receipt sent to Discord successfully.');

        } catch (discordError) {
            console.error('Failed to send Discord notification:', discordError.message);
        }
    } 
    
    // Return a 200 to acknowledge receipt of the event
    res.json({ received: true });
}); 


// --- Middleware: Enable JSON parsing for the Checkout route (AFTER the webhook) ---
app.use(express.json());


// --- Static Files & Root Route ---
// 🟢 CRITICAL: Serve static files from the project root.
app.use(express.static(path.join(__dirname))); 

// This passes the root request to the static file handler (index.html).
app.get('/', (req, res, next) => {
    next(); 
});


// --- Route 2: Create Stripe Checkout Session (Called by client) ---
app.post('/create-checkout-session', async (req, res) => {
    try {
        // The body is parsed by app.use(express.json())
        const { itemPrice, itemName } = req.body;
        
        const finalItemPrice = itemPrice || 4.00; 
        const finalItemName = itemName || "Default Product";

        const priceInCents = Math.round(finalItemPrice * 100);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: finalItemName,
                        },
                        unit_amount: priceInCents,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${DOMAIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${DOMAIN}/cancel.html`,
        });

        res.status(200).json({ sessionId: session.id, url: session.url });

    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).send({ error: 'Failed to create checkout session. Check Stripe logs.' });
    }
}); 


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Serving static files from: ${path.join(__dirname)}`);
    console.log(`Domain used for redirects: ${DOMAIN}`);
});
