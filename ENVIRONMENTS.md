# Development and Production Environments

This project supports separate development and production environment files.

## Files

Backend:

- `splitwise-backend/.env.development`
- `splitwise-backend/.env.production`

Frontend:

- `splitwise-frontend/.env.development`
- `splitwise-frontend/.env.production`

Real `.env*` files are gitignored. Use the `.example` files as templates.

## Setup

1. Create a separate development database.

   In MongoDB Atlas you can use the same cluster, but use different database names:

   - Production: `splitwise_prod`
   - Development: `splitwise_dev`

2. Create local env files from examples.

   ```bash
   cp splitwise-backend/.env.development.example splitwise-backend/.env.development
   cp splitwise-backend/.env.production.example splitwise-backend/.env.production
   cp splitwise-frontend/.env.development.example splitwise-frontend/.env.development
   cp splitwise-frontend/.env.production.example splitwise-frontend/.env.production
   ```

3. Put the development Mongo URI only in `splitwise-backend/.env.development`.

   Example:

   ```env
   MONGO_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/splitwise_dev
   ```

4. Put the production Mongo URI only in `splitwise-backend/.env.production`.

   Example:

   ```env
   MONGO_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/splitwise_prod
   ```

## Commands

Run backend in development:

```bash
cd splitwise-backend
npm run dev
```

Run backend in production mode:

```bash
cd splitwise-backend
npm run start:prod
```

Run frontend in development:

```bash
cd splitwise-frontend
npm run dev
```

Build frontend for production:

```bash
cd splitwise-frontend
npm run build
```

## Deployment

On Render/Vercel/etc, set environment variables in the platform dashboard instead of uploading `.env.production`.

Backend production variables should include:

- `NODE_ENV=production`
- `MONGO_URI` pointing to `splitwise_prod`
- `JWT_SECRET`
- `FRONTEND_URL`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `CRON_SECRET`
- Pusher variables if chat is enabled

Frontend production variables should include:

- `VITE_BACKEND_URL=https://your-production-backend/api`
- `VITE_PUSHER_KEY`
- `VITE_PUSHER_CLUSTER`

## Safety Rule

Never use the production Mongo URI in `.env.development`. Local feature work should always run against `splitwise_dev`.
