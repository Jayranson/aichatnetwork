/**
 * AI Chat Network - Authentication JavaScript
 * Handles login and registration functionality
 */

// API Base URL
const API_URL = '/api';

// Check if user is already logged in when page loads
document.addEventListener('DOMContentLoaded', function() {
    checkAuthState();
    
    // Set up event listeners for login and registration forms
    setupLoginForm();
    setupRegistrationForm();
    setupPasswordResetForm();
});

// Check authentication state
function checkAuthState() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Validate token with API
    fetch(`${API_URL}/users/me`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (response.ok) {
            // User is authenticated, redirect based on the page
            if (window.location.pathname.includes('login') || 
                window.location.pathname.includes('register')) {
                
                // Get redirect URL from query string if available
                const urlParams = new URLSearchParams(window.location.search);
                const redirectUrl = urlParams.get('redirect');
                
                // Redirect to chat or specified page
                window.location.href = redirectUrl ? `/${redirectUrl}` : '/chat';
            }
        } else {
            // Invalid token, remove it
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    })
    .catch(error => {
        console.error('Error checking authentication:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    });
}

// Set up login form
function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Show loading overlay
        showLoading();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember-me')?.checked || false;
        
        try {
            const response = await fetch(`${API_URL}/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Store token and user data
                localStorage.setItem('token', data.access_token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // If remember me is not checked, set expiration for the token
                if (!rememberMe) {
                    // Set token to expire in 1 day
                    const expiration = Date.now() + 24 * 60 * 60 * 1000;
                    localStorage.setItem('token_expiration', expiration);
                }
                
                // Redirect to chat or previous page
                const redirectTo = getRedirectUrl() || '/chat';
                window.location.href = redirectTo;
            } else {
                const errorData = await response.json();
                showAlert('error', errorData.detail || 'Invalid username or password. Please try again.');
            }
        } catch (error) {
            console.error('Login error:', error);
            showAlert('error', 'Something went wrong. Please try again later.');
        } finally {
            hideLoading();
        }
    });
    
    // Password visibility toggle
    const passwordToggle = document.getElementById('password-toggle');
    const passwordInput = document.getElementById('password');
    
    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Toggle icon visibility
            passwordToggle.querySelector('.eye-icon').classList.toggle('hidden');
            passwordToggle.querySelector('.eye-slash-icon').classList.toggle('hidden');
        });
    }
}

// Set up registration form
function setupRegistrationForm() {
    const registerForm = document.getElementById('register-form');
    if (!registerForm) return;
    
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get form values
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const termsAccepted = document.getElementById('terms-accept')?.checked || false;
        
        // Validate form
        if (!username || !email || !password || !confirmPassword) {
            showAlert('warning', 'Please fill in all required fields.');
            return;
        }
        
        if (!isValidUsername(username)) {
            showAlert('warning', 'Username must be 3-20 characters and contain only letters, numbers, and underscores.');
            return;
        }
        
        if (!isValidEmail(email)) {
            showAlert('warning', 'Please enter a valid email address.');
            return;
        }
        
        if (password.length < 8) {
            showAlert('warning', 'Password must be at least 8 characters long.');
            return;
        }
        
        if (password !== confirmPassword) {
            showAlert('warning', 'Passwords do not match.');
            return;
        }
        
        if (!termsAccepted) {
            showAlert('warning', 'You must accept the Terms of Service and Privacy Policy.');
            return;
        }
        
        // Show loading overlay
        showLoading();
        
        try {
            const response = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Show success modal
                hideLoading();
                showSuccessModal();
            } else {
                // Show error message
                hideLoading();
                showAlert('error', data.detail || 'Registration failed. Please try again.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            hideLoading();
            showAlert('error', 'Something went wrong. Please try again later.');
        }
    });
    
    // Password visibility toggles
    setupPasswordToggle('password', 'password-toggle');
    setupPasswordToggle('confirm-password', 'confirm-password-toggle');
    
    // Success modal redirect
    const goToLoginBtn = document.getElementById('go-to-login-btn');
    if (goToLoginBtn) {
        goToLoginBtn.addEventListener('click', () => {
            window.location.href = '/login';
        });
    }
}

// Set up password reset form
function setupPasswordResetForm() {
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const loginFormEl = document.getElementById('login-form');
    const forgotPasswordFormEl = document.getElementById('forgot-password-form');
    const backToLoginBtn = document.getElementById('back-to-login-btn');
    const sendRecoveryBtn = document.getElementById('send-recovery-btn');
    
    if (forgotPasswordLink && loginFormEl && forgotPasswordFormEl) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginFormEl.classList.add('hidden');
            forgotPasswordFormEl.classList.remove('hidden');
            document.querySelector('.auth-header h1').textContent = 'Reset Password';
            document.querySelector('.auth-header p').textContent = 'Enter your email to receive a recovery link';
        });
        
        if (backToLoginBtn) {
            backToLoginBtn.addEventListener('click', () => {
                forgotPasswordFormEl.classList.add('hidden');
                loginFormEl.classList.remove('hidden');
                document.querySelector('.auth-header h1').textContent = 'Welcome Back';
                document.querySelector('.auth-header p').textContent = 'Sign in to continue to AI Chat Network';
            });
        }
        
        if (sendRecoveryBtn) {
            sendRecoveryBtn.addEventListener('click', async () => {
                const email = document.getElementById('recovery-email').value;
                if (!email) {
                    showAlert('warning', 'Please enter your email address.');
                    return;
                }
                
                // Validate email format
                if (!isValidEmail(email)) {
                    showAlert('warning', 'Please enter a valid email address.');
                    return;
                }
                
                // Show loading overlay
                showLoading();
                
                try {
                    // Call password reset API
                    const response = await fetch(`${API_URL}/users/password-reset`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ email })
                    });
                    
                    hideLoading();
                    
                    if (response.ok) {
                        showAlert('success', 'Recovery link sent! Please check your email.');
                        
                        // Reset form and go back to login
                        forgotPasswordFormEl.classList.add('hidden');
                        loginFormEl.classList.remove('hidden');
                        document.querySelector('.auth-header h1').textContent = 'Welcome Back';
                        document.querySelector('.auth-header p').textContent = 'Sign in to continue to AI Chat Network';
                    } else {
                        const error = await response.json();
                        throw new Error(error.detail || 'Failed to send recovery link');
                    }
                } catch (error) {
                    hideLoading();
                    console.error('Error sending recovery link:', error);
                    showAlert('error', error.message || 'Failed to send recovery link. Please try again later.');
                }
            });
        }
    }
}

// Set up password visibility toggle
function setupPasswordToggle(inputId, toggleId) {
    const passwordInput = document.getElementById(inputId);
    const passwordToggle = document.getElementById(toggleId);
    
    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Toggle icon visibility
            passwordToggle.querySelector('.eye-icon').classList.toggle('hidden');
            passwordToggle.querySelector('.eye-slash-icon').classList.toggle('hidden');
        });
    }
}

// Show success modal
function showSuccessModal() {
    const modal = document.getElementById('success-modal');
    if (modal) {
        modal.classList.add('visible');
        
        // Automatically redirect to login after 3 seconds
        setTimeout(() => {
            window.location.href = '/login';
        }, 3000);
    }
}

// Get redirect URL from query string
function getRedirectUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const redirectParam = urlParams.get('redirect');
    
    if (redirectParam) {
        return `/${redirectParam}`;
    }
    
    // Check if we were redirected from a protected page
    const fromProtectedPage = localStorage.getItem('from_protected_page');
    if (fromProtectedPage) {
        localStorage.removeItem('from_protected_page');
        return `/${fromProtectedPage}`;
    }
    
    return null;
}

// Validate username format
function isValidUsername(username) {
    const regex = /^[a-zA-Z0-9_]{3,20}$/;
    return regex.test(username);
}

// Validate email format
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Show alert message
function showAlert(type, message) {
    const alertsContainer = document.getElementById('auth-alerts');
    if (!alertsContainer) return;
    
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    
    let icon = '';
    if (type === 'error') {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    } else if (type === 'success') {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    } else if (type === 'warning') {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
    }
    
    alert.innerHTML = `
        <div class="alert-icon">${icon}</div>
        <div class="alert-message">${message}</div>
        <button class="alert-close">&times;</button>
    `;
    
    // Add close button functionality
    alert.querySelector('.alert-close').addEventListener('click', () => {
        alert.remove();
    });
    
    // Add to alerts container
    alertsContainer.appendChild(alert);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

// Show loading overlay
function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('visible');
    }
}

// Hide loading overlay
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('visible');
    }
}

// #CommentComplete
