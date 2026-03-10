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

4. Start the server:
```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

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
