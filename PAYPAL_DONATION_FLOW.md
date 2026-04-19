# PayPal + Steam Protected Donation Flow

1. User signs in with Steam.
2. Client requests `/api/donations/paypal/config`.
3. PayPal button requests `/api/donations/paypal/create-order`.
4. Server creates the order with the authenticated Steam ID bound into internal metadata.
5. After approval, the client calls `/api/donations/paypal/capture-order`.
6. Server captures the order and stores a signed support receipt.
7. `/api/universe/session` and `/api/support/session` expose the linked donation summary to the game shell.
8. `/api/donations/paypal/webhook` is available for PayPal webhook validation.
