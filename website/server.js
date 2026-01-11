/**
 * Cogent Website - Express Server with Authentication
 */

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

// Try to use better-sqlite3, fallback to in-memory storage
let db;
let useInMemory = false;

try {
    const Database = require('better-sqlite3');
    db = new Database(path.join(__dirname, 'cogent.db'));
    
    // Create users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            plan TEXT DEFAULT 'free',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    console.log('Using SQLite database');
} catch (err) {
    console.log('SQLite not available, using in-memory storage');
    useInMemory = true;
    db = {
        users: [],
        nextId: 1
    };
}

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'cogent-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Helper functions for in-memory DB
function findUserByEmail(email) {
    if (useInMemory) {
        return db.users.find(u => u.email === email);
    }
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function findUserById(id) {
    if (useInMemory) {
        return db.users.find(u => u.id === id);
    }
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function createUser(name, email, hashedPassword) {
    if (useInMemory) {
        const user = {
            id: db.nextId++,
            name,
            email,
            password: hashedPassword,
            plan: 'free',
            created_at: new Date().toISOString()
        };
        db.users.push(user);
        return { lastInsertRowid: user.id };
    }
    return db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(name, email, hashedPassword);
}

function updateUser(id, name, email) {
    if (useInMemory) {
        const user = db.users.find(u => u.id === id);
        if (user) {
            user.name = name;
            user.email = email;
        }
        return { changes: user ? 1 : 0 };
    }
    return db.prepare('UPDATE users SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, email, id);
}

// Generate JWT token
function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

// Auth middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = decoded;
        next();
    });
}

// Routes

// Signup
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters' });
        }
        
        // Check if user exists
        const existingUser = findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const result = createUser(name, email, hashedPassword);
        const userId = result.lastInsertRowid;
        
        // Get created user
        const user = findUserById(userId);
        
        // Generate token
        const token = generateToken(user);
        
        res.status(201).json({
            message: 'Account created successfully',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                plan: user.plan
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Server error during signup' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validate input
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        
        // Find user
        const user = findUserByEmail(email);
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        
        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        
        // Generate token
        const token = generateToken(user);
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                plan: user.plan
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// Forgot password (placeholder)
app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;
    
    // In production, this would send an actual email
    console.log(`Password reset requested for: ${email}`);
    
    res.json({ message: 'Password reset email sent' });
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
    const user = findUserById(req.user.id);
    
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            plan: user.plan
        }
    });
});

// Update user
app.put('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const { name, email } = req.body;
        
        // Check if email is taken by another user
        const existingUser = findUserByEmail(email);
        if (existingUser && existingUser.id !== req.user.id) {
            return res.status(400).json({ message: 'Email already in use' });
        }
        
        updateUser(req.user.id, name, email);
        
        const user = findUserById(req.user.id);
        
        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                plan: user.plan
            }
        });
    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ message: 'Server error during update' });
    }
});

// Change password
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ message: 'New password must be at least 8 characters' });
        }
        
        const user = findUserById(req.user.id);
        
        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        if (useInMemory) {
            user.password = hashedPassword;
        } else {
            db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashedPassword, req.user.id);
        }
        
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ message: 'Server error during password change' });
    }
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ◉ Cogent Website Server                                 ║
║                                                           ║
║   Server running at: http://localhost:${PORT}               ║
║                                                           ║
║   Pages:                                                  ║
║   • Home:      http://localhost:${PORT}/                    ║
║   • Login:     http://localhost:${PORT}/login.html          ║
║   • Signup:    http://localhost:${PORT}/signup.html         ║
║   • Dashboard: http://localhost:${PORT}/dashboard.html      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});
