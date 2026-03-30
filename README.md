# Virtual Mental Health Assistant for Campus Students

A web-based virtual assistant that provides academic stress support to university students through conversational AI, crisis guidance, and self-help resources.

## System Overview

### High-Level Architecture

- **Frontend:** React + Vite
- **Backend:** Flask REST API
- **Database:** PostgreSQL via Flask-SQLAlchemy
- **Authentication:** JWT (Flask-JWT-Extended)
- **AI Response Provider:** OpenRouter chat completion API
- **Optional Retrieval:** Pinecone index (for context lookup)

### How the System Works

1. User opens landing page and chooses anonymous chat or login/signup.
2. Frontend sends requests to Flask API.
3. For `/chat`, backend:
	 - sanitizes history
	 - checks crisis indicators
	 - performs stress assessment
	 - optionally retrieves context from Pinecone
	 - gets final response from OpenRouter model
4. For authenticated users, messages are stored in PostgreSQL and shown in dashboard/history.
5. Dashboard aggregates conversation stats, themes, stress distribution, and mood status.
6. Resources page provides practical coping tools and emergency contacts.

---

## User Manual (For New Users)


### 1. Landing Page

![Landing Page](./frontend/screenshots/landingPage.png)

- Click **Start Anonymous Chat** to chat without an account.
- Click **Login** if you already have an account.


### 2. Anonymous Chat Mode

![Anonymous Chat](./frontend/screenshots/AnonymousChat.png)

- You can chat immediately.
- Anonymous sessions are not saved to personal dashboard history.


### 3. Registered User Mode

#### Signup Page
![Signup Page](./frontend/screenshots/signUp.png)

#### Login Page
![Login Page](./frontend/screenshots/loginPage.png)

- Create account on **Sign Up**.
- Login to access:
  - saved conversations
  - dashboard analytics
  - mood tracking
  - quick access to resources


### 4. Chat Interface

![Chat Interface](./frontend/screenshots/chatInterface.png)

- Start a new chat.
- Send messages about exams, deadlines, pressure, burnout, anxiety, etc.
- If severe distress language is detected, the system shows urgent support contacts (see below).
- You can delete a conversation and undo deletion within a short window.

#### Crisis Alert Example
![Crisis Alert](./frontend/screenshots/crisisAlert.png)


### 5. Dashboard

![Dashboard](./frontend/screenshots/dashboard.png)

- View total conversations and recent activity.
- View stress/theme insights from recent messages.
- Save daily mood (Great, Okay, Stressed, Low, Overwhelmed).

#### Mood Check-in Modal
![Mood Check-in](./frontend/screenshots/moodCheckIn.png)

#### Stress Signals Example
![Stress Signals](./frontend/screenshots/stress-signals.png)


### 6. Resources Page

![Resources Page](./frontend/screenshots/ResourcePage.png)

- Use quick coping tools such as box breathing and grounding.
- View emergency support contacts.
- Access external educational resources.

---


## Additional Screenshots

### Responsiveness Example
![Responsiveness](./frontend/screenshots/responsiveness.png)

---

## Media Responsiveness

- The frontend is fully responsive and adapts to desktop, tablet, and mobile screens.
- All main pages and modals are designed to be usable on small screens (min 320px width).
- Uses modern CSS (Flexbox, Grid) for layout and scaling.
- Tested on Chrome, Firefox, and mobile browsers.

---

## Project Structure

```text
VirtualMentalHealthAssistant/
	backend/
		app.py
		db.py
		models.py
		requirements.txt
		migrations/
	frontend/
		src/
			components/
			pages/
			styles/
			utils/
		package.json
		vercel.json
	README.md
```

---

## Installation and Setup (From Scratch)

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm
- PostgreSQL database URL

## 1) Clone Repository

```bash
git clone <your-repo-url>
cd VirtualMentalHealthAssistant
```

## 2) Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://username:password@host:5432/dbname
JWT_SECRET_KEY=your_jwt_secret
OPENROUTER_API_KEY=your_openrouter_api_key
PINECONE_API_KEY=your_pinecone_api_key
```

Apply migrations:

```bash
export FLASK_APP=app.py
flask db upgrade
```

Run backend:

```bash
python app.py
```

Backend runs on `http://localhost:5000`.

## 3) Frontend Setup

```bash
cd ../frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000
```

Run frontend:

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`.

---

## API Guide

### Public Endpoints

- `GET /` - backend health text
- `POST /register` - create account
- `POST /login` - login and get JWT
- `POST /chat` - send user message (works with or without JWT)

### Authenticated Endpoints

- `GET /conversations`
- `GET /conversation/<convo_id>`
- `POST /conversation/new`
- `DELETE /conversation/<convo_id>`
- `POST /conversation/<convo_id>/undo-delete`
- `GET /dashboard/summary`
- `GET /dashboard/insights?days=7`
- `GET /mood?days=30`
- `POST /mood`

---

## Data Model Summary

- **users**: email, name, password hash, created_at
- **conversations**: id, user_email, created_at, deleted_at
- **messages**: id, conversation_id, role, content, timestamp
- **moods**: id, user_email, date, mood, tags_json, note, created_at, updated_at

---

## Deployment Notes

### Frontend (Vercel)

- Uses `frontend/vercel.json` rewrite for SPA routes.
- Set environment variable:
	- `VITE_API_BASE_URL=https://<your-backend-domain>`

### Backend (Render)

- Set environment variables from `.env` keys.
- Ensure CORS allowed origins include:
	- local frontend URL (development)
	- deployed frontend URL

---

## Safety and Ethics Notice

- This assistant is not a replacement for licensed therapy.
- In crisis situations, users should immediately contact emergency or professional support services.
- Crisis contacts are surfaced both on the resources page and in crisis responses.

---

## Current Limitations

- Crisis detection is keyword-based and not a clinical diagnosis.
- AI responses depend on external model/API availability.
- Anonymous sessions are not tracked across accounts.
- The app currently emphasizes English conversational flow.

---

## Quick Troubleshooting

- `401 Unauthorized`: check JWT token in local storage.
- CORS error: verify backend CORS origin list and frontend API URL.
- Empty dashboard: login with the same account used for chatting.
- Backend starts but chat fails: verify `OPENROUTER_API_KEY` and internet access.

---

## Future Enhancements

- Better multilingual handling (English + Swahili)
- Expanded student support analytics
- More personalized coping plans
- In-app report export for research summaries

---

## Author & Contact

- **GitHub:** [ire-design](https://github.com/ire-design)
- **LinkedIn:** [irene-musau](https://www.linkedin.com/in/irene-musau)

---

## License

Add your preferred license here (MIT, Apache-2.0, or institution-specific).
