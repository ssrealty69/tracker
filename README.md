## SS Realty CRM — Complete Setup Guide

### Tech Stack
- **Framework**: Next.js 16 (App Router, Server Actions, TypeScript)  
- **ORM**: Prisma 5 + PostgreSQL  
- **Auth**: NextAuth.js v4 (JWT session, Credentials provider)  
- **Styling**: Tailwind CSS v4, Custom CSS classes  
- **Icons**: Lucide React  
- **Utils**: react-hot-toast, date-fns, xlsx (CSV export), clsx, tailwind-merge  

---

### Quick Start

#### 1. Configure PostgreSQL

You can use **any** PostgreSQL service:
- [Neon](https://neon.tech) (free, serverless, recommended)
- [Supabase](https://supabase.com) (free tier)
- Local PostgreSQL installation

Edit `.env.local`:
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/ss_realty?schema=public"
NEXTAUTH_SECRET="your-random-32-char-string-here"
NEXTAUTH_URL="http://localhost:3000"
```

#### 2. Push Schema to Database
```bash
cd ss-realty
node_modules\.bin\prisma db push
```

#### 3. Seed the Database
```bash
npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" prisma/seed.ts
```
This creates:
- Admin: `ssrealtyteams@gmail.com` / `Admin@123`
- 6 agents: Nihal, Ayaan, Nikhil, Bhavishya, Gulshan, Vikas
- 10 sample leads with visits and dispositions

#### 4. Start Development Server
```bash
npm run dev
```
App runs at: **http://localhost:3000**

---

### All Routes

| URL | Description | Auth Required |
|-----|-------------|--------------|
| `/` | Agent Mobile Calling Form | ❌ Public |
| `/login` | Admin Login | ❌ Public |
| `/admin` | Executive Dashboard & KPIs | ✅ Admin |
| `/admin/visits` | Site Visit Operations Center | ✅ Admin |
| `/admin/leads` | Excel-Style Lead Grid + Export | ✅ Admin |
| `/admin/settings` | Agent Management | ✅ Admin |

### Admin Credentials
| Field | Value |
|-------|-------|
| Email | `ssrealtyteams@gmail.com` |
| Password | `Admin@123` |

---

### Key Business Logic
- ✅ **Smart deduplication**: Same phone number → update existing lead, increment touch counter
- ✅ **Full audit trail**: Every call logged to ActivityLog (never deleted)
- ✅ **Visit reschedule**: Moving visit date tags lead as RESCHEDULED, removes from old date pipeline
- ✅ **Masked phones**: Admin sees `98765XXXXX` format for security
- ✅ **Contact rate**: Calculated per agent for leaderboard
- ✅ **CSV export**: Filtered lead data exported with BOM for Excel compatibility

### npm Scripts
```bash
npm run dev          # Start dev server
npm run build        # Production build
node_modules\.bin\prisma db push     # Push schema (no migrations)
node_modules\.bin\prisma migrate dev # Use migrations instead
node_modules\.bin\prisma studio      # GUI database browser
node_modules\.bin\prisma generate    # Regenerate Prisma Client
```
