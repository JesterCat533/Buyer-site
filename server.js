import express from 'express';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables for local development (Render handles these automatically)
dotenv.config();

// Standard setup for ES Modules path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const PORT = process.env.PORT || 3000;
// CRITICAL: RENDER_SERVICE_URL must be set in Render ENV vars (e.g., https://my-custom-store.onrender.com)
const DOMAIN = process.env.RENDER_SERVICE_URL || `http://localhost:${PORT}`; 
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET_KEY || !DISCORD_WEBHOOK_URL) {
    console.error("FATAL ERROR: Stripe Secret Key or Discord Webhook URL not set in environment.");
}

const stripe = new Stripe(STRIPE_SECRET_KEY);
const app = express();

// Middleware to serve static files (index.html, script.js, etc.)
// Since server.js is in /server, we point to the parent directory to find the static files.
app.use(express.static(path.join(__dirname, '..'))); 
// We are now serving files from the project root, which contains index.html, script.js, etc.

// --- Route 1: Create Stripe Checkout Session ---
// This route is called by the client-side script.js
app.post('/create-checkout-session', express.json(), async (req, res) => {
    try {
        const { itemPrice, itemName } = req.body;
        
        // Use default values if body is empty (for robustness)
        const finalItemPrice = itemPrice || 4.00; 
        const finalItemName = itemName || "Default Product";

        const priceInCents = Math.round(finalItemPrice * 100);

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'], // PayPal is disabled, keeping this safe
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
            // Use the DOMAIN for the correct redirect URLs
            success_url: `${DOMAIN}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${DOMAIN}/cancel.html`,
        });

        // Send the session URL back to the client to redirect
        // We send the full URL here, which is safer than just the ID if using the public key.
        // However, since the client expects a session ID (based on the previous script.js), 
        // we'll stick to the ID and assume the client handles the redirect URL construction.
        res.status(200).json({ sessionId: session.id, url: session.url });

    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).send({ error: 'Failed to create checkout session. Check Stripe logs.' });
    }
}); 


// --- Route 2: Stripe Webhook Listener ---
// This route receives confirmed payment events from Stripe
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
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log(`Checkout session completed for session ID: ${session.id}`);

        try {
            // Retrieve line items to get product details
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
            const item = lineItems.data[0];

            const itemName = item.description || item.price.product.name || "Unknown Item";
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


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Serving static files from: ${path.join(__dirname, '..')}`);
    console.log(`Domain used for redirects: ${DOMAIN}`);
});
```eof

---

## Next Steps for a Successful Deploy 🚀

You need to fix two remaining issues based on your deploy logs:

### 1. Update `package.json` Dependencies

Your deploy failed because it couldn't find required modules (`dotenv`, etc.). You must ensure your `package.json` contains all the dependencies used in `server.js`:

```json
{
  "name": "buy-website-server",
  "version": "1.0.0",
  "description": "Stripe and Discord integration server",
  "main": "server.js",
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "axios": "^1.6.2",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "stripe": "^14.12.0"
  },
  "author": "",
  "license": "ISC"
}
