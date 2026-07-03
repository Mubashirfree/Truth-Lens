# TruthLens

TruthLens is a fact-checking tool that uses AI to verify claims in photos and videos. Upload an image or clip, and it analyzes the content, cross-checks it against available context, and gives you back a verification report — instead of you having to dig through search results yourself trying to figure out if something's real, doctored, or taken out of context.

Built this because misinformation spreads fastest through images and short videos, and there wasn't a simple way to just drop in a piece of media and get a straight answer on whether it holds up.

## How it works

1. You upload an image or video (handled via UploadThing).
2. The Gemini API reads the media and evaluates the claim(s) attached to it.
3. TruthLens generates a verification report — what's accurate, what's misleading, and why.
4. Reports are saved to Postgres, so you can look back at your verification history.

## Tech stack

- **[Next.js](https://nextjs.org)** (App Router) — frontend + API routes
- **[Gemini API](https://ai.google.dev)** — the actual verification engine
- **PostgreSQL** — stores reports and verification history
- **[Prisma](https://www.prisma.io)** — ORM / database layer
- **[UploadThing](https://uploadthing.com)** — file uploads (images/video)
- **[shadcn/ui](https://ui.shadcn.com)** + Tailwind CSS — UI components and styling
- **TypeScript** throughout

## Getting started

### Prerequisites

- Node.js 18+
- A PostgreSQL database (local or hosted)
- A Gemini API key
- An UploadThing account/token

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/truthlens.git
cd truthlens
npm install
```

### 2. Set up environment variables

Create a `.env` file in the project root:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/truthlens"
GEMINI_API_KEY="your-gemini-api-key"
UPLOADTHING_TOKEN="your-uploadthing-token"
```

### 3. Set up the database

```bash
npx prisma db push
npx prisma generate
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see it running.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app locally in dev mode |
| `npm run build` | Pushes DB schema, generates Prisma client, builds for production |
| `npm run start` | Runs the production build |
| `npm run lint` | Lints the codebase |

## Project structure

```
src/
  app/            # Next.js App Router pages & API routes
  components/     # UI components (shadcn/ui based)
  lib/            # Utilities, Prisma client, helpers
  hooks/          # React hooks
prisma/
  schema.prisma   # Database schema
```

## Roadmap / ideas

- Browser extension for one-click verification of media on any page
- Batch verification for multiple files at once
- Public API for developers to integrate TruthLens checks

## Contributing

Issues and PRs are welcome. If you're planning a bigger change, open an issue first so we can talk through the approach.

## License

MIT
