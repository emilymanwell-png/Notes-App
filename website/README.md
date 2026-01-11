# Cogent Website

A modern B2C website for selling the Cogent notes app with user authentication.

## Features

- 🎨 **Beautiful Landing Page** - Modern, responsive design with hero section, features, pricing, and testimonials
- 🔐 **User Authentication** - Complete signup, login, and password reset flows
- 👤 **User Dashboard** - Account management, subscription info, and quick actions
- 💳 **Stripe-Ready** - Placeholder integration for payment processing
- 📱 **Fully Responsive** - Works on desktop, tablet, and mobile

## Quick Start

### Option 1: Static Files Only (No Auth Backend)
Simply open `index.html` in your browser. Authentication will work in demo mode (client-side only).

### Option 2: With Authentication Backend

1. Install dependencies:
```bash
cd website
npm install
```

2. Start the server:
```bash
npm start
```

3. Open http://localhost:3001 in your browser

## Project Structure

```
website/
├── index.html          # Landing page
├── login.html          # Login page
├── signup.html         # Signup page
├── forgot-password.html# Password reset page
├── dashboard.html      # User dashboard
├── css/
│   └── style.css       # All styles
├── js/
│   ├── main.js         # Landing page scripts
│   ├── auth.js         # Authentication logic
│   └── dashboard.js    # Dashboard functionality
├── server.js           # Express backend
├── package.json        # Node dependencies
└── README.md           # This file
```

## Pages

### Landing Page (index.html)
- Hero section with animated app preview
- Company logos section
- Features grid with hover effects
- "How it works" steps
- Pricing plans with monthly/yearly toggle
- Customer testimonials
- CTA section
- Footer with links

### Authentication Pages
- **Login** - Email/password login with "remember me" and social login buttons
- **Signup** - Full registration with terms acceptance
- **Forgot Password** - Password reset request

### Dashboard
- Welcome greeting
- Usage statistics (notebooks, notes, storage)
- Subscription management
- Account settings
- Quick actions
- Danger zone (delete account)

## API Endpoints

When running with the backend:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/signup | Create new account |
| POST | /api/auth/login | Login to account |
| POST | /api/auth/forgot-password | Request password reset |
| GET | /api/auth/me | Get current user |
| PUT | /api/auth/me | Update user profile |
| POST | /api/auth/change-password | Change password |

## Customization

### Colors
Edit the CSS variables in `css/style.css`:

```css
:root {
    --color-primary: #6366f1;
    --color-primary-dark: #4f46e5;
    --gradient-primary: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);
}
```

### Pricing
Update the pricing cards in `index.html` and modify the prices in the pricing toggle JavaScript.

### Stripe Integration
Replace the placeholder billing functions in `dashboard.js` with actual Stripe integration:

```javascript
function manageBilling() {
    // Redirect to Stripe Customer Portal
    window.location.href = 'https://billing.stripe.com/p/login/...';
}
```

## Production Deployment

1. Set environment variables:
```bash
JWT_SECRET=your-secure-secret-key
PORT=3001
```

2. Use a production database (PostgreSQL, MySQL, etc.) instead of SQLite

3. Enable HTTPS

4. Add rate limiting and security headers

5. Set up email service for password reset

## License

MIT
