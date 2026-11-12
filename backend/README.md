# SoLearn API

Development API for quiz and reward features.

## Run

```powershell
cd backend
npm install
copy .env.example .env
npm start
```

The API listens on port 3000 by default and stores data in `data/solearn.sqlite`.
Set both `JWT_SECRET` and `ADMIN_API_KEY` to private, random values before
exposing the API. In production the server refuses to start without them.

## Endpoints

- `POST /auth/register` – create an account
- `POST /auth/login`
- `GET /me`
- `GET /questions`
- `POST /questions/:id/answer`
- `POST /rewards/daily` – one server-awarded check-in per UTC day
- `POST /rewards/spin` – one server-selected spin per UTC day
- `GET /activity` – point ledger and redemption status
- `POST /withdrawals` – submit a UPI or gift-card request (minimum 1,000 points)
- `GET /admin/withdrawals` – list requests (requires `x-admin-key`)
- `POST /admin/withdrawals/:id/review` – complete or reject a request (requires `x-admin-key`)

## Points and redemption

Successful quiz answers, daily check-ins, referrals, and daily spins are
awarded by the API and recorded in SQLite. The API prevents repeat quiz
rewards and repeat daily claims. Client-supplied ad rewards are not supported.
Point changes are recorded in `points_ledger`; existing rewards and withdrawal
rows are migrated into the ledger when the API starts.

UPI and gift-card requests are manual-review requests, not instant payments.
The requested points are reserved from the user's balance when the request is
created. An operator must fulfil the request outside the app before marking it
`complete`. Rejecting a request refunds its points exactly once. The admin
routes use `x-admin-key`; keep this key on the server and never put it in the
mobile app.

No points-to-currency conversion, gift-card brand, or denomination is
configured. A gift-card request stores the recipient email and requested points;
the actual card/value must be agreed and fulfilled manually. UPI requests store
the user's UPI ID and requested points. Do not promise or make a transfer until
your organization has selected a provider, set redemption terms, and completed
the review. Request details are stored in the local SQLite database; use only
test details on development systems and secure the database and backups.

To mark a reviewed request complete after fulfilling it:

```powershell
$headers = @{ "x-admin-key" = $env:ADMIN_API_KEY }
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/admin/withdrawals/1/review" `
  -Headers $headers -ContentType "application/json" `
  -Body '{"action":"complete","note":"Fulfilled outside the app"}'
```

Use `"action":"reject"` instead to refund points. Configure `ADMIN_API_KEY` in
the operator's environment before running this example.

Backend tests use an isolated temporary database:

```powershell
npm test
```
