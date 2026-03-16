# Production Environment Guide

To host your application on Hostinger, you will need to set up the following environment variables.

## Server-side (Hostinger VPS / Panel)
Create a `.env` file in the `server/` directory or set these in your hosting panel:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `MONGO_URI` | Your MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | A long, random string for security | `your_secret_key_here` |
| `PORT` | The port the server runs on | `5005` |
| `RAZORPAY_KEY_ID` | Your Razorpay API Key ID | `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | Your Razorpay API Key Secret | `...` |
| `GEMINI_API_KEY` | For AI Stylist features | `...` |
| `FRONTEND_URL` | Your production frontend URL | `https://slook.in` |
| `EMAIL_USER` | For sending transaction emails | `...` |
| `EMAIL_PASS` | Password/App Key for email | `...` |

## Client-side (Vite Build)
These must be available during the `npm run build` process:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | The URL of your backend API | `https://slook.in/api` |
| `VITE_GOOGLE_CLIENT_ID` | Your Google Login Client ID | `...` |

> [!IMPORTANT]
> Since we are using local storage, ensure the `uploads/` folder in the server directory has **read/write permissions** for the Node.js process.
