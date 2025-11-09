document.addEventListener('DOMContentLoaded', () => {
    const buyButton = document.getElementById('buyButton');
    
    if (buyButton) {
        buyButton.addEventListener('click', handlePurchase);
    }

    // This data should come from your HTML/DOM, but we will hardcode for now
    const purchaseDetails = {
        itemPrice: 4.00, // $4.00 USD
        itemName: "Premium Website Access"
    };

    /**
     * Handles the purchase flow: sending data to the server and redirecting to Stripe.
     */
    async function handlePurchase() {
        console.log('Sending purchase request to server...');
        
        try {
            const response = await fetch('/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(purchaseDetails),
            });

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
