/**
 * Cogent - Dashboard JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    
    // Load user data
    loadUserData();
    
    // Setup user menu dropdown
    setupUserMenu();
    
    // Setup account form
    setupAccountForm();
});

// Load and display user data
function loadUserData() {
    const user = getCurrentUser();
    if (!user) return;
    
    // Update user avatar initials
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl) avatarEl.textContent = initials;
    
    // Update user name
    const nameEl = document.getElementById('user-name');
    if (nameEl) nameEl.textContent = user.name;
    
    // Update greeting
    const greetingEl = document.getElementById('greeting-name');
    if (greetingEl) greetingEl.textContent = user.name.split(' ')[0];
    
    // Update plan
    const planEl = document.getElementById('user-plan');
    const planBadge = document.getElementById('plan-badge');
    const planName = user.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : 'Free';
    
    if (planEl) planEl.textContent = `${planName} Plan`;
    if (planBadge) planBadge.textContent = planName;
    
    // Update plan price based on plan
    const planPrice = document.getElementById('plan-price');
    if (planPrice) {
        switch (user.plan) {
            case 'pro':
                planPrice.innerHTML = '$12<span>/month</span>';
                break;
            case 'team':
                planPrice.innerHTML = '$29<span>/user/month</span>';
                break;
            default:
                planPrice.innerHTML = '$0<span>/month</span>';
        }
    }
    
    // Update account form
    const accountName = document.getElementById('account-name');
    const accountEmail = document.getElementById('account-email');
    if (accountName) accountName.value = user.name;
    if (accountEmail) accountEmail.value = user.email;
    
    // Load usage stats (demo data)
    loadUsageStats();
}

// Load usage statistics
function loadUsageStats() {
    // In production, this would fetch from API
    const stats = {
        notebooks: Math.floor(Math.random() * 20) + 3,
        notes: Math.floor(Math.random() * 100) + 10,
        storage: (Math.random() * 5 + 0.5).toFixed(1) + ' GB'
    };
    
    const notebookCount = document.getElementById('notebook-count');
    const noteCount = document.getElementById('note-count');
    const storageUsed = document.getElementById('storage-used');
    
    if (notebookCount) notebookCount.textContent = stats.notebooks;
    if (noteCount) noteCount.textContent = stats.notes;
    if (storageUsed) storageUsed.textContent = stats.storage;
}

// Setup user menu dropdown
function setupUserMenu() {
    const userMenu = document.getElementById('user-menu');
    const dropdown = document.getElementById('user-dropdown');
    
    if (!userMenu || !dropdown) return;
    
    userMenu.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function() {
        dropdown.style.display = 'none';
    });
}

// Setup account form
function setupAccountForm() {
    const form = document.getElementById('account-form');
    if (!form) return;
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('account-name').value;
        const email = document.getElementById('account-email').value;
        
        try {
            // In production, this would call the API
            const user = getCurrentUser();
            user.name = name;
            user.email = email;
            localStorage.setItem('cogent_user', JSON.stringify(user));
            
            // Refresh display
            loadUserData();
            
            alert('Account settings saved successfully!');
        } catch (error) {
            alert('Failed to save settings. Please try again.');
        }
    });
}

// Quick action handlers
function launchApp() {
    // Redirect to the main Notes App
    window.location.href = '../index.html';
}

function openSettings() {
    // Scroll to account settings section
    document.querySelector('.dashboard-card:has(#account-form)')?.scrollIntoView({ behavior: 'smooth' });
}

function viewDocs() {
    alert('Documentation coming soon!');
}

function getSupport() {
    alert('Support chat coming soon! For now, email us at support@cogent.app');
}

function manageBilling() {
    // In production, this would open Stripe billing portal
    alert('Billing management coming soon! This will integrate with Stripe.');
}

function changePlan() {
    window.location.href = 'index.html#pricing';
}

function changePassword() {
    const newPassword = prompt('Enter new password (min 8 characters):');
    if (newPassword && newPassword.length >= 8) {
        alert('Password updated successfully!');
    } else if (newPassword) {
        alert('Password must be at least 8 characters long.');
    }
}

function deleteAccount() {
    const confirmed = confirm('Are you sure you want to delete your account? This action cannot be undone.');
    if (confirmed) {
        const doubleConfirm = confirm('This will permanently delete all your data. Are you absolutely sure?');
        if (doubleConfirm) {
            localStorage.removeItem('cogent_token');
            localStorage.removeItem('cogent_user');
            alert('Your account has been deleted.');
            window.location.href = 'index.html';
        }
    }
}
