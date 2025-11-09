document.addEventListener('DOMContentLoaded', () => {
    const buyButton = document.getElementById('buyButton');
    
    if (buyButton) {
        buyButton.addEventListener('click', handlePurchase);
    }

    /**
     * Handles the purchase flow: reading data from DOM, sending to server, and redirecting.
     */
    async function handlePurchase() {
        // 🟢 FIX: Read dynamic price and name from the HTML form elements here.
        // Assuming you have an input or data attribute with the dynamic values:
        
        // Placeholder for reading an element named 'product-price' and 'product-name'.
        // REPLACE '4.00' and 'Default Product' with the actual logic to read your form inputs.
        const itemPriceElement = document.getElementById('product-price');
        const itemNameElement = document.getElementById('product-name');
        
        // If these elements don't exist, this falls back to the hardcoded default.
        const dynamicPrice = itemPriceElement ? parseFloat(itemPriceElement.value) : 4.00;
        const dynamicName = itemNameElement ? itemNameElement.value : "Default Product";

        const purchaseDetails = {
            itemPrice: dynamicPrice, 
            itemName: dynamicName
        };
        
        console.log(`Sending purchase request for: ${purchaseDetails.itemName} at $${purchaseDetails.itemPrice}`);
        
        try {
            const response = await fetch('/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(purchaseDetails),
            });
            // ... (rest of the handlePurchase function remains the same)
            
            if (!response.ok) {
                // If the server returns a 4xx or 5xx error
                const errorData = await response.json();
                const errorMessage = errorData.error || `Server error: ${response.status}`;
                console.error(errorMessage);
                // Use a custom modal or message box instead of alert()
                showMessageBox("Payment Error", `The server failed to initiate payment. Details: ${errorMessage}`);
                return;
            }

            const data = await response.json();
            const sessionId = data.sessionId;

            if (sessionId) {
                console.log(`Received Stripe Session ID: ${sessionId}. Redirecting...`);
                // --- Redirect the user to Stripe Checkout ---
                window.location.href = `https://checkout.stripe.com/c/pay/${sessionId}`;
            } else {
                // Should not happen if server code is correct
                showMessageBox("Error", "Server did not return a valid payment session ID.");
            }

        } catch (error) {
            console.error('Fetch error during checkout:', error);
            showMessageBox("Connection Error", "Could not connect to the payment server. Please check your network.");
        }
    }
    
    /**
     * Custom function to display a message box instead of using alert()
     */
    function showMessageBox(title, message) {
        // A placeholder implementation. In a real app, you would create a styled modal.
        alert(`${title}:\n${message}`); 
    }
});
