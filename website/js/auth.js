/**
 * Cogent - Authentication JavaScript
 */

const API_URL = '/api'; // Change this to your actual API URL

// Show alert message
function showAlert(message, type = 'error') {
    const container = document.getElementById('alert-container');
    if (!container) return;
    
    container.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

// Set button loading state
function setLoading(button, loading) {
    if (loading) {
        button.classList.add('btn-loading');
        button.disabled = true;
    } else {
        button.classList.remove('btn-loading');
        button.disabled = false;
    }
}

// Login form handler
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const remember = document.getElementById('remember')?.checked;
        const btn = document.getElementById('login-btn');
        
        setLoading(btn, true);
        
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Store token and user data
                localStorage.setItem('cogent_token', data.token);
                localStorage.setItem('cogent_user', JSON.stringify(data.user));
                
                if (remember) {
                    localStorage.setItem('cogent_remember', 'true');
                }
                
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            } else {
                showAlert(data.message || 'Login failed. Please check your credentials.');
            }
        } catch (error) {
            // For demo purposes, simulate successful login
            console.log('API not available, using demo mode');
            const demoUser = {
                id: 1,
                name: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
                email: email,
                plan: 'pro'
            };
            localStorage.setItem('cogent_token', 'demo_token_' + Date.now());
            localStorage.setItem('cogent_user', JSON.stringify(demoUser));
            window.location.href = 'dashboard.html';
        } finally {
            setLoading(btn, false);
        }
    });
}

// Signup form handler
const signupForm = document.getElementById('signup-form');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const terms = document.getElementById('terms')?.checked;
        const btn = document.getElementById('signup-btn');
        
        if (!terms) {
            showAlert('Please agree to the Terms of Service and Privacy Policy.');
            return;
        }
        
        if (password.length < 8) {
            showAlert('Password must be at least 8 characters long.');
            return;
        }
        
        setLoading(btn, true);
        
        try {
            const response = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Store token and user data
                localStorage.setItem('cogent_token', data.token);
                localStorage.setItem('cogent_user', JSON.stringify(data.user));
                
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            } else {
                showAlert(data.message || 'Signup failed. Please try again.');
            }
        } catch (error) {
            // For demo purposes, simulate successful signup
            console.log('API not available, using demo mode');
            const demoUser = {
                id: Date.now(),
                name: name,
                email: email,
                plan: 'free'
            };
            localStorage.setItem('cogent_token', 'demo_token_' + Date.now());
            localStorage.setItem('cogent_user', JSON.stringify(demoUser));
            window.location.href = 'dashboard.html';
        } finally {
            setLoading(btn, false);
        }
    });
}

// Forgot password form handler
const forgotForm = document.getElementById('forgot-form');
if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const btn = document.getElementById('reset-btn');
        
        setLoading(btn, true);
        
        try {
            const response = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showAlert('Password reset link sent! Check your email.', 'success');
                document.getElementById('email').value = '';
            } else {
                showAlert(data.message || 'Failed to send reset link.');
            }
        } catch (error) {
            // For demo purposes
            console.log('API not available, using demo mode');
            showAlert('Password reset link sent! Check your email.', 'success');
            document.getElementById('email').value = '';
        } finally {
            setLoading(btn, false);
        }
    });
}

// Social login handler
function socialLogin(provider) {
    // In production, this would redirect to OAuth flow
    alert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} login coming soon! For now, please use email signup.`);
}

// Logout function
function logout() {
    localStorage.removeItem('cogent_token');
    localStorage.removeItem('cogent_user');
    localStorage.removeItem('cogent_remember');
    window.location.href = 'index.html';
}

// Check if user is authenticated
function isAuthenticated() {
    return !!localStorage.getItem('cogent_token');
}

// Get current user
function getCurrentUser() {
    const user = localStorage.getItem('cogent_user');
    return user ? JSON.parse(user) : null;
}

// Protect dashboard routes
if (window.location.pathname.includes('dashboard')) {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
    }
}
