# Project Tracker

A full-featured, real-time project management and task collaboration platform built with React Native, Expo, and Supabase. Manage projects with a Kanban board, collaborate with teammates, and track progress — all from a single cross-platform app.

---

## Screenshots

> _Add screenshots or a demo GIF here to showcase the UI._

---

## Features

- **Authentication** — Secure email/password sign-up and login via Supabase Auth
- **Project Dashboard** — Create, view, and delete projects; responsive grid layout
- **Kanban Board** — Four-column task board: To Do, In Progress, On Hold, Done
- **Swipe Gestures** — Swipe tasks left/right to move between columns on mobile
- **Real-time Collaboration** — Teammates see task and note updates instantly via Supabase Realtime
- **Project Members** — Invite teammates by email; owner-managed access control
- **Collaborative Notes** — Chat-style notes on each task with live updates
- **Cross-platform** — Runs on iOS, Android, and Web from a single codebase

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [React Native](https://reactnative.dev/) 0.73 + [Expo](https://expo.dev/) 50 |
| Language | TypeScript 5.3 |
| Navigation | React Navigation 6 (Stack) |
| Backend | [Supabase](https://supabase.com/) (PostgreSQL + Auth + Realtime) |
| Web Support | React Native Web + Metro Bundler |
| Hosting | [Vercel](https://vercel.com/) (web export) |
| Local Storage | AsyncStorage (auth token persistence) |

---

## Project Structure

```
project-tracker/
├── App.tsx                        # Root component, navigation setup
├── app.json                       # Expo configuration
├── vercel.json                    # Vercel deployment config
├── supabase-schema.sql            # Core database schema
├── supabase-collaboration.sql     # Collaboration/members schema
│
└── src/
    ├── screens/
    │   ├── LoginScreen.tsx        # Email/password login
    │   ├── SignUpScreen.tsx       # New account registration
    │   ├── DashboardScreen.tsx    # Projects list & creation
    │   ├── KanbanScreen.tsx       # Kanban board with real-time tasks
    │   └── TaskDetailScreen.tsx   # Task info + collaborative notes
    │
    ├── components/
    │   ├── TaskCard.tsx           # Swipeable task card
    │   ├── KanbanColumn.tsx       # Column with task list
    │   └── MembersModal.tsx       # Team member management
    │
    ├── context/
    │   └── AuthContext.tsx        # Global auth state & session
    │
    ├── lib/
    │   └── supabase.ts            # Supabase client initialization
    │
    ├── constants/
    │   └── theme.ts               # Colors, typography, spacing
    │
    └── types/
        └── navigation.ts          # Navigation type definitions
```

---

## Database Schema

The app uses five PostgreSQL tables managed by Supabase with Row Level Security (RLS) enabled on all tables.

### Tables

**`profiles`** — Auto-created on user signup via a database trigger
```sql
id          uuid (references auth.users)
full_name   text
email       text
created_at  timestamptz
```

**`projects`** — Owned by a user, shareable with members
```sql
id          uuid
name        text
description text
owner_id    uuid (references profiles)
created_at  timestamptz
```

**`tasks`** — Belong to a project, organized by Kanban column
```sql
id          uuid
title       text
description text
status      text  -- 'todo' | 'inprogress' | 'onhold' | 'done'
order       int
project_id  uuid (references projects, cascade delete)
created_by  uuid (references profiles)
created_at  timestamptz
```

**`notes`** — Collaborative comments on a task
```sql
id          uuid
task_id     uuid (references tasks, cascade delete)
author_id   uuid (references profiles)
content     text
created_at  timestamptz
```

**`project_members`** — Many-to-many project sharing
```sql
project_id  uuid (references projects, cascade delete)
user_id     uuid (references profiles)
invited_by  uuid (references profiles)
created_at  timestamptz
```

### Row Level Security

| Table | Policy |
|---|---|
| profiles | Authenticated users can read all; users update only their own |
| projects | Owner and project members can read; owner can insert/delete |
| tasks | Project members can read/write/delete |
| notes | Project members can read/write |
| project_members | Members can read; owner can insert/delete |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) — `npm install -g expo-cli`
- A [Supabase](https://supabase.com/) project

### 1. Clone the repository

```bash
git clone https://github.com/your-username/project-tracker.git
cd project-tracker
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Supabase

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Find these values in your Supabase project under **Settings > API**.

### 4. Set up the database

In your Supabase dashboard, go to **SQL Editor** and run the following files in order:

1. `supabase-schema.sql` — Creates core tables, triggers, RLS policies, and enables realtime
2. `supabase-collaboration.sql` — Adds the `project_members` table and updates RLS policies

### 5. Run the app

```bash
npm start
```

Then press the key for your target platform in the Expo terminal:

| Key | Platform |
|---|---|
| `i` | iOS Simulator |
| `a` | Android Emulator |
| `w` | Web Browser |

Or open the **Expo Go** app on your phone and scan the QR code.

---

## Environment Variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous public key |

> The `EXPO_PUBLIC_` prefix is required by Expo to bundle variables into the client app.

---

## Deployment

### Web — Vercel

The web version is exported as a static site and deployed via Vercel.

**Build manually:**
```bash
npx expo export --platform web
```
This outputs static files to the `dist/` directory.

**Auto-deploy with Vercel:**
1. Connect your GitHub repository to [Vercel](https://vercel.com/)
2. Vercel will use the configuration in `vercel.json` automatically
3. Set your environment variables in the Vercel dashboard

### Mobile — Expo EAS Build

For production iOS/Android binaries, use [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
npm install -g eas-cli
eas login
eas build --platform ios    # iOS .ipa
eas build --platform android # Android .apk / .aab
```

---

## How It Works

### Authentication Flow

1. App loads and checks for a stored Supabase session in AsyncStorage
2. If no session exists → user sees Login or Sign Up screen
3. On successful login/signup → user is taken to the Dashboard
4. A database trigger automatically creates a profile row in `profiles` on first signup
5. Sessions are auto-refreshed in the background

### Kanban Board

- Tasks are fetched for the current project and grouped by `status` column
- A Supabase Realtime subscription listens for `INSERT`, `UPDATE`, and `DELETE` events on the `tasks` table
- All connected team members see changes instantly without refreshing
- On mobile, tasks can be swiped left (advance column) or right (go back a column)
- Long-pressing a task opens a menu to move it to any column or delete it

### Collaborative Notes

- Notes are fetched when a task is opened and displayed in chronological order
- A Realtime subscription on the `notes` table pushes new notes to all viewers live
- Notes are tied to the logged-in user's profile and display the author's name and timestamp
- The view auto-scrolls to the most recent note

### Project Collaboration

- Only the project owner can invite and remove members
- Invitation is done by entering the invitee's email address
- The invitee must already have an account; their profile is looked up in the `profiles` table
- Members appear in the Members modal; the owner is always shown as "You (Owner)"
- Members can remove themselves from a project

---

## UI Theme

The app uses a dark, indigo-accented color palette:

| Token | Color | Hex |
|---|---|---|
| Background | Dark navy | `#0f0e17` |
| Surface | Dark gray | `#1a1a2e` |
| Card | Blue-tinted gray | `#1e2a45` |
| Primary | Indigo | `#6366f1` |
| Text | Light gray | `#e2e8f0` |
| To Do status | Slate | `#94a3b8` |
| In Progress status | Blue | `#60a5fa` |
| On Hold status | Amber | `#fbbf24` |
| Done status | Green | `#34d399` |

---

## Known Limitations

- **Invites require existing accounts** — Users must sign up before they can be added to a project
- **Email confirmation** — Supabase requires email verification by default; this can be disabled in Supabase Auth settings for development
- **Owner-only member management** — Only the project owner can invite or remove collaborators
- **Web gestures** — Swipe-to-move is optimized for touch; on web, use the long-press context menu instead

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
