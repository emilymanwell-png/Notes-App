/**
 * Cogent - Main Frontend JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            navLinks.classList.toggle('active');
            mobileMenuBtn.classList.toggle('active');
        });
    }

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // Pricing toggle
    const toggleSwitch = document.querySelector('.toggle-switch');
    const toggleLabels = document.querySelectorAll('.toggle-label');
    const prices = document.querySelectorAll('.pricing-price .price');
    
    if (toggleSwitch) {
        toggleSwitch.addEventListener('click', function() {
            this.classList.toggle('active');
            
            const isYearly = this.classList.contains('active');
            
            toggleLabels.forEach(label => {
                if (label.dataset.period === 'yearly') {
                    label.classList.toggle('active', isYearly);
                } else {
                    label.classList.toggle('active', !isYearly);
                }
            });
            
            prices.forEach(price => {
                if (price.dataset.monthly && price.dataset.yearly) {
                    price.textContent = isYearly ? price.dataset.yearly : price.dataset.monthly;
                }
            });
        });
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                const navHeight = navbar ? navbar.offsetHeight : 0;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Animate elements on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.feature-card, .testimonial-card, .pricing-card, .step').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Add animate-in styles
    const style = document.createElement('style');
    style.textContent = `
        .animate-in {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);

    // Check auth state and update nav
    updateNavForAuthState();
});

// Update navigation based on auth state
function updateNavForAuthState() {
    const token = localStorage.getItem('cogent_token');
    const user = JSON.parse(localStorage.getItem('cogent_user') || 'null');
    
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;
    
    if (token && user) {
        // User is logged in - update nav buttons
        const loginBtn = navLinks.querySelector('a[href="login.html"]');
        const signupBtn = navLinks.querySelector('a[href="signup.html"]');
        
        if (loginBtn) {
            loginBtn.href = 'dashboard.html';
            loginBtn.textContent = 'Dashboard';
        }
        
        if (signupBtn) {
            signupBtn.href = '#';
            signupBtn.textContent = user.name.split(' ')[0];
            signupBtn.onclick = (e) => {
                e.preventDefault();
                window.location.href = 'dashboard.html';
            };
        }
    }
}

// Placeholder for demo video modal
function openDemoModal() {
    alert('Demo video coming soon!');
}
