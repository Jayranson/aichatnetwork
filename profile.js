/**
 * AI Chat Network - Profile Page JavaScript
 * Handles user profile management, settings, and activity
 */

// API base URL
const API_URL = '/api';

// DOM Elements
let currentUser = null;
let currentAvatarColor = null;
let isAvatarChanged = false;

// Initialize profile page
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login?redirect=profile';
        return;
    }

    try {
        // Load user data
        await loadUserData(token);
        
        // Initialize UI components
        initUI();
        
        // Load user rooms
        await loadUserRooms(token);
        
        // Load user activity
        await loadUserActivity(token);
        
    } catch (error) {
        console.error('Error initializing profile:', error);
        if (error.status === 401) {
            // Unauthorized, redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login?redirect=profile';
        } else {
            showAlert('error', 'Failed to load profile. Please try again later.');
        }
    }
});

// Load user data from API
async function loadUserData(token) {
    const response = await fetch(`${API_URL}/users/me`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    if (!response.ok) {
        const error = new Error('Failed to load user data');
        error.status = response.status;
        throw error;
    }
    
    currentUser = await response.json();
    
    // Update user info in UI
    updateUserInfo(currentUser);
}

// Update user info in UI
function updateUserInfo(user) {
    // Header user info
    const headerAvatar = document.getElementById('header-user-avatar');
    const headerName = document.getElementById('header-user-name');
    
    if (headerAvatar) {
        headerAvatar.textContent = getInitials(user.username);
        if (user.avatarColor) {
            headerAvatar.style.background = user.avatarColor;
            currentAvatarColor = user.avatarColor;
        }
    }
    
    if (headerName) {
        headerName.textContent = user.username;
    }
    
    // Profile header
    const profileAvatar = document.getElementById('profile-avatar');
    const profileName = document.getElementById('profile-name');
    const joinDate = document.getElementById('join-date');
    
    if (profileAvatar) {
        profileAvatar.textContent = getInitials(user.username);
        if (user.avatarColor) {
            profileAvatar.style.background = user.avatarColor;
        }
    }
    
    if (profileName) {
        profileName.textContent = user.username;
    }
    
    if (joinDate && user.createdAt) {
        joinDate.textContent = formatDate(user.createdAt);
    }
    
    // Bio content
    const profileBio = document.getElementById('profile-bio');
    const bioTextarea = document.getElementById('bio-textarea');
    
    if (profileBio) {
        profileBio.innerHTML = user.bio ? 
            `<p>${user.bio}</p>` : 
            '<p class="empty-bio">No bio information available. Click edit to add your bio.</p>';
    }
    
    if (bioTextarea) {
        bioTextarea.value = user.bio || '';
    }
    
    // Settings form
    const settingsUsername = document.getElementById('settings-username');
    const settingsEmail = document.getElementById('settings-email');
    const settingsAvatar = document.getElementById('settings-avatar');
    
    if (settingsUsername) {
        settingsUsername.value = user.username;
    }
    
    if (settingsEmail) {
        settingsEmail.value = user.email;
    }
    
    if (settingsAvatar) {
        settingsAvatar.textContent = getInitials(user.username);
        if (user.avatarColor) {
            settingsAvatar.style.background = user.avatarColor;
        }
    }
}

// Initialize UI components
function initUI() {
    // User menu toggle
    const userMenuTrigger = document.getElementById('user-menu-trigger');
    const userDropdown = document.getElementById('user-dropdown');
    
    if (userMenuTrigger && userDropdown) {
        userMenuTrigger.addEventListener('click', () => {
            userDropdown.classList.toggle('active');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userMenuTrigger.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.remove('active');
            }
        });
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await logout();
        });
    }
    
    // Profile tabs
    const tabButtons = document.querySelectorAll('.tab-button');
    
    if (tabButtons) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all tabs
                tabButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked tab
                button.classList.add('active');
                
                // Hide all tab content
                const tabContents = document.querySelectorAll('.tab-content');
                tabContents.forEach(content => content.classList.add('hidden'));
                
                // Show selected tab content
                const tabId = button.getAttribute('data-tab');
                const tabContent = document.getElementById(`${tabId}-tab`);
                if (tabContent) {
                    tabContent.classList.remove('hidden');
                }
            });
        });
    }
    
    // Bio edit
    const editBioBtn = document.getElementById('edit-bio-btn');
    const profileBio = document.getElementById('profile-bio');
    const editBioForm = document.getElementById('edit-bio-form');
    const cancelBioBtn = document.getElementById('cancel-bio-btn');
    const saveBioBtn = document.getElementById('save-bio-btn');
    
    if (editBioBtn && profileBio && editBioForm) {
        editBioBtn.addEventListener('click', () => {
            profileBio.classList.add('hidden');
            editBioForm.classList.remove('hidden');
        });
        
        if (cancelBioBtn) {
            cancelBioBtn.addEventListener('click', () => {
                // Reset textarea to current bio
                document.getElementById('bio-textarea').value = currentUser.bio || '';
                
                editBioForm.classList.add('hidden');
                profileBio.classList.remove('hidden');
            });
        }
        
        if (saveBioBtn) {
            saveBioBtn.addEventListener('click', async () => {
                const bioText = document.getElementById('bio-textarea').value;
                
                try {
                    showLoading();
                    await updateUserBio(bioText);
                    hideLoading();
                    
                    // Update UI
                    profileBio.innerHTML = bioText ? 
                        `<p>${bioText}</p>` : 
                        '<p class="empty-bio">No bio information available. Click edit to add your bio.</p>';
                    
                    // Hide edit form
                    editBioForm.classList.add('hidden');
                    profileBio.classList.remove('hidden');
                    
                    showAlert('success', 'Bio updated successfully');
                } catch (error) {
                    hideLoading();
                    console.error('Error updating bio:', error);
                    showAlert('error', 'Failed to update bio. Please try again.');
                }
            });
        }
    }
    
    // Avatar colors
    const colorOptions = document.querySelectorAll('.color-option');
    const settingsAvatar = document.getElementById('settings-avatar');
    const saveAvatarBtn = document.getElementById('save-avatar-btn');
    
    if (colorOptions && settingsAvatar) {
        colorOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Remove selected class from all options
                colorOptions.forEach(opt => opt.classList.remove('selected'));
                
                // Add selected class to clicked option
                option.classList.add('selected');
                
                // Update avatar preview
                const color = option.getAttribute('data-color');
                settingsAvatar.style.background = color;
                isAvatarChanged = true;
                currentAvatarColor = color;
            });
            
            // Set selected class on current color
            if (option.getAttribute('data-color') === currentAvatarColor) {
                option.classList.add('selected');
            }
        });
        
        if (saveAvatarBtn) {
            saveAvatarBtn.addEventListener('click', async () => {
                if (!isAvatarChanged) {
                    showAlert('info', 'No changes were made to your avatar');
                    return;
                }
                
                try {
                    showLoading();
                    await updateUserAvatar(currentAvatarColor);
                    hideLoading();
                    
                    // Update all avatar elements
                    const avatars = document.querySelectorAll('.user-avatar, #profile-avatar');
                    avatars.forEach(avatar => {
                        avatar.style.background = currentAvatarColor;
                    });
                    
                    isAvatarChanged = false;
                    showAlert('success', 'Avatar updated successfully');
                } catch (error) {
                    hideLoading();
                    console.error('Error updating avatar:', error);
                    showAlert('error', 'Failed to update avatar. Please try again.');
                }
            });
        }
    }
    
    // Account form
    const accountForm = document.getElementById('account-form');
    
    if (accountForm) {
        accountForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('settings-email').value;
            
            if (!email) {
                showAlert('warning', 'Email address is required');
                return;
            }
            
            try {
                showLoading();
                await updateUserAccount(email);
                hideLoading();
                
                showAlert('success', 'Account information updated successfully');
            } catch (error) {
                hideLoading();
                console.error('Error updating account:', error);
                showAlert('error', 'Failed to update account information. Please try again.');
            }
        });
    }
    
    // Password form
    const passwordForm = document.getElementById('password-form');
    
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            if (!currentPassword || !newPassword || !confirmPassword) {
                showAlert('warning', 'All password fields are required');
                return;
            }
            
            if (newPassword.length < 8) {
                showAlert('warning', 'New password must be at least 8 characters long');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                showAlert('warning', 'New passwords do not match');
                return;
            }
            
            try {
                showLoading();
                
                // Call API to change password
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/users/password`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        currentPassword,
                        newPassword
                    })
                });
                
                hideLoading();
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to change password');
                }
                
                // Reset form
                passwordForm.reset();
                
                showAlert('success', 'Password changed successfully');
            } catch (error) {
                hideLoading();
                console.error('Error changing password:', error);
                showAlert('error', error.message || 'Failed to change password. Please verify your current password is correct.');
            }
        });
    }
    
    // Delete account
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    const deleteAccountModal = document.getElementById('delete-account-modal');
    const closeDeleteModal = document.getElementById('close-delete-modal');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const confirmDeleteInput = document.getElementById('confirm-delete-input');
    
    if (deleteAccountBtn && deleteAccountModal) {
        deleteAccountBtn.addEventListener('click', () => {
            deleteAccountModal.classList.add('visible');
        });
        
        if (closeDeleteModal) {
            closeDeleteModal.addEventListener('click', () => {
                deleteAccountModal.classList.remove('visible');
                confirmDeleteInput.value = '';
                confirmDeleteBtn.disabled = true;
            });
        }
        
        if (cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', () => {
                deleteAccountModal.classList.remove('visible');
                confirmDeleteInput.value = '';
                confirmDeleteBtn.disabled = true;
            });
        }
        
        if (confirmDeleteInput) {
            confirmDeleteInput.addEventListener('input', () => {
                confirmDeleteBtn.disabled = confirmDeleteInput.value !== 'DELETE';
            });
        }
        
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', async () => {
                if (confirmDeleteInput.value !== 'DELETE') {
                    return;
                }
                
                try {
                    showLoading();
                    
                    // Call API to delete account
                    const token = localStorage.getItem('token');
                    const response = await fetch(`${API_URL}/users/me`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    hideLoading();
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.detail || 'Failed to delete account');
                    }
                    
                    // Clear local storage
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    
                    // Show success message and redirect after a short delay
                    showAlert('success', 'Your account has been deleted successfully');
                    
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 2000);
                    
                } catch (error) {
                    hideLoading();
                    console.error('Error deleting account:', error);
                    showAlert('error', error.message || 'Failed to delete account. Please try again later.');
                    
                    // Close modal
                    deleteAccountModal.classList.remove('visible');
                }
            });
        }
    }
}

// Load user rooms
async function loadUserRooms(token) {
    try {
        const response = await fetch(`${API_URL}/rooms/public`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load rooms');
        }
        
        const rooms = await response.json();
        
        // Filter rooms where the user is a member
        const userRooms = rooms.filter(room => 
            room.members && room.members.includes(currentUser.username)
        );
        
        // Update UI
        updateUserRooms(userRooms);
        
        // Update rooms count
        document.getElementById('rooms-joined').textContent = userRooms.length;
    } catch (error) {
        console.error('Error loading user rooms:', error);
    }
}

// Update user rooms in UI
function updateUserRooms(rooms) {
    const roomsContainer = document.getElementById('profile-rooms');
    
    if (!roomsContainer) return;
    
    if (!rooms.length) {
        roomsContainer.innerHTML = '<p class="empty-state">You haven\'t joined any rooms yet. <a href="/chat">Browse chat rooms</a> to get started.</p>';
        return;
    }
    
    roomsContainer.innerHTML = '';
    
    // Create room cards
    rooms.forEach(room => {
        const roomCard = document.createElement('div');
        roomCard.className = 'profile-room-card';
        
        roomCard.innerHTML = `
            <div class="room-card-header">
                <div class="room-name">${room.name}</div>
                <div class="room-badge">${room.members[0] === currentUser.username ? 'Owner' : 'Member'}</div>
            </div>
            <div class="room-topic">${room.topic}</div>
            <div class="room-stats">
                <div class="room-stat">
                    <span class="stat-icon">👥</span>
                    <span>${room.totalUsers} members</span>
                </div>
                <div class="room-stat">
                    <span class="stat-icon">${room.isPublic ? '🌐' : '🔒'}</span>
                    <span>${room.isPublic ? 'Public' : 'Private'}</span>
                </div>
            </div>
            <div class="room-action">
                <a href="/chat?room=${room.id}" class="btn btn-outline">Enter Room</a>
            </div>
        `;
        
        roomsContainer.appendChild(roomCard);
    });
}

// Load user activity
async function loadUserActivity(token) {
    try {
        const response = await fetch(`${API_URL}/users/me/activity`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load user activity');
        }
        
        const activityData = await response.json();
        
        // Update stats
        document.getElementById('messages-count').textContent = activityData.messagesCount || '0';
        document.getElementById('ai-interactions').textContent = activityData.aiInteractionsCount || '0';
        
        // Update activity timeline
        const activityContainer = document.getElementById('activity-timeline');
        
        if (!activityContainer) return;
        
        if (!activityData.activities || activityData.activities.length === 0) {
            activityContainer.innerHTML = '<p class="empty-state">No recent activity to show.</p>';
            return;
        }
        
        activityContainer.innerHTML = '';
        
        // Sort activities by timestamp (newest first)
        const sortedActivities = activityData.activities.sort((a, b) => {
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        // Display activities
        sortedActivities.forEach(activity => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            
            const timestamp = new Date(activity.timestamp);
            const formattedDate = formatDate(timestamp);
            const formattedTime = formatTime(timestamp);
            
            let icon = '';
            switch (activity.type) {
                case 'message':
                    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
                    break;
                case 'join_room':
                    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>';
                    break;
                case 'create_room':
                    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H19C20.1 3 21 3.9 21 5V19C21 20.1 20.1 21 19 21Z"></path><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>';
                    break;
                case 'ai_interaction':
                    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
                    break;
                default:
                    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>';
            }
            
            activityItem.innerHTML = `
                <div class="activity-icon">${icon}</div>
                <div class="activity-content">
                    <div class="activity-text">${activity.text}</div>
                    <div class="activity-time">${formattedDate} at ${formattedTime}</div>
                </div>
            `;
            
            activityContainer.appendChild(activityItem);
        });
        
    } catch (error) {
        console.error('Error loading user activity:', error);
        
        // Show empty state if error
        const activityContainer = document.getElementById('activity-timeline');
        if (activityContainer) {
            activityContainer.innerHTML = '<p class="empty-state">No recent activity to show.</p>';
        }
        
        // Set default stats
        document.getElementById('messages-count').textContent = '0';
        document.getElementById('ai-interactions').textContent = '0';
    }
}

// Update user bio
async function updateUserBio(bio) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bio })
    });
    
    if (!response.ok) {
        throw new Error('Failed to update bio');
    }
    
    // Update current user
    const updatedUser = await response.json();
    currentUser = updatedUser;
    
    // Update local storage
    const storedUser = JSON.parse(localStorage.getItem('user'));
    if (storedUser) {
        storedUser.bio = bio;
        localStorage.setItem('user', JSON.stringify(storedUser));
    }
    
    return updatedUser;
}

// Update user avatar
async function updateUserAvatar(avatarColor) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ avatarColor })
    });
    
    if (!response.ok) {
        throw new Error('Failed to update avatar');
    }
    
    // Update current user
    const updatedUser = await response.json();
    currentUser = updatedUser;
    
    // Update local storage
    const storedUser = JSON.parse(localStorage.getItem('user'));
    if (storedUser) {
        storedUser.avatarColor = avatarColor;
        localStorage.setItem('user', JSON.stringify(storedUser));
    }
    
    return updatedUser;
}

// Update user account
async function updateUserAccount(email) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
    });
    
    if (!response.ok) {
        throw new Error('Failed to update account');
    }
    
    // Update current user
    const updatedUser = await response.json();
    currentUser = updatedUser;
    
    // Update local storage
    const storedUser = JSON.parse(localStorage.getItem('user'));
    if (storedUser) {
        storedUser.email = email;
        localStorage.setItem('user', JSON.stringify(storedUser));
    }
    
    return updatedUser;
}

// Logout user
async function logout() {
    const token = localStorage.getItem('token');
    
    try {
        // Call logout API
        await fetch(`${API_URL}/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
    } catch (error) {
        console.error('Error logging out:', error);
    } finally {
        // Clear local storage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Redirect to login page
        window.location.href = '/login';
    }
}

// Get initials from name
function getInitials(name) {
    if (!name) return '';
    
    const nameParts = name.split(' ');
    if (nameParts.length === 1) {
        return name.substring(0, 2).toUpperCase();
    }
    
    return (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase();
}

// Format date
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
}

// Show alert message
function showAlert(type, message) {
    const alertsContainer = document.getElementById('alerts-container');
    
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
