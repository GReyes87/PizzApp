# PizzApp

A dorm-kitchen pizza ordering app. Customers browse presets, customize pizzas, place pickup or South Bend delivery orders, track live kitchen progress, and rate completed orders. Kitchen staff use a separate `/kitchen` dashboard to advance orders through each stage.

## Run locally
1. Install Node.js 16 or newer.
2. In this folder run `npm start` (or `node server.js`).
3. Open `http://localhost:3000` for the customer site.
4. Open `http://localhost:3000/kitchen` for the kitchen board.

## Customer workflow
1. Pick Cheese, Pepperoni, Hawaiian, or Build Your Own.
2. Customize size, crust, toppings, quantity, and special requests.
3. Add pizzas to the cart and finish checkout.
4. After checkout, keep the order number (for example `P001`) and the phone number used on the order.
5. The customer can return to the **Track an order** section from any device, enter those two values, and see live status updates every four seconds.
6. Kitchen staff move the order through Received → Preparing → In the oven → Ready → Done.
7. After completion, the customer can leave a star rating and comment.

## Demo payment
Payment is intentionally simulated for this class project. No real card information is collected or charged.

## Deployment notes
The app uses `PORT` automatically when supplied by a hosting provider.

Orders are stored in `data.json` by default. For a host with a persistent disk, set `DATA_DIR` to the mounted persistent directory so order tracking survives restarts. Example: `DATA_DIR=/var/data`.

For a public deployment, protect the kitchen dashboard by setting `KITCHEN_KEY` to a private access code. When enabled, `/kitchen` prompts staff for that code and stores it only for the current browser session.

Optional environment variables:
- `PORT=4000` — custom local port.
- `STRICT_HOURS=1` — enforce 6pm–12am and configured game-Saturday closures.
- `DATA_DIR=/path/to/persistent/storage` — persistent order file location.
- `KITCHEN_KEY=your-private-code` — protects kitchen order data and status changes.

## Files
- `server.js` — REST API, validation, pricing, order persistence, tracking verification, kitchen protection, static hosting
- `public/index.html` — customer menu, ordering, checkout, live tracking, reviews
- `public/kitchen.html` — kitchen dashboard
- `public/style.css` — shared responsive styles
