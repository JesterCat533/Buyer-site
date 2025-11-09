// server.js

// 1. Imports and Setup
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
// NOTE: Use 'stripe' for card payments, or 'paypal-rest-sdk' for PayPal
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); 

const app = express();
const PORT = process.env.PORT || 3000;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// --- CRITICAL: Use express.raw for Stripe webhook events ---
// This is needed to verify the webhook signature later
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf } }));
app.use(express.json()); // For regular POST data
app.use(express.static(path.join(__dirname, '/'))); // Serve static files (index.html, style.css, script.js)

// --- Helper: Discord Webhook Sender ---
function sendDiscordMessage(data) {
    const { discordUsername, finalPrice, itemType, duration, imageSize, feature, context } = data;
    
    // Determine the main option text based on type
    const mainOption = itemType === 'Video' ? duration : imageSize;
    
    const payload = {
        content: `🚨 **NEW ORDER RECEIVED!** 🚨`,
        embeds: [
            {
                title: "💰 Custom Purchase Details",
                color: 16711680, // Red color (decimal)
                fields: [
                    { name: "Discord User", value: `**${discordUsername}**`, inline: true },
                    { name: "Item Type", value: itemType, inline: true },
                    { name: "Option/Size", value: mainOption, inline: true },
                    { name: "Features", value: feature || "None", inline: true },
                    { name: "TOTAL PAID", value: `$${finalPrice}`, inline: true },
                    { name: "Payment Method", value: data.paymentMethod || "Stripe/Card", inline: true },
                    { name: "Additional Context", value: context || "*(None provided)*", inline: false }
                ],
                timestamp: new Date().toISOString(),
            }
        ]
    };

    return axios.post(DISCORD_WEBHOOK_URL, payload);
}

// 2. Client Checkout Session Endpoint (Front-end calls this)
app.post('/create-checkout-session', async (req, res) => {
    const { discordUsername, finalPrice, itemType, duration, imageSize, feature, context } = req.body;
    
    // Convert price to cents (Stripe requirement)
    const amountCents = Math.round(parseFloat(finalPrice) * 100);

    if (amountCents <= 0) {
        return res.status(400).json({ error: "Price must be greater than $0." });
    }

    try {
        // Create a checkout session (for Stripe in this example)
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'paypal'], // PayPal is supported by Stripe
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `${itemType} Commission`,
                        description: `Type: ${itemType}, Option: ${itemType === 'Video' ? duration : imageSize}, Features: ${feature || 'None'}`,
                    },
                    unit_amount: amountCents,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: 'http://localhost:3000/success.html?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'http://localhost:3000/cancel.html',
            // Store all custom data as metadata to retrieve it in the webhook
            metadata: {
                discordUsername,
                itemType,
                duration: duration || 'N/A',
                imageSize: imageSize || 'N/A',
                features: feature || 'None',
                context: context.substring(0, 500) // Truncate context for metadata limit
            },
        });

        res.json({ url: session.url }); // Send the hosted checkout URL back to the client

    } catch (error) {
        console.error('Stripe Session Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 3. Webhook Listener (Stripe/PayPal calls this to confirm payment)
app.post('/webhook', async (req, res) => {
    // SECURITY: Verify the event is from Stripe/PayPal first!
    // (This is a simplified check for illustration; a real implementation requires signature verification)
    
    const event = req.body;

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        // Retrieve the full session (if needed) and metadata
        const fullSession = await stripe.checkout.sessions.retrieve(session.id);
        const metadata = fullSession.metadata;
        const totalPaid = (fullSession.amount_total / 100).toFixed(2); // Convert cents back to dollars

        const orderData = {
            discordUsername: metadata.discordUsername,
            finalPrice: totalPaid,
            itemType: metadata.itemType,
            duration: metadata.duration,
            imageSize: metadata.imageSize,
            feature: metadata.features,
            context: metadata.context,
            paymentMethod: fullSession.payment_method_types[0]
        };

        try {
            // Send the confirmed order details to Discord
            await sendDiscordMessage(orderData);
            console.log('✅ Discord Webhook Sent Successfully!');
        } catch (discordError) {
            console.error('❌ Error sending Discord webhook:', discordError.message);
            // Log the error but still return 200/OK to the payment provider
        }
    }

    // Return a 200 response to acknowledge receipt of the event
    res.status(200).send({ received: true });
});

// 4. Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Ensure you set up your payment provider webhooks to point to http://[your-domain]/webhook');
});
