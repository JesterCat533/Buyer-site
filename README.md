🛒 Custom Buying Website Overview

This is a personal, full-stack web application designed for the secure processing of custom orders. It features a modern, high-contrast aesthetic and robust backend integration for payments and notifications.

✨ Core Features & Design

Icon

Feature

Description

🎨

Striking UI/UX

A sharp red-and-black color palette paired with an interactive, animated parallax background ensures a memorable user experience.

💰

Dynamic Pricing

Client-side JavaScript instantly calculates and updates the total price based on the user's selected options before they proceed to checkout.

🔒

Secure Payments

Payment processing is handled entirely by Stripe Checkout, ensuring PCI compliance and supporting major credit cards and PayPal.

🚀

Real-Time Notification

Upon successful payment, the server immediately sends a confirmation and detailed order summary via a Discord Webhook.

⚙️ How It Works (The Technical Flow)

This application is built on a reliable Node.js backend to manage the flow from order placement to fulfillment notification.

Client Request: The user fills out the order form and clicks "Checkout."

Server Session Creation: The Node.js/Express server receives the order details and uses the Stripe SDK to create a secure checkout session.

Payment Processing: The user is redirected to the Stripe-hosted payment page to complete the transaction.

Confirmation Webhook: Stripe securely sends a checkout.session.completed event to the server's dedicated /webhook endpoint.

Notification & Fulfillment: The server intercepts this event, extracts the order metadata, and fires an Axios request to the Discord Webhook, providing instant confirmation of the paid order.

🛠️ Key Technologies

Category

Technology

Role

Frontend

HTML, CSS, JavaScript

Structure, Styling, and Pricing Logic.

Backend

Node.js (Express)

Routing and API Logic.

Payments

Stripe

Securely handling all transaction data.

Messaging

Discord Webhooks

Real-time order logging and alerts.

Status

The application is fully operational and configured for secure testing (Test Mode).
