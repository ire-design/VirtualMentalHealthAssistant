# VirtualMentalHealthAssistant

AI-powered virtual mental health assistant focused on academic stress support.

## Project structure

- `backend/`: Flask API, Pinecone context retrieval, OpenRouter chat completion
- `frontend/`: React + Vite chat interface

## Backend setup

1. Create and activate a virtual environment inside `backend/`.
2. Install dependencies:
	- `pip install -r requirements.txt`
3. Create a `.env` file in `backend/` with:
	- `PINECONE_API_KEY=your_pinecone_key`
	- `OPENROUTER_API_KEY=your_openrouter_key`
4. Start backend:
	- `python app.py`

Backend runs on `http://localhost:5000`.

## Frontend setup

1. From `frontend/`, install dependencies:
	- `npm install`
2. Start development server:
	- `npm run dev`

Frontend runs on Vite default port and sends chat requests to `http://localhost:5000/chat`.
