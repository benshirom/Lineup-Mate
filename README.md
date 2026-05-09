# Festival Scheduler Web App

This project is a **Next.js** application that implements a scheduling tool for music festivals.  It allows users to:

- Sign in using Supabase authentication
- View the full line‑up for a selected festival
- Select which acts they want to attend ("Going" / "Maybe" / "Not interested")
- Create and join groups with friends to compare schedules
- See a combined group schedule to coordinate who is attending each act
- Receive push notifications shortly before acts start (via web push / Firebase Cloud Messaging)

The app is written in **TypeScript** and uses **Tailwind CSS** for styling.  Supabase provides authentication, a PostgreSQL database and real‑time features.  The data model follows the plan described in the design document:

- `users` – basic account information
- `festivals`, `stages`, `performances`, `artists` – festival metadata
- `user_performance_preferences` – which performances each user wants to attend
- `groups` and `group_members` – simple team coordination
- `notifications` – push notification preferences

## Getting Started

1. **Install dependencies.**  You need Node.js `>=18`.  Run:

   ```bash
   cd festival-scheduler
   npm install
   ```

2. **Configure Supabase.**  Create a Supabase project at <https://supabase.com>, then copy the **Project URL** and **anon key**.  Rename `.env.local.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.  These values will be used by the frontend to talk to Supabase.

3. **Initialize the database.**  In the Supabase dashboard, run the SQL scripts under `database/init.sql` to create tables and seed the `ozora2026` line‑up (see `data/ozora2026.json` for the imported data).  You can adapt this script for other festivals.

4. **Run the development server.**  Start the Next.js dev server:

   ```bash
   npm run dev
   ```

   Then open `http://localhost:3000` in your browser.  You should see the login page.  Sign up using email/password or a third‑party provider enabled in your Supabase project.

5. **Build and deploy.**  This app can be deployed to Vercel for free.  Push the repository to GitHub, connect it to Vercel, and set the environment variables in the Vercel dashboard (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

## Project structure

```
festival-scheduler/
├── data/
│   └── ozora2026.json      # static line‑up imported from clashfinder
├── database/
│   └── init.sql            # SQL schema and seed data for Supabase
├── lib/
│   └── supabaseClient.ts   # helper to initialise Supabase in the client
├── pages/
│   ├── _app.tsx            # top‑level app component with providers
│   ├── index.tsx           # home page: select a festival
│   ├── login.tsx           # login/signup page
│   ├── festival/
│   │   └── [festivalId].tsx   # displays the festival line‑up and lets user select acts
│   └── group/
│       └── [groupId].tsx   # displays group schedule
├── components/
│   ├── LineupTable.tsx     # renders a table of performances for a day/stage
│   ├── PerformanceCard.tsx # small component for each performance with selection buttons
│   ├── GroupSchedule.tsx   # shows a merged schedule for a group
│   └── Navbar.tsx          # common navigation bar
├── public/
│   └── logo.svg            # placeholder logo
├── styles/
│   └── globals.css         # global Tailwind directives
├── tailwind.config.js      # Tailwind configuration
├── tsconfig.json           # TypeScript configuration
├── next.config.js          # Next.js configuration
├── package.json            # dependencies and scripts
└── .env.local.example      # example environment variables
```

## Notes

- The data for Ozora Festival 2026 is taken from the clashfinder link provided by the user and stored in `data/ozora2026.json`.  You can import additional festivals by adding JSON files in `data/` and updating the seeding script.
- Push notifications require configuring a web push service.  See the `lib/notifications.ts` file for an outline.  Implementation depends on your chosen provider (e.g., Firebase Cloud Messaging).
- Group schedules are calculated on the client by merging the preferences of all group members.  Real‑time updates (e.g. when someone changes their preference) are handled via Supabase's real‑time subscriptions.