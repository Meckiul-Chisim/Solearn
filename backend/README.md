# SoloEarn API

Local development API for SoloEarn accounts, quizzes, points, redemptions, and payout requests.

## Requirements and startup

Use Node.js 22.9 or newer. From this directory:

```powershell
Copy-Item .env.example .env
npm install
npm start
```

Set a private random `JWT_SECRET` in `.env`. The API listens on port 3000 by default and stores SQLite data in `data/solearn.sqlite`. `CORS_ORIGIN` is optional for native clients and should be set to the exact Expo web origin when using the web app. `SOLEARN_DATABASE_PATH` can override the database file path for tests or isolated local runs.

## Endpoints

- `GET /health`
- `POST /auth/register` and `POST /auth/login`
- `GET /me`
- `GET /questions` and `POST /questions/:id/answer`
- `POST /rewards/daily` and `POST /rewards/spin`
- `GET /products` and `POST /redemptions`
- `GET /activity`
- `POST /withdrawals`

All endpoints other than `/health` and the two authentication endpoints require `Authorization: Bearer <token>`. Points and reward outcomes are determined and recorded by the API. Quiz rewards, daily rewards, and spins cannot be claimed more than once per account per item or day.

There is deliberately no ad or ad-reward endpoint in this version. Redemption and payout requests are saved as pending; no external fulfilment or payout provider is connected. This development service stores submitted addresses and payment details in SQLite and is not suitable for real personal or payment data on a public server.

## Tests

```powershell
npm test
```

The integration test starts an isolated server with a temporary SQLite database and exercises account, earning, redemption, and payout flows.
