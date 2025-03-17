/**
 * AI Chat Network - Chat Room JavaScript
 * Handles real-time chat functionality with WebSocket connection
 */

// Global variables
let currentUser = null;
let isAdmin = false;
let isOwner = false;
let isHost = false;
let currentRoom = null;
let selectedUser = null;
let wsConnection = null;
let typingTimeout = null;
let activeWhispers = {};

// Role Icons
const ROLE_ICONS = {
    admin: '👑', // Crown for admins
    owner: '⭐', // Star for owners
    host: '🛡️', // Shield for hosts
    ai: '🤖'    // Robot for AI
};

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Chat room page loaded, checking authentication...');
    
    // Initialize sidebar resizer
    initSidebarResizer();
    
    // Initialize movable whisper window
    initMovableWhisper();
    
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('No token found, redirecting to login...');
        // Set flag for redirecting from protected page
        localStorage.setItem('from_protected_page', 'chat');
        // Redirect to login page if not logged in
        window.location.href = 'login.html';
        return;
    }
    
    try {
        console.log('Validating token with API...');
        // Validate token
        const response = await fetch(`/api/users/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Invalid token');
        }
        
        // Get user data
        const userData = await response.json();
        console.log('User data retrieved:', userData);
        
        // Store user data
        currentUser = userData;
        
        // Check if user is admin
        isAdmin = userData.username === 'admin';
        
        // Update UI with user data
        updateUserInfo(userData);
        
        // Initialize WebSocket connection
        initWebSocket();
        
        // Load rooms
        loadRooms();
        
        // Check if we need to join a specific room from URL
        const roomId = getQueryParam('room');
        if (roomId) {
            joinRoom(roomId);
        }
        
    } catch (error) {
        console.error('Authentication error:', error);
        // Set flag for redirecting from protected page
        localStorage.setItem('from_protected_page', 'chat');
        // Redirect to login page
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    }
});

// Initialize WebSocket connection
function initWebSocket() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Update connection status
    updateConnectionStatus('connecting');
    
    // Create WebSocket connection
    wsConnection = createWebSocketConnection(
        token,
        handleWebSocketOpen,
        handleWebSocketMessage,
        handleWebSocketClose,
        handleWebSocketError
    );
}

// WebSocket event handlers
function handleWebSocketOpen(event) {
    console.log('WebSocket connection established');
    updateConnectionStatus('connected');
}

function handleWebSocketMessage(event) {
    console.log('Message from server:', event.data);
    try {
        const message = JSON.parse(event.data);
        
        // Handle different message types
        switch (message.type) {
            case 'chat_message':
                handleChatMessage(message.data);
                break;
            case 'whisper_message':
                handleWhisperMessage(message.data);
                break;
            case 'user_joined':
                handleUserJoined(message.data);
                break;
            case 'user_left':
                handleUserLeft(message.data);
                break;
            case 'typing_indicator':
                handleTypingIndicator(message.data);
                break;
            case 'room_update':
                handleRoomUpdate(message.data);
                break;
            case 'heartbeat_ack':
                // Heartbeat acknowledgment, nothing to do
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    } catch (error) {
        console.error('Error parsing WebSocket message:', error);
    }
}

function handleWebSocketClose(event) {
    console.log('WebSocket connection closed');
    updateConnectionStatus('disconnected');
    
    // Try to reconnect after a delay
    setTimeout(() => {
        if (currentUser) {
            console.log('Attempting to reconnect WebSocket...');
            initWebSocket();
        }
    }, 5000);
}

function handleWebSocketError(error) {
    console.error('WebSocket error:', error);
    updateConnectionStatus('disconnected');
}

// Update connection status indicator
function updateConnectionStatus(status) {
    const statusIndicator = document.getElementById('connection-status');
    const statusText = document.getElementById('connection-text');
    
    statusIndicator.className = `connection-status ${status}`;
    
    switch (status) {
        case 'connected':
            statusText.textContent = 'Connected';
            break;
        case 'disconnected':
            statusText.textContent = 'Disconnected';
            break;
        case 'connecting':
            statusText.textContent = 'Connecting...';
            break;
    }
}

// Handle chat message from WebSocket
function handleChatMessage(messageData) {
    // Only process if we're in the correct room
    if (currentRoom && messageData.roomId === currentRoom.id) {
        addMessageToChat(messageData);
    }
}

// Handle whisper message from WebSocket
function handleWhisperMessage(messageData) {
    // Check if whisper is from/to current user
    if (messageData.fromUser.id === currentUser.id || messageData.toUser.id === currentUser.id) {
        // Get the other user (the one who is not the current user)
        const otherUser = messageData.fromUser.id === currentUser.id ? messageData.toUser : messageData.fromUser;
        
        // Check if whisper window is already open
        const whisperWindow = document.getElementById('whisper-window');
        const isCurrentWhisper = whisperWindow.style.display === 'block' && 
                               whisperWindow.getAttribute('data-user-id') === otherUser.id;
        
        if (!isCurrentWhisper) {
            // Store message in active whispers for later
            if (!activeWhispers[otherUser.id]) {
                activeWhispers[otherUser.id] = [];
            }
            activeWhispers[otherUser.id].push(messageData);
            
            // Notify user of new whisper if not already viewing it
            // Show a notification sound or visual indicator
            const notification = new Audio('/audio/notification.mp3');
            notification.play().catch(e => console.log('Unable to play notification sound'));
            
            // Add a visual indicator to the user in the members list
            const memberItem = document.querySelector(`.member-item[data-id="${otherUser.id}"]`);
            if (memberItem) {
                memberItem.classList.add('has-notification');
            }
            
            console.log(`New whisper from ${otherUser.username}`);
        } else {
            // Add message to whisper window
            addMessageToWhisper(messageData);
        }
    }
}

// Handle user joined notification
function handleUserJoined(userData) {
    // Only process if we're in the correct room
    if (currentRoom && userData.roomId === currentRoom.id) {
        // Check if user is already in the members list
        const existingMember = document.querySelector(`.member-item[data-id="${userData.user.id}"]`);
        if (!existingMember) {
            // Add user to members list
            const membersContainer = document.getElementById('members-container');
            const memberItem = createMemberItem(userData.user);
            membersContainer.appendChild(memberItem);
            
            // Update members count
            updateMembersCount();
            
            // Add system message to chat
            const systemMessage = {
                id: Date.now().toString(),
                text: `${userData.user.username} has joined the room.`,
                isSystem: true,
                timestamp: new Date().toISOString()
            };
            addSystemMessageToChat(systemMessage);
        }
    }
}

// Handle user left notification
function handleUserLeft(userData) {
    // Only process if we're in the correct room
    if (currentRoom && userData.roomId === currentRoom.id) {
        // Remove user from members list
        const memberItem = document.querySelector(`.member-item[data-id="${userData.user.id}"]`);
        if (memberItem) {
            memberItem.remove();
            
            // Update members count
            updateMembersCount();
            
            // Add system message to chat
            const systemMessage = {
                id: Date.now().toString(),
                text: `${userData.user.username} has left the room.`,
                isSystem: true,
                timestamp: new Date().toISOString()
            };
            addSystemMessageToChat(systemMessage);
            
            // If there was an open whisper with this user, add a system message
            if (activeWhispers[userData.user.id]) {
                const whisperWindow = document.getElementById('whisper-window');
                const isCurrentWhisper = whisperWindow.style.display === 'block' && 
                                      whisperWindow.getAttribute('data-user-id') === userData.user.id;
                
                if (isCurrentWhisper) {
                    const whisperMessage = document.createElement('div');
                    whisperMessage.className = 'whisper-system-message';
                    whisperMessage.textContent = `${userData.user.username} has left the room.`;
                    
                    const whisperMessages = document.getElementById('whisper-messages');
                    whisperMessages.appendChild(whisperMessage);
                    
                    // Scroll to bottom
                    whisperMessages.scrollTop = whisperMessages.scrollHeight;
                }
            }
        }
    }
}

// Handle typing indicator
function handleTypingIndicator(data) {
    // Only process if we're in the correct room
    if (currentRoom && data.roomId === currentRoom.id && data.userId !== currentUser.id) {
        const typingIndicator = document.getElementById('typing-indicator');
        
        if (data.isTyping) {
            // Show typing indicator with username
            typingIndicator.textContent = `${data.username} is typing...`;
            typingIndicator.style.display = 'block';
            
            // Hide after a timeout if no more typing updates
            clearTimeout(window.typingTimeout);
            window.typingTimeout = setTimeout(() => {
                typingIndicator.style.display = 'none';
            }, 3000);
        } else {
            // Hide typing indicator
            typingIndicator.style.display = 'none';
        }
    }
}

// Handle room update
function handleRoomUpdate(roomData) {
    // Update current room if we're in it
    if (currentRoom && roomData.id === currentRoom.id) {
        currentRoom = roomData;
        
        // Update room info in UI
        document.getElementById('current-room-name').textContent = roomData.name;
        document.getElementById('current-room-topic').textContent = roomData.topic;
    }
    
    // Update room card if available
    const roomCard = document.querySelector(`.room-card[data-id="${roomData.id}"]`);
    if (roomCard) {
        const nameEl = roomCard.querySelector('.room-card-name');
        const topicEl = roomCard.querySelector('.room-card-topic');
        
        if (nameEl) nameEl.textContent = roomData.name;
        if (topicEl) topicEl.textContent = roomData.topic;
    }
}

// Initialize sidebar resizer
function initSidebarResizer() {
    const sidebar = document.getElementById('sidebar');
    const resizer = document.getElementById('sidebar-resizer');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    
    let isResizing = false;
    let lastX = 0;
    
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        lastX = e.clientX;
        document.body.style.cursor = 'ew-resize';
        
        // Add event listeners for mouse movement and release
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        // Prevent text selection during resize
        e.preventDefault();
    });
    
    function handleMouseMove(e) {
        if (!isResizing) return;
        
        const deltaX = e.clientX - lastX;
        const newWidth = Math.max(80, Math.min(500, sidebar.offsetWidth + deltaX));
        
        sidebar.style.width = newWidth + 'px';
        lastX = e.clientX;
    }
    
    function handleMouseUp() {
        isResizing = false;
        document.body.style.cursor = 'default';
        
        // Remove event listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }
    
    // Toggle sidebar collapse
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar-collapsed');
        
        // Update toggle button icon
        if (sidebar.classList.contains('sidebar-collapsed')) {
            sidebarToggle.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            `;
        } else {
            sidebarToggle.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            `;
        }
    });
}

// Initialize movable whisper window
function initMovableWhisper() {
    const whisperWindow = document.getElementById('whisper-window');
    const whisperHeader = document.getElementById('whisper-header');
    
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;
    
    whisperHeader.addEventListener('mousedown', (e) => {
        isDragging = true;
        
        // Calculate offset from the whisper window top-left corner
        const rect = whisperWindow.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        // Set initial cursor and prevent text selection
        whisperWindow.style.cursor = 'move';
        e.preventDefault();
        
        // Add event listeners for mouse movement and release
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });
    
    function handleMouseMove(e) {
        if (!isDragging) return;
        
        // Calculate new position ensuring the window stays within viewport
        const newLeft = Math.max(0, Math.min(window.innerWidth - whisperWindow.offsetWidth, e.clientX - offsetX));
        const newTop = Math.max(0, Math.min(window.innerHeight - whisperWindow.offsetHeight, e.clientY - offsetY));
        
        // Update position using absolute positioning
        whisperWindow.style.position = 'fixed';
        whisperWindow.style.left = newLeft + 'px';
        whisperWindow.style.top = newTop + 'px';
        whisperWindow.style.right = 'auto';
        whisperWindow.style.bottom = 'auto';
    }
    
    function handleMouseUp() {
        isDragging = false;
        whisperWindow.style.cursor = 'default';
        
        // Remove event listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }
}

// Update user info in the UI
function updateUserInfo(user) {
    console.log('Updating user info in UI');
    // Save user data
    localStorage.setItem('user', JSON.stringify(user));
    
    // Update sidebar
    const userAvatarSidebar = document.getElementById('user-avatar-sidebar');
    const userNameSidebar = document.getElementById('user-name-sidebar');
    
    if (userAvatarSidebar) {
        userAvatarSidebar.textContent = getUserInitials(user.username);
        if (user.avatarColor) {
            userAvatarSidebar.style.background = user.avatarColor;
        }
    }
    
    if (userNameSidebar) {
        userNameSidebar.textContent = user.username;
    }
    
    // Update connection status
    updateConnectionStatus('connecting');
}

// Update members count
function updateMembersCount() {
    const membersContainer = document.getElementById('members-container');
    if (!membersContainer) return;
    
    const count = membersContainer.querySelectorAll('.member-item').length;
    const membersCount = document.getElementById('members-count');
    if (membersCount) {
        membersCount.textContent = count;
    }
}

// Load rooms from API
async function loadRooms() {
    try {
        console.log('Loading rooms from API...');
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/rooms/public`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch rooms');
        }
        
        const rooms = await response.json();
        console.log('Rooms loaded:', rooms);
        displayRooms(rooms);
        
    } catch (error) {
        console.error('Error loading rooms:', error);
        showAlert('error', 'Failed to load chat rooms. Please try again later.');
    }
}

// Display rooms in the UI
function displayRooms(rooms) {
    console.log('Displaying rooms in UI');
    const roomsGrid = document.getElementById('rooms-grid');
    if (!roomsGrid) return;
    
    roomsGrid.innerHTML = '';
    
    if (rooms.length === 0) {
        roomsGrid.innerHTML = '<p class="empty-state">No rooms found. Create one to get started!</p>';
        return;
    }
    
    rooms.forEach(room => {
        const roomCard = document.createElement('div');
        roomCard.className = 'room-card';
        roomCard.setAttribute('data-id', room.id);
        
        roomCard.innerHTML = `
            <div class="room-card-header">
                <div class="room-card-name">${room.name}</div>
                <div class="room-card-badge">AI-Powered</div>
            </div>
            <div class="room-card-topic">${room.topic}</div>
            <div class="room-card-footer">
                <div>${room.totalUsers} members</div>
                <div>${room.isPublic ? 'Public' : 'Private'}</div>
            </div>
        `;
        
        roomCard.addEventListener('click', () => joinRoom(room.id));
        roomsGrid.appendChild(roomCard);
    });
}

// Join a room
async function joinRoom(roomId) {
    console.log('Joining room:', roomId);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/rooms/${roomId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to join room');
        }
        
        const room = await response.json();
        console.log('Room data:', room);
        
        // Store current room
        currentRoom = room;
        
        // Update UI to show chat window
        document.getElementById('rooms-section').style.display = 'none';
        document.getElementById('chat-window').style.display = 'flex';
        
        // Update room info
        document.getElementById('current-room-name').textContent = room.name;
        document.getElementById('current-room-topic').textContent = room.topic;
        
        // Store current room ID
        localStorage.setItem('currentRoomId', roomId);
        
        // Update URL without reloading the page
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('room', roomId);
        window.history.pushState({}, '', newUrl);
        
        // Send join room message to WebSocket
        if (wsConnection) {
            wsConnection.send('join_room', { roomId });
        }
        
        // Check if current user is owner
        isOwner = room.members && room.members.length > 0 && room.members[0] === currentUser.username;
        
        // Check if current user is host (would be determined by role in a real app)
        isHost = room.hosts && room.hosts.includes(currentUser.username);
        
        // Load room members
        loadRoomMembers(room);
        
        // Load messages
        loadMessages(roomId);
        
    } catch (error) {
        console.error('Error joining room:', error);
        showAlert('error', 'Failed to join room. Please try again.');
    }
}

// Load room members
function loadRoomMembers(room) {
    console.log('Loading room members');
    
    // Get real members from the room data
    const roomMembers = [];
    
    // Add AI assistant (always present)
    roomMembers.push({ 
        id: 'ai-assistant', 
        username: 'AI Assistant', 
        role: 'ai',
        isOnline: true
    });
    
    // Add room members with proper roles
    if (room.members && room.members.length > 0) {
        // First member is the owner
        const ownerUsername = room.members[0];
        
        room.members.forEach((memberUsername, index) => {
            // Skip if already added
            if (memberUsername === 'AI Assistant') return;
            
            // Find the actual user object if available
            let memberObj = { 
                id: `member-${memberUsername}`,
                username: memberUsername,
                role: index === 0 ? 'owner' : 'user',
                isOnline: true // In a real app, we'd get this from user data
            };
            
            // If current user is an admin, update role
            if (memberUsername === currentUser.username && isAdmin) {
                memberObj.role = 'admin';
            }
            
            // If user is a host, update role
            if (room.hosts && room.hosts.includes(memberUsername)) {
                memberObj.role = 'host';
            }
            
            roomMembers.push(memberObj);
        });
    }
    
    // Add current user if not already in the list
    if (currentUser && !roomMembers.some(m => m.username === currentUser.username)) {
        roomMembers.push({
            id: currentUser.id,
            username: currentUser.username,
            role: 'user',
            isOnline: true
        });
    }
    
    // Sort members: AI first, then by role importance, then alphabetically
    roomMembers.sort((a, b) => {
        // AI always comes first
        if (a.role === 'ai') return -1;
        if (b.role === 'ai') return 1;
        
        // Then sort by role importance
        const roleOrder = { admin: 1, owner: 2, host: 3, user: 4 };
        const roleCompare = roleOrder[a.role] - roleOrder[b.role];
        if (roleCompare !== 0) return roleCompare;
        
        // Finally sort alphabetically
        return a.username.localeCompare(b.username);
    });
    
    // Clear existing members
    const membersContainer = document.getElementById('members-container');
    if (!membersContainer) return;
    
    membersContainer.innerHTML = '';
    
    // Add all members
    roomMembers.forEach(member => {
        const memberItem = createMemberItem(member);
        membersContainer.appendChild(memberItem);
    });
    
    // Update members count
    updateMembersCount();
    
    // Populate member selection in settings
    populateMemberSelections(roomMembers);
}

// Populate member selection dropdowns
function populateMemberSelections(members) {
    const transferSelect = document.getElementById('transfer-ownership');
    const promoteSelect = document.getElementById('promote-host');
    
    if (!transferSelect || !promoteSelect) return;
    
    // Clear existing options
    transferSelect.innerHTML = '<option value="">Select a user...</option>';
    promoteSelect.innerHTML = '<option value="">Select a user...</option>';
    
    // Add regular members to the selection (not AI, admin, or owner)
    members.forEach(member => {
        if (member.role !== 'ai' && member.role !== 'admin' && member.role !== 'owner') {
            // For ownership transfer
            const transferOption = document.createElement('option');
            transferOption.value = member.id;
            transferOption.textContent = member.username;
            transferSelect.appendChild(transferOption);
            
            // For host promotion (if not already a host)
            if (member.role !== 'host') {
                const promoteOption = document.createElement('option');
                promoteOption.value = member.id;
                promoteOption.textContent = member.username;
                promoteSelect.appendChild(promoteOption);
            }
        }
    });
    
    // Show/hide owner actions based on user role
    const ownerActions = document.getElementById('owner-actions');
    if (ownerActions) {
        ownerActions.style.display = (isOwner || isAdmin) ? 'block' : 'none';
    }
}

// Create member item element
function createMemberItem(member) {
    const memberItem = document.createElement('div');
    memberItem.className = 'member-item';
    memberItem.setAttribute('data-id', member.id);
    memberItem.setAttribute('data-username', member.username);
    memberItem.setAttribute('data-role', member.role);
    
    // Add online status class
    if (member.isOnline) {
        memberItem.classList.add('online');
    }
    
    // Generate initials or use role icon for avatar
    let avatarContent = getUserInitials(member.username);
    let avatarStyle = '';
    
    if (member.role === 'ai') {
        avatarContent = '🤖';
        avatarStyle = 'background: linear-gradient(135deg, var(--accent-green), #10b981);';
    } else if (member.avatarColor) {
        avatarStyle = `background: ${member.avatarColor};`;
    }
    
    // Get role icon
    const roleIcon = ROLE_ICONS[member.role] || '';
    
    memberItem.innerHTML = `
        <div class="member-avatar" style="${avatarStyle}">${avatarContent}</div>
        <div class="member-info">
            <div class="member-name">
                ${roleIcon ? `<span class="role-icon role-${member.role}">${roleIcon}</span>` : ''}
                ${member.username}
            </div>
        </div>
    `;
    
    // Add context menu event listener
    memberItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showUserContextMenu(e, member);
    });
    
    // Regular click to show user profile or info
    memberItem.addEventListener('click', () => {
        // Open whisper if it's not the current user or AI
        if (member.id !== currentUser.id && member.role !== 'ai') {
            openWhisperWindow(member);
        } else if (member.role !== 'ai') {
            // In a real app, this would show the user's profile
            window.location.href = '/profile';
        }
    });
    
    return memberItem;
}

// Show user context menu
function showUserContextMenu(event, user) {
    event.preventDefault();
    
    selectedUser = user;
    
    // Position the context menu
    const contextMenu = document.getElementById('user-context-menu');
    if (!contextMenu) return;
    
    contextMenu.style.top = `${event.pageY}px`;
    contextMenu.style.left = `${event.pageX}px`;
    contextMenu.style.display = 'block';
    
    // Show/hide options based on roles
    const userOptions = document.querySelectorAll('.user-option');
    const hostOptions = document.querySelectorAll('.host-option');
    const ownerOptions = document.querySelectorAll('.owner-option');
    const adminOptions = document.querySelectorAll('.admin-option');
    
    // All users can see user options
    userOptions.forEach(option => {
        option.style.display = 'flex';
    });
    
    // Hosts and above can see host options
    hostOptions.forEach(option => {
        option.style.display = (isHost || isOwner || isAdmin) ? 'flex' : 'none';
    });
    
    // Only owners and admins can see owner options
    ownerOptions.forEach(option => {
        option.style.display = (isOwner || isAdmin) ? 'flex' : 'none';
    });
    
    // Only admins can see admin options
    adminOptions.forEach(option => {
        option.style.display = isAdmin ? 'flex' : 'none';
    });
    
    // Customize menu items based on user role
    if (user.role === 'ai') {
        // Hide options that don't apply to AI
        document.getElementById('context-whisper').style.display = 'none';
        document.getElementById('context-mute').style.display = 'none';
        document.getElementById('context-block').style.display = 'none';
        
        // No actions can be taken against AI
        hostOptions.forEach(option => option.style.display = 'none');
        ownerOptions.forEach(option => option.style.display = 'none');
        adminOptions.forEach(option => option.style.display = 'none');
    } else if (user.role === 'admin') {
        // Admins can't be moderated by anyone
        hostOptions.forEach(option => option.style.display = 'none');
        ownerOptions.forEach(option => option.style.display = 'none');
        adminOptions.forEach(option => option.style.display = 'none');
    } else if (user.role === 'owner' && !isAdmin) {
        // Owners can't be moderated (except by admins)
        hostOptions.forEach(option => option.style.display = 'none');
        ownerOptions.forEach(option => option.style.display = 'none');
    }
    
    // Hide whisper option for self
    if (user.id === currentUser.id) {
        document.getElementById('context-whisper').style.display = 'none';
    }
    
    // Close menu when clicking outside
    document.addEventListener('click', closeContextMenu);
}

// Close context menu
function closeContextMenu() {
    const contextMenu = document.getElementById('user-context-menu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
    document.removeEventListener('click', closeContextMenu);
}

// Load messages for a room
async function loadMessages(roomId) {
    console.log('Loading messages for room:', roomId);
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/rooms/${roomId}/messages`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load messages');
        }
        
        const messages = await response.json();
        console.log('Messages loaded:', messages);
        displayMessages(messages);
        
    } catch (error) {
        console.error('Error loading messages:', error);
        
        // Clear messages container
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
        
        // Show welcome message
        const welcomeMessage = {
            id: 'welcome',
            text: `Welcome to ${currentRoom.name}! This conversation is just beginning.`,
            user: {
                id: 'ai-assistant',
                username: 'AI Assistant'
            },
            timestamp: new Date().toISOString()
        };
        
        addMessageToChat(welcomeMessage);
    }
}

// Display messages in the chat window
function displayMessages(messages) {
    console.log('Displaying messages in chat window');
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = '';
    
    if (!messages || messages.length === 0) {
        // Show welcome message if no messages
        const welcomeMessage = {
            id: 'welcome',
            text: `Welcome to ${currentRoom.name}! This conversation is just beginning.`,
            user: {
                id: 'ai-assistant',
                username: 'AI Assistant'
            },
            timestamp: new Date().toISOString()
        };
        
        addMessageToChat(welcomeMessage);
        return;
    }
    
    // Display all messages
    messages.forEach(message => {
        addMessageToChat(message);
    });
    
    // Scroll to the bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Add a message to the chat
function addMessageToChat(message) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const messageEl = document.createElement('div');
    
    // All messages have the same base class - no separate alignment
    messageEl.className = 'message';
    
    // Add additional class for AI
    if (message.user && message.user.id === 'ai-assistant') {
        messageEl.classList.add('ai');
    }
    
    // Add system message class
    if (message.isSystem) {
        messageEl.classList.add('system-message');
    }
    
    // Format time
    const timestamp = new Date(message.timestamp);
    const formattedTime = formatTime(timestamp);
    
    // Determine role icon
    let roleIcon = '';
    if (message.user) {
        if (message.user.id === 'ai-assistant') {
            roleIcon = `<span class="role-icon role-ai">${ROLE_ICONS.ai}</span>`;
        } else if (message.user.id === 'admin-1' || message.user.username === 'admin') {
            roleIcon = `<span class="role-icon role-admin">${ROLE_ICONS.admin}</span>`;
        } else if (message.user.isOwner || (currentRoom && currentRoom.members && currentRoom.members[0] === message.user.username)) {
            roleIcon = `<span class="role-icon role-owner">${ROLE_ICONS.owner}</span>`;
        } else if (message.user.isHost) {
            roleIcon = `<span class="role-icon role-host">${ROLE_ICONS.host}</span>`;
        }
    }
    
    // Determine avatar style
    let avatarStyle = '';
    if (message.user && message.user.avatarColor) {
        avatarStyle = `style="background: ${message.user.avatarColor};"`;
    } else if (message.user && message.user.id === 'ai-assistant') {
        avatarStyle = 'style="background: linear-gradient(135deg, var(--accent-green), #10b981);"';
    } else if (message.isSystem) {
        avatarStyle = 'style="background: linear-gradient(135deg, var(--accent-yellow), var(--accent-red));"';
    }
    
    // Get proper avatar text
    let avatarText = '';
    if (message.isSystem) {
        avatarText = 'SYS';
    } else if (message.user) {
        avatarText = getUserInitials(message.user.username);
    }
    
    // Generate message content
    if (message.isSystem) {
        messageEl.innerHTML = `
            <div class="message-avatar" ${avatarStyle}>${avatarText}</div>
            <div class="message-content">
                <div class="message-meta">
                    <span class="message-author">System</span>
                    <span class="message-time">${formattedTime}</span>
                </div>
                <div class="message-text">${message.text}</div>
            </div>
        `;
    } else {
        messageEl.innerHTML = `
            <div class="message-avatar" ${avatarStyle}>${avatarText}</div>
            <div class="message-content">
                <div class="message-meta">
                    <span class="message-author">${roleIcon}${message.user ? message.user.username : 'Unknown User'}</span>
                    <span class="message-time">${formattedTime}</span>
                </div>
                <div class="message-text">${message.text}</div>
            </div>
        `;
    }
    
    messagesContainer.appendChild(messageEl);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Add a system message to chat
function addSystemMessageToChat(message) {
    const systemMessage = {
        ...message,
        isSystem: true
    };
    
    addMessageToChat(systemMessage);
}

// Add message to whisper
function addMessageToWhisper(message) {
    const whisperMessages = document.getElementById('whisper-messages');
    if (!whisperMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'whisper-message';
    
    // Determine if message is from current user or the other user
    const isFromCurrentUser = message.fromUser.id === currentUser.id;
    const username = isFromCurrentUser ? 'You' : message.fromUser.username;
    const color = isFromCurrentUser ? 'var(--accent-blue)' : 'var(--accent-purple)';
    
    // Format time
    const timestamp = new Date(message.timestamp);
    const formattedTime = formatTime(timestamp);
    
    messageDiv.innerHTML = `
        <div class="whisper-message-header">
            <div class="whisper-message-author" style="color: ${color};">${username}</div>
            <div class="whisper-message-time">${formattedTime}</div>
        </div>
        <div class="whisper-message-text">${message.text}</div>
    `;
    
    whisperMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    whisperMessages.scrollTop = whisperMessages.scrollHeight;
}

// Send message
function sendMessage() {
    console.log('Sending message...');
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;
    
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    const roomId = currentRoom.id;
    
    // Clear input
    messageInput.value = '';
    
    // Reset typing indicator
    clearTimeout(typingTimeout);
    if (wsConnection) {
        wsConnection.send('typing_indicator', {
            roomId,
            isTyping: false
        });
    }
    
    // Send message via WebSocket
    if (wsConnection) {
        wsConnection.send('chat_message', {
            roomId,
            text: message
        });
    } else {
        console.error('WebSocket not connected, message not sent');
        showAlert('error', 'Not connected to chat server. Please try again.');
    }
}

// Open whisper window
function openWhisperWindow(user) {
    if (!user) return;
    
    const whisperWindow = document.getElementById('whisper-window');
    const whisperRecipient = document.getElementById('whisper-recipient');
    const whisperMessages = document.getElementById('whisper-messages');
    
    if (!whisperWindow || !whisperRecipient || !whisperMessages) return;
    
    // Set recipient
    whisperRecipient.textContent = user.username;
    
    // Clear previous messages
    whisperMessages.innerHTML = '';
    
    // Remove notification class from member item
    const memberItem = document.querySelector(`.member-item[data-id="${user.id}"]`);
    if (memberItem) {
        memberItem.classList.remove('has-notification');
    }
    
    // Load existing whispers if any
    if (activeWhispers[user.id] && activeWhispers[user.id].length > 0) {
        activeWhispers[user.id].forEach(message => {
            addMessageToWhisper(message);
        });
    } else {
        // Show welcome message
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'whisper-system-message';
        welcomeDiv.textContent = `Private conversation with ${user.username}`;
        whisperMessages.appendChild(welcomeDiv);
    }
    
    // Show the window
    whisperWindow.style.display = 'block';
    
    // Reset position if it was moved previously
    whisperWindow.style.bottom = '20px';
    whisperWindow.style.right = '20px';
    whisperWindow.style.left = 'auto';
    whisperWindow.style.top = 'auto';
    
    // Store active user
    whisperWindow.setAttribute('data-user-id', user.id);
    
    // Focus the input
    document.getElementById('whisper-input').focus();
}

// Send whisper message
function sendWhisperMessage() {
    const whisperInput = document.getElementById('whisper-input');
    if (!whisperInput) return;
    
    const message = whisperInput.value.trim();
    const whisperWindow = document.getElementById('whisper-window');
    
    if (!message || !whisperWindow) return;
    
    const userId = whisperWindow.getAttribute('data-user-id');
    if (!userId || !selectedUser) return;
    
    // Clear input
    whisperInput.value = '';
    
    // Send via WebSocket
    if (wsConnection) {
        wsConnection.send('whisper_message', {
            text: message,
            toUser: {
                id: userId,
                username: selectedUser.username
            }
        });
    } else {
        console.error('WebSocket not connected, whisper not sent');
        showAlert('error', 'Not connected to chat server. Please try again.');
    }
}

// Handle typing indicator
function setupTypingIndicator() {
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return;
    
    messageInput.addEventListener('input', () => {
        // Only send if in a room and connected
        if (!currentRoom || !wsConnection) return;
        
        // Send typing indicator
        wsConnection.send('typing_indicator', {
            roomId: currentRoom.id,
            isTyping: true
        });
        
        // Clear previous timer
        clearTimeout(typingTimeout);
        
        // Set timer to send stopped typing after 2 seconds of inactivity
        typingTimeout = setTimeout(() => {
            if (wsConnection) {
                wsConnection.send('typing_indicator', {
                    roomId: currentRoom.id,
                    isTyping: false
                });
            }
        }, 2000);
    });
}

// Leave room
function leaveRoom() {
    console.log('Leaving room');
    
    // Send leave room message to WebSocket
    if (wsConnection && currentRoom) {
        wsConnection.send('leave_room', {
            roomId: currentRoom.id
        });
    }
    
    // Hide chat window and show rooms section
    document.getElementById('rooms-section').style.display = 'block';
    document.getElementById('chat-window').style.display = 'none';
    
    // Clear current room ID
    localStorage.removeItem('currentRoomId');
    
    // Update URL without reloading the page
    const newUrl = new URL(window.location);
    newUrl.searchParams.delete('room');
    window.history.pushState({}, '', newUrl);
    
    // Reset state
    currentRoom = null;
    isOwner = false;
    isHost = false;
    
    // Clear members list
    const membersContainer = document.getElementById('members-container');
    if (membersContainer) {
        membersContainer.innerHTML = '';
    }
    
    // Update members count
    updateMembersCount();
}

// Show room settings
function showRoomSettings() {
    if (!currentRoom) return;
    
    console.log('Showing room settings for:', currentRoom);
    
    // Populate form with current settings
    document.getElementById('settings-room-name').value = currentRoom.name;
    document.getElementById('settings-room-topic').value = currentRoom.topic;
    document.getElementById('settings-room-description').value = currentRoom.description || '';
    document.getElementById('settings-room-tags').value = (currentRoom.tags || []).join(', ');
    document.getElementById('settings-room-public').checked = currentRoom.isPublic;
    
    // Show modal
    document.getElementById('room-settings-modal').style.display = 'flex';
    
    // Set active tab
    switchSettingsTab('general-tab');
}

// Switch settings tab
function switchSettingsTab(tabId) {
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Add active class to selected tab
    document.getElementById(tabId).classList.add('active');
    
    // Show selected tab content
    const contentId = tabId.replace('-tab', '-content');
    document.getElementById(contentId).classList.add('active');
}

// Create room
async function createRoom(event) {
    event.preventDefault();
    console.log('Creating new room...');
    
    const nameInput = document.getElementById('room-name');
    const topicInput = document.getElementById('room-topic');
    const descriptionInput = document.getElementById('room-description');
    const tagsInput = document.getElementById('room-tags');
    const isPublicInput = document.getElementById('room-public');
    
    if (!nameInput || !topicInput || !descriptionInput || !tagsInput || !isPublicInput) return;
    
    const name = nameInput.value.trim();
    const topic = topicInput.value.trim();
    const description = descriptionInput.value.trim();
    const tagsString = tagsInput.value.trim();
    const isPublic = isPublicInput.checked;
    
    // Validate inputs
    if (!name || !topic) {
        showAlert('warning', 'Room name and topic are required');
        return;
    }
    
    // Parse tags
    const tags = tagsString ? tagsString.split(',').map(tag => tag.trim()) : [];
    
    try {
        // Show loading indicator
        showLoading();
        
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/rooms`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                topic,
                description,
                tags,
                isPublic
            })
        });
        
        // Hide loading indicator
        hideLoading();
        
        if (!response.ok) {
            throw new Error('Failed to create room');
        }
        
        const newRoom = await response.json();
        console.log('Room created:', newRoom);
        
        // Close modal
        document.getElementById('create-room-modal').style.display = 'none';
        
        // Reset form
        event.target.reset();
        
        // Set current user as owner of the new room
        isOwner = true;
        
        // Reload rooms
        await loadRooms();
        
        // Join the new room
        joinRoom(newRoom.id);
        
    } catch (error) {
        // Hide loading indicator
        hideLoading();
        
        console.error('Error creating room:', error);
        showAlert('error', 'Failed to create room. Please try again.');
    }
}

// Initialize event listeners
function initEventListeners() {
    console.log('Setting up event listeners');
    
    // Message Actions
    const sendMessageBtn = document.getElementById('send-message-btn');
    if (sendMessageBtn) {
        sendMessageBtn.addEventListener('click', sendMessage);
    }
    
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Set up typing indicator
        setupTypingIndicator();
    }
    
    // Room Actions
    const leaveRoomBtn = document.getElementById('leave-room-btn');
    if (leaveRoomBtn) {
        leaveRoomBtn.addEventListener('click', leaveRoom);
    }
    
    const roomSettingsBtn = document.getElementById('room-settings-btn');
    if (roomSettingsBtn) {
        roomSettingsBtn.addEventListener('click', showRoomSettings);
    }
    
    const createRoomBtn = document.getElementById('create-room-btn');
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', () => {
            document.getElementById('create-room-modal').style.display = 'flex';
        });
    }
    
    const closeCreateModal = document.getElementById('close-create-modal');
    if (closeCreateModal) {
        closeCreateModal.addEventListener('click', () => {
            document.getElementById('create-room-modal').style.display = 'none';
        });
    }
    
    const createRoomForm = document.getElementById('create-room-form');
    if (createRoomForm) {
        createRoomForm.addEventListener('submit', createRoom);
    }
    
    // Settings Modal
    const closeSettingsModal = document.getElementById('close-settings-modal');
    if (closeSettingsModal) {
        closeSettingsModal.addEventListener('click', () => {
            document.getElementById('room-settings-modal').style.display = 'none';
        });
    }
    
    // Settings Tabs
    const generalTab = document.getElementById('general-tab');
    if (generalTab) {
        generalTab.addEventListener('click', () => switchSettingsTab('general-tab'));
    }
    
    const permissionsTab = document.getElementById('permissions-tab');
    if (permissionsTab) {
        permissionsTab.addEventListener('click', () => switchSettingsTab('permissions-tab'));
    }
    
    const membersTab = document.getElementById('members-tab');
    if (membersTab) {
        membersTab.addEventListener('click', () => switchSettingsTab('members-tab'));
    }
    
    const aiTab = document.getElementById('ai-tab');
    if (aiTab) {
        aiTab.addEventListener('click', () => switchSettingsTab('ai-tab'));
    }
    
    // Whisper Window
    const closeWhisper = document.getElementById('close-whisper');
    if (closeWhisper) {
        closeWhisper.addEventListener('click', () => {
            document.getElementById('whisper-window').style.display = 'none';
        });
    }
    
    const whisperSendBtn = document.getElementById('whisper-send-btn');
    if (whisperSendBtn) {
        whisperSendBtn.addEventListener('click', sendWhisperMessage);
    }
    
    const whisperInput = document.getElementById('whisper-input');
    if (whisperInput) {
        whisperInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendWhisperMessage();
            }
        });
    }
    
    // Logout Button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            console.log('Logging out...');
            
            try {
                // Show loading indicator
                showLoading();
                
                // Close WebSocket connection
                if (wsConnection) {
                    wsConnection.close();
                }
                
                // Call logout API
                const token = localStorage.getItem('token');
                await fetch(`/api/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                // Hide loading indicator
                hideLoading();
                
                // Clear local storage
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('currentRoomId');
                
                // Redirect to home page
                window.location.href = '/';
            } catch (error) {
                // Hide loading indicator
                hideLoading();
                
                console.error('Error logging out:', error);
                
                // Still clear local storage and redirect
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('currentRoomId');
                window.location.href = '/';
            }
        });
    }
    
    // Window close event - close WebSocket connection
    window.addEventListener('beforeunload', () => {
        if (wsConnection) {
            wsConnection.close();
        }
    });
    
    // Context menu items
    setupContextMenuItems();
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        const createRoomModal = document.getElementById('create-room-modal');
        const settingsModal = document.getElementById('room-settings-modal');
        
        if (e.target === createRoomModal) {
            createRoomModal.style.display = 'none';
        }
        
        if (e.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });
}

// Set up context menu items
function setupContextMenuItems() {
    // Context Menu Items
    const contextWhisper = document.getElementById('context-whisper');
    if (contextWhisper) {
        contextWhisper.addEventListener('click', () => {
            openWhisperWindow(selectedUser);
            closeContextMenu();
        });
    }
    
    const contextViewProfile = document.getElementById('context-view-profile');
    if (contextViewProfile) {
        contextViewProfile.addEventListener('click', () => {
            if (selectedUser) {
                // In a real app, this would navigate to the user's profile
                if (selectedUser.id === currentUser.id) {
                    window.location.href = '/profile';
                } else {
                    window.location.href = `/profile?id=${selectedUser.id}`;
                }
            }
            closeContextMenu();
        });
    }
    
    const contextMute = document.getElementById('context-mute');
    if (contextMute) {
        contextMute.addEventListener('click', async () => {
            if (selectedUser) {
                try {
                    showLoading();
                    
                    // Call API to mute the user for the current user only
                    const token = localStorage.getItem('token');
                    const response = await fetch(`/api/users/muted`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            userId: selectedUser.id
                        })
                    });
                    
                    hideLoading();
                    
                    if (response.ok) {
                        showAlert('success', `${selectedUser.username} has been muted`);
                        
                        // Add muted class to member item
                        const memberItem = document.querySelector(`.member-item[data-id="${selectedUser.id}"]`);
                        if (memberItem) {
                            memberItem.classList.add('muted');
                        }
                    } else {
                        const error = await response.json();
                        throw new Error(error.detail || 'Failed to mute user');
                    }
                } catch (error) {
                    hideLoading();
                    console.error('Error muting user:', error);
                    showAlert('error', error.message || 'Failed to mute user');
                }
            }
            closeContextMenu();
        });
    }
    
    const contextBlock = document.getElementById('context-block');
    if (contextBlock) {
        contextBlock.addEventListener('click', async () => {
            if (selectedUser) {
                try {
                    showLoading();
                    
                    // Call API to block the user
                    const token = localStorage.getItem('token');
                    const response = await fetch(`/api/users/blocked`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            userId: selectedUser.id
                        })
                    });
                    
                    hideLoading();
                    
                    if (response.ok) {
                        showAlert('success', `${selectedUser.username} has been blocked`);
                        
                        // Add blocked class and remove user from view
                        const memberItem = document.querySelector(`.member-item[data-id="${selectedUser.id}"]`);
                        if (memberItem) {
                            memberItem.classList.add('blocked');
                            memberItem.style.display = 'none';
                        }
                    } else {
                        const error = await response.json();
                        throw new Error(error.detail || 'Failed to block user');
                    }
                } catch (error) {
                    hideLoading();
                    console.error('Error blocking user:', error);
                    showAlert('error', error.message || 'Failed to block user');
                }
            }
            closeContextMenu();
        });
    }
    
    // Host/Owner Actions
    const contextKick = document.getElementById('context-kick');
    if (contextKick) {
        contextKick.addEventListener('click', async () => {
            if (selectedUser && currentRoom) {
                try {
                    showLoading();
                    
                    // Call API to kick the user from the room
                    const token = localStorage.getItem('token');
                    const response = await fetch(`/api/rooms/${currentRoom.id}/members/${selectedUser.id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    hideLoading();
                    
                    if (response.ok) {
                        showAlert('success', `${selectedUser.username} has been kicked from the room`);
                        
                        // Remove user from members list
                        const memberItem = document.querySelector(`.member-item[data-id="${selectedUser.id}"]`);
                        if (memberItem) {
                            memberItem.remove();
                            updateMembersCount();
                        }
                        
                        // Add system message
                        const systemMessage = {
                            id: Date.now().toString(),
                            text: `${selectedUser.username} has been kicked from the room.`,
                            isSystem: true,
                            timestamp: new Date().toISOString()
                        };
                        addSystemMessageToChat(systemMessage);
                    } else {
                        const error = await response.json();
                        throw new Error(error.detail || 'Failed to kick user from room');
                    }
                } catch (error) {
                    hideLoading();
                    console.error('Error kicking user from room:', error);
                    showAlert('error', error.message || 'Failed to kick user from room');
                }
            }
            closeContextMenu();
        });
    }
    
    const contextBan = document.getElementById('context-ban');
    if (contextBan) {
        contextBan.addEventListener('click', async () => {
            if (selectedUser && currentRoom) {
                try {
                    showLoading();
                    
                    // Call API to ban the user from the room
                    const token = localStorage.getItem('token');
                    const response = await fetch(`/api/rooms/${currentRoom.id}/bans`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            userId: selectedUser.id
                        })
                    });
                    
                    hideLoading();
                    
                    if (response.ok) {
                        showAlert('success', `${selectedUser.username} has been banned from the room`);
                        
                        // Remove user from members list
                        const memberItem = document.querySelector(`.member-item[data-id="${selectedUser.id}"]`);
                        if (memberItem) {
                            memberItem.remove();
                            updateMembersCount();
                        }
                        
                        // Add system message
                        const systemMessage = {
                            id: Date.now().toString(),
                            text: `${selectedUser.username} has been banned from the room.`,
                            isSystem: true,
                            timestamp: new Date().toISOString()
                        };
                        addSystemMessageToChat(systemMessage);
                    } else {
                        const error = await response.json();
                        throw new Error(error.detail || 'Failed to ban user from room');
                    }
                } catch (error) {
                    hideLoading();
                    console.error('Error banning user from room:', error);
                    showAlert('error', error.message || 'Failed to ban user from room');
                }
            }
            closeContextMenu();
        });
    }
    
    // Owner Actions
    const contextTransferOwnership = document.getElementById('context-transfer-ownership');
    if (contextTransferOwnership) {
        contextTransferOwnership.addEventListener('click', () => {
            if (selectedUser) {
                showRoomSettings();
                switchSettingsTab('members-tab');
                const transferSelect = document.getElementById('transfer-ownership');
                if (transferSelect) {
                    transferSelect.value = selectedUser.id;
                }
            }
            closeContextMenu();
        });
    }
    
    const contextPromoteHost = document.getElementById('context-promote-host');
    if (contextPromoteHost) {
        contextPromoteHost.addEventListener('click', async () => {
            if (selectedUser && currentRoom) {
                try {
                    showLoading();
                    
                    // Call API to promote user to host
                    const token = localStorage.getItem('token');
                    const response = await fetch(`/api/rooms/${currentRoom.id}/hosts`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            userId: selectedUser.id
                        })
                    });
                    
                    hideLoading();
                    
                    if (response.ok) {
                        showAlert('success', `${selectedUser.username} has been promoted to host`);
                        
                        // Update the member's role in the UI
                        const memberItem = document.querySelector(`.member-item[data-id="${selectedUser.id}"]`);
                        if (memberItem) {
                            memberItem.setAttribute('data-role', 'host');
                            
                            // Update the member name to include host icon
                            const memberName = memberItem.querySelector('.member-name');
                            if (memberName) {
                                memberName.innerHTML = `<span class="role-icon role-host">${ROLE_ICONS.host}</span> ${selectedUser.username}`;
                            }
                        }
                    } else {
                        const error = await response.json();
                        throw new Error(error.detail || 'Failed to promote user to host');
                    }
                } catch (error) {
                    hideLoading();
                    console.error('Error promoting user to host:', error);
                    showAlert('error', error.message || 'Failed to promote user to host');
                }
            }
            closeContextMenu();
        });
    }
    
    // Admin Actions
    const contextServerBan = document.getElementById('context-server-ban');
    if (contextServerBan) {
        contextServerBan.addEventListener('click', async () => {
            if (selectedUser) {
                try {
                    showLoading();
                    
                    // Call API to ban user from server
                    const token = localStorage.getItem('token');
                    const response = await fetch(`/api/admin/users/${selectedUser.id}/ban`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    hideLoading();
                    
                    if (response.ok) {
                        showAlert('success', `${selectedUser.username} has been banned from the server`);
                        
                        // Remove the member from the UI
                        const memberItem = document.querySelector(`.member-item[data-id="${selectedUser.id}"]`);
                        if (memberItem) {
                            memberItem.remove();
                            updateMembersCount();
                        }
                    } else {
                        const error = await response.json();
                        throw new Error(error.detail || 'Failed to ban user from server');
                    }
                } catch (error) {
                    hideLoading();
                    console.error('Error banning user from server:', error);
                    showAlert('error', error.message || 'Failed to ban user from server');
                }
            }
            closeContextMenu();
        });
    }
    
    const contextSilence = document.getElementById('context-silence');
    if (contextSilence) {
        contextSilence.addEventListener('click', async () => {
            if (selectedUser) {
                try {
                    showLoading();
                    
                    // Call API to silence user
                    const token = localStorage.getItem('token');
                    const response = await fetch(`/api/admin/users/${selectedUser.id}/silence`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            duration: 3600 // 1 hour in seconds
                        })
                    });
                    
                    hideLoading();
                    
                    if (response.ok) {
                        showAlert('success', `${selectedUser.username} has been silenced for 1 hour`);
                        
                        // Update the member in the UI
                        const memberItem = document.querySelector(`.member-item[data-id="${selectedUser.id}"]`);
                        if (memberItem) {
                            memberItem.classList.add('silenced');
                        }
                    } else {
                        const error = await response.json();
                        throw new Error(error.detail || 'Failed to silence user');
                    }
                } catch (error) {
                    hideLoading();
                    console.error('Error silencing user:', error);
                    showAlert('error', error.message || 'Failed to silence user');
                }
            }
            closeContextMenu();
        });
    }
    
    const contextRestrict = document.getElementById('context-restrict');
    if (contextRestrict) {
        contextRestrict.addEventListener('click', async () => {
            if (selectedUser) {
                try {
                    showLoading();
                    
                    // Call API to restrict user
                    const token = localStorage.getItem('token');
                    const response = await fetch(`/api/admin/users/${selectedUser.id}/restrict`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    hideLoading();
                    
                    if (response.ok) {
                        showAlert('success', `${selectedUser.username} has been restricted`);
                        
                        // Update the member in the UI
                        const memberItem = document.querySelector(`.member-item[data-id="${selectedUser.id}"]`);
                        if (memberItem) {
                            memberItem.classList.add('restricted');
                        }
                    } else {
                        const error = await response.json();
                        throw new Error(error.detail || 'Failed to restrict user');
                    }
                } catch (error) {
                    hideLoading();
                    console.error('Error restricting user:', error);
                    showAlert('error', error.message || 'Failed to restrict user');
                }
            }
            closeContextMenu();
        });
    }
}

// Get query parameter value
function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Show alert message
function showAlert(type, message) {
    // Create alerts container if it doesn't exist
    let alertsContainer = document.querySelector('.alerts-container');
    if (!alertsContainer) {
        alertsContainer = document.createElement('div');
        alertsContainer.className = 'alerts-container';
        document.body.appendChild(alertsContainer);
    }
    
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
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(overlay);
    }
    
    overlay.classList.add('visible');
}

// Hide loading overlay
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('visible');
    }
}

// Initialize event listeners after DOM is fully loaded
document.addEventListener('DOMContentLoaded', initEventListeners);

// #CommentComplete
