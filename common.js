/**
 * AI Chat Network - Common JavaScript Functions
 * Shared functionality across all pages
 */

// API URL
const API_BASE_URL = '/api';

// Check token expiration on page load
document.addEventListener('DOMContentLoaded', () => {
    checkTokenExpiration();
});

// Check if token is expired
function checkTokenExpiration() {
    const token = localStorage.getItem('token');
    const expiration = localStorage.getItem('token_expiration');
    
    if (token && expiration) {
        const now = Date.now();
        if (now > parseInt(expiration)) {
            // Token is expired, remove it
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('token_expiration');
            
            // Redirect to login if on a protected page
            const protectedPages = ['/chat', '/profile'];
            const currentPath = window.location.pathname;
            
            if (protectedPages.includes(currentPath)) {
                window.location.href = `/login?redirect=${currentPath.substring(1)}`;
            }
        }
    }
}

// Format date
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
}

// Format time
function formatTime(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Format date and time
function formatDateTime(dateString) {
    if (!dateString) return '';
    
    return `${formatDate(dateString)} at ${formatTime(dateString)}`;
}

// Get user initials
function getUserInitials(name) {
    if (!name) return '';
    
    const nameParts = name.split(' ');
    if (nameParts.length === 1) {
        return name.substring(0, 2).toUpperCase();
    }
    
    return (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase();
}

// Get query parameter
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Copy text to clipboard
function copyToClipboard(text) {
    if (navigator.clipboard) {
        return navigator.clipboard.writeText(text);
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            return Promise.resolve(successful);
        } catch (err) {
            document.body.removeChild(textarea);
            return Promise.reject(err);
        }
    }
}

// Validate email format
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

// Validate username format
function isValidUsername(username) {
    const re = /^[a-zA-Z0-9_]{3,20}$/;
    return re.test(username);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Show alert message (if container exists)
function showAlert(type, message, containerSelector = '.alerts-container') {
    const alertsContainer = document.querySelector(containerSelector);
    
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
    } else if (type === 'info') {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
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

// Create WebSocket connection
function createWebSocketConnection(token, onOpen, onMessage, onClose, onError) {
    // Determine WebSocket URL based on current protocol and host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${token}`;
    
    const socket = new WebSocket(wsUrl);
    
    socket.addEventListener('open', onOpen);
    socket.addEventListener('message', onMessage);
    socket.addEventListener('close', onClose);
    socket.addEventListener('error', onError);
    
    // Heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'heartbeat' }));
        }
    }, 30000); // 30 seconds
    
    // Clear heartbeat on close
    socket.addEventListener('close', () => {
        clearInterval(heartbeatInterval);
    });
    
    return {
        socket,
        send: (type, data) => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type,
                    data
                }));
            }
        },
        close: () => {
            clearInterval(heartbeatInterval);
            socket.close();
        }
    };
}

// Show loading overlay
function showLoading(overlayId = 'loading-overlay') {
    const overlay = document.getElementById(overlayId);
    if (overlay) {
        overlay.classList.add('visible');
    }
}

// Hide loading overlay
function hideLoading(overlayId = 'loading-overlay') {
    const overlay = document.getElementById(overlayId);
    if (overlay) {
        overlay.classList.remove('visible');
    }
}

// Get user data from token
async function getUserFromToken(token) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to get user data');
        }
        
        const userData = await response.json();
        return userData;
    } catch (error) {
        console.error('Error getting user data:', error);
        throw error;
    }
}

// #CommentComplete
