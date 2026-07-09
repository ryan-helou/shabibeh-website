# AEBC Shabibeh

*The website for AEBC's shabibeh — the church youth group ("shabibeh" is Arabic for youth).*

A small hub that gathers the things a youth group actually needs between and during meetings: a way to ask questions, an archive of past sermons to listen to and read, and a live channel for questions while a talk is happening. The home page is four cards — Questions, Recordings, Sermon Slides, and Live Q&A — and each can be switched off site-wide from the admin panel when it isn't in use.

What visitors can do:

- Submit questions, anonymously or with a name. Each submission gets a private edit token, so you can come back and edit or delete your own question without an account; leaders see them in an admin list and mark them answered.
- Listen to past sermon recordings. MP3s live in a public Google Drive folder and are streamed through the server with HTTP Range support, so seeking and scrubbing work. Filenames of the form `Sermon _ Pastor _ Date` are parsed into title, speaker, and date.
- View and download sermon slides, pulled the same way from a Drive folder of PDFs.
- Ask questions during a live session. A leader opens a session, attendees submit, and if public voting is on, questions surface by upvote count so the most-asked ones rise to the top.

Behind the admin password there's more: a section-visibility toggle board, an ideas list for tracking future improvements, and a first-party analytics dashboard that records page views, clicks, and form submissions into Supabase and reports unique visitors (deduplicated by a browser id, falling back to IP), top pages, and top-clicked elements.

The stack is deliberately plain: a Node/Express server, Supabase (Postgres) for questions, live-Q&A sessions, ideas, settings, and analytics, and static HTML/CSS/vanilla-JS pages with no build step. It deploys to Vercel, with the whole app routed through `server.js`.
