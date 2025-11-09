document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('order-form');
    const finalPriceDisplay = document.getElementById('final-price');
    const typeOptions = document.getElementById('type-options');
    const videoOptionsDiv = document.getElementById('video-options');
    const imageOptionsDiv = document.getElementById('image-options');
    const allOptions = form.querySelectorAll('.option-card input[type="radio"], .option-card input[type="checkbox"]');

    // --- Pricing Logic ---

    const BASE_PRICES = {
        'Video': 5,
        'Image': 1,
    };

    const PRICE_MAP = {
        // Video Durations
        '1 min': 5,
        'Custom': 10,
        // Image Sizes
        'Small': 1,
        'Medium': 3,
        'Large': 5,
        'XL': 7,
        'Super-Size': 8,
        // Features
        'Clothed': -1, // Deduction
        'Other': 0
    };

    function calculateTotal() {
        let total = 0;
        const selectedType = form.querySelector('input[name="itemType"]:checked').value;
        const durationInput = form.querySelector('input[name="duration"]:checked');
        const sizeInput = form.querySelector('input[name="imageSize"]:checked');
        const features = form.querySelectorAll('input[name="feature"]:checked');

        // 1. Determine Base Price (Type & Main Option)
        if (selectedType === 'Video' && durationInput) {
            total = PRICE_MAP[durationInput.value];
        } else if (selectedType === 'Image' && sizeInput) {
            total = PRICE_MAP[sizeInput.value];
        } else {
            // Fallback for initial load
            total = BASE_PRICES[selectedType];
        }

        // 2. Add/Subtract Feature Costs
        features.forEach(feature => {
            const featureValue = feature.value;
            total += PRICE_MAP[featureValue];
        });

        // Update the display
        finalPriceDisplay.textContent = `$${total.toFixed(2)}`;
    }

    // Function to toggle duration/size options based on Type
    function toggleOptions() {
        const selectedType = form.querySelector('input[name="itemType"]:checked').value;
        
        if (selectedType === 'Video') {
            videoOptionsDiv.classList.remove('hidden');
            imageOptionsDiv.classList.add('hidden');
            // Ensure a video option is checked
            if (!form.querySelector('input[name="duration"]:checked')) {
                form.querySelector('input[name="duration"][value="1 min"]').checked = true;
            }
        } else if (selectedType === 'Image') {
            videoOptionsDiv.classList.add('hidden');
            imageOptionsDiv.classList.remove('hidden');
            // Ensure an image option is checked
            if (!form.querySelector('input[name="imageSize"]:checked')) {
                form.querySelector('input[name="imageSize"][value="Small"]').checked = true;
            }
        }
        calculateTotal();
    }

    // Attach listeners for dynamic pricing
    typeOptions.addEventListener('change', toggleOptions);
    allOptions.forEach(input => {
        input.addEventListener('change', calculateTotal);
    });
    
    // Initial call
    toggleOptions();

    // --- Parallax Dotted Background Logic (Simplified Canvas) ---
    const DOT_COUNT = 50;
    const DISTANCE_THRESHOLD = 150; // Distance for dots to light up
    const parallaxContainer = document.getElementById('parallax-container');
    const dots = [];

    // Generate dots
    for (let i = 0; i < DOT_COUNT; i++) {
        const dot = document.createElement('div');
        dot.classList.add('dot');
        dot.style.left = `${Math.random() * 100}vw`;
        dot.style.top = `${Math.random() * 100}vh`;
        // Parallax effect: assign a random speed factor (from 0.5 to 1.5)
        dot.dataset.speed = (Math.random() * 1 + 0.5).toFixed(2);
        parallaxContainer.appendChild(dot);
        dots.push(dot);
    }

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        dots.forEach(dot => {
            const rect = dot.getBoundingClientRect();
            const dotX = rect.left + rect.width / 2;
            const dotY = rect.top + rect.height / 2;

            // Calculate distance to the mouse
            const distance = Math.hypot(dotX - mouseX, dotY - mouseY);

            // Light-up effect
            if (distance < DISTANCE_THRESHOLD) {
                dot.classList.add('lit');
            } else {
                dot.classList.remove('lit');
            }
            
            // Subtle Parallax movement (simulating slow background shift)
            const speed = parseFloat(dot.dataset.speed);
            const xShift = (mouseX - window.innerWidth / 2) / 50 * speed;
            const yShift = (mouseY - window.innerHeight / 2) / 50 * speed;
            dot.style.transform = `translate(${xShift}px, ${yShift}px) scale(${dot.classList.contains('lit') ? 2 : 1})`;
        });
    });

    // --- Form Submission (Handles payment redirect and data collection) ---

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => data[key] = value);
        data.finalPrice = finalPriceDisplay.textContent.replace('$', ''); // Get price as a clean number string

        // **CRITICAL SECURITY NOTE:**
        // The actual payment processing (Stripe/PayPal) and webhook call 
        // MUST happen on the Node.js server to secure your API keys 
        // and the Discord webhook URL.

        document.getElementById('button-text').textContent = 'Processing...';
        document.getElementById('checkout-button').disabled = true;

        try {
            // 1. Send order details to Node.js server to create a payment session
            const response = await fetch('/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const session = await response.json();
            
            if (session.error) {
                alert(`Error: ${session.error}`);
                throw new Error(session.error);
            }

            // 2. Redirect to Stripe/PayPal Hosted Checkout Page
            // A payment library like Stripe or PayPal will provide a redirect URL here.
            // For Stripe, this would be: window.location.href = session.url; 
            
            // --- Placeholder for a successful server response ---
            alert(`Order Sent to Server! Redirecting to a mock payment page for $${data.finalPrice}... (Check console for mock data)`);
            console.log("Order Data Sent to Server:", data);
            
            // In a real application, you would redirect here:
            // window.location.href = session.url;

        } catch (error) {
            console.error('Checkout error:', error);
            document.getElementById('button-text').textContent = 'Try Again';
        } finally {
            document.getElementById('checkout-button').disabled = false;
        }
    });
});