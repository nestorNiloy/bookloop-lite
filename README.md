# BookLoop Lite

A lightweight, single-evening version of BookLoop — a book exchange platform where members borrow, rent, buy, or trade books with each other.

This is the **simplified companion** to the full BookLoop project (Java/Spring Boot/PostgreSQL/Docker). It exists to show the same core product idea with a much smaller stack, a faster setup, and a distinct, gradient-forward visual identity.

## What's the same as the full version

- Book / Listing separation (a book can have multiple listing types)
- Four transaction types: Borrow, Rent, Buy, Exchange
- Type-specific validation (Rent needs a price + duration, Borrow/Exchange must have none)
- A simple request lifecycle: `REQUESTED → ACCEPTED → COMPLETED` (or `DECLINED`)
- Contact information is only revealed once a request is **accepted** — mirroring the `TRANSACTION_PARTNERS` visibility rule from the full build
- JWT auth in an HTTP-only cookie

## What's deliberately left out

No Docker, no PostgreSQL, no Testcontainers, no QR return tokens, no simulated payments, no background jobs. Those live in the full BookLoop project. This version is meant to be cloned and running in under two minutes.

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js, Express, lowdb (JSON file — zero native dependencies, works anywhere) |
| Frontend | React, Vite, plain CSS (no framework) |
| Auth | JWT in an HTTP-only cookie, bcrypt password hashing |

## Running it

**Backend:**
```bash
cd backend
npm install
npm start
```
Runs on `http://localhost:4000`. Data is stored in `backend/data.json` and seeded automatically on first run.

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173` with a proxy to the backend.

## Demo accounts

| Email | Password |
|---|---|
| alice@bookloop.dev | password123 |
| ben@bookloop.dev | password123 |
| clara@bookloop.dev | password123 |

## Design

The visual identity is a "golden hour reading" gradient — deep indigo fading through violet into coral and amber — paired with Fraunces (a characterful serif for display text) and Plus Jakarta Sans for body copy. Each listing type (Borrow, Rent, Buy, Exchange) gets its own accent color, carried consistently from the catalogue cards through to the listing detail page.

## Project structure

```
bookloop-lite/
├── backend/
│   └── src/
│       ├── server.js   — all routes (auth, books, listings, requests)
│       └── db.js       — lowdb setup + demo data seed
└── frontend/
    └── src/
        ├── pages/       — Login, Register, Catalogue, ListingDetail, Shelf, Requests
        ├── components/  — Navbar, BookCard, AuthLayout
        ├── AuthContext.jsx
        ├── api.js
        └── index.css    — full design system (gradients, glass cards, tokens)
```
