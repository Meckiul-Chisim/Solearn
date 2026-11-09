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

## Endpoints

- `POST /auth/register` – create an account
- `POST /auth/login`
- `GET /me`
- `GET /questions`
- `POST /questions/:id/answer`
- `POST /rewards/daily`
- `POST /rewards/ad`
- `POST /withdrawals`
