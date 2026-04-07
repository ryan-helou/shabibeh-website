# AnonAEBC

Anonymous question submission platform for AEBC church.

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (or export these variables):
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
ADMIN_PASSWORD=your-admin-password
```

3. Create the `questions` table in your Supabase dashboard (SQL Editor):
```sql
CREATE TABLE questions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_text TEXT NOT NULL,
  answered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

4. Create the `analytics_events` table for visitor/click tracking:
```sql
CREATE TABLE analytics_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_type TEXT,
  page_path TEXT,
  element TEXT,
  visitor_id TEXT,
  session_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX analytics_events_occurred_at_idx ON analytics_events (occurred_at DESC);
CREATE INDEX analytics_events_event_name_idx ON analytics_events (event_name);
CREATE INDEX analytics_events_visitor_id_idx ON analytics_events (visitor_id);
```

4. Start the server:
```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Analytics

The frontend now sends first-party analytics events automatically:
- `page_view` on every page load
- `click` for links/buttons/interactive elements
- `form_submit` for all form submissions

Events are stored in `analytics_events` via `POST /api/analytics/event`.

Admin endpoints (require `x-admin-password` header):
- `GET /api/analytics/admin/overview?days=30`
- `GET /api/analytics/admin/events?limit=100`

## Admin Access

Click the **Admin** button in the bottom-right corner. Default password: `aebc2024`.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it in [vercel.com](https://vercel.com).
3. Set environment variables in Vercel project settings:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `ADMIN_PASSWORD`
4. Deploy.

## Project Structure

```
public/
  index.html        User-facing submission page
  admin.html        Admin dashboard
  css/style.css     Styles
  js/app.js         User submission logic
  js/admin.js       Admin dashboard logic
server.js           Express server + API routes (Supabase)
```
