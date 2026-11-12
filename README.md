# SoloEarn

SoloEarn is an ad-free learning and rewards app built with Expo Router. Accounts, points, quizzes, daily rewards, spins, and redemption requests use the companion API; balances are not stored as demo values in the app.

## Run the app and API

From the workspace root, start the API:

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm start
```

In another terminal, start the Expo app:

```powershell
cd Solearn
npm install
npm run start
```

The API requires Node.js 22.9 or newer. Android emulators use `http://10.0.2.2:3000` by default; iOS simulators and web use `http://localhost:3000`. To use a physical device, set `EXPO_PUBLIC_API_URL` in the app's local `.env` to the computer's LAN address, for example `http://192.168.1.20:3000`.

For web development, set `CORS_ORIGIN` in `backend/.env` to the Expo web origin (usually `http://localhost:8081`). Keep `JWT_SECRET` private and replace the example value before exposing the API beyond local development.

## Rewards and fulfilment

Quiz answers, daily check-ins, spins, redemptions, and payout requests are validated and recorded by the API in SQLite. Daily check-ins and spins are limited to one per account per day. There are no ads or ad-reward endpoints in this version.

UPI and gift-card requests reserve points and are stored as pending requests in SQLite. An operator must fulfil them outside the app and then mark them complete through the admin API; rejected requests refund the points. No money or gift cards are transferred automatically. No point-to-rupee conversion, gift-card brand, or denomination is configured. The development API stores payout details in its local SQLite database, so do not use real personal or payment details with an exposed development server. See [backend/README.md](./backend/README.md) for admin setup and request review.

Run API integration tests with:

```powershell
cd backend
npm test
```
