// Import required modules
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Environment variables
const PORT = process.env.PORT || 8001;
const JWT_SECRET = process.env.JWT_SECRET || 'jermaneranson2025';

// Enhanced CORS middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// In-memory data storage (in production, use a database)
const users = [];
const rooms = [
  {
    id: '1',
    name: 'AI Research Lounge',
    topic: 'Discussing Future of Artificial Intelligence',
    description: 'A deep dive into the cutting-edge advancements in artificial intelligence.',
    tags: ['Technology', 'AI Research'],
    isPublic: true,
    members: ['admin'],
    messages: [],
    totalUsers: 15
  },
  {
    id: '2',
    name: 'Tech Innovations',
    topic: 'Exploring Cutting-Edge Technologies',
    description: 'Discussions about the latest technological advancements and innovations.',
    tags: ['Technology', 'Innovation'],
    isPublic: true,
    members: ['admin'],
    messages: [],
    totalUsers: 12
  },
  {
    id: '3',
    name: 'Machine Learning Hub',
    topic: 'Deep Dive into ML Algorithms',
    description: 'An interactive learning space for machine learning enthusiasts.',
    tags: ['Data Science', 'Learning'],
    isPublic: true,
    members: ['admin'],
    messages: [],
    totalUsers: 10
  }
];

// WebSocket server
const wss = new WebSocket.Server({ noServer: true });

// Map to store user connections
const clients = new Map();

// Helper function for authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ detail: 'Unauthorized' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ detail: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// WebSocket authentication
const authenticateWsToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

// Basic route for API health check
app.get('/api', (req, res) => {
  res.json({ message: 'AI Chat Network API is running' });
});

// User registration
app.post('/api/users', async (req, res) => {
  try {
    console.log('Registration attempt received:', req.body);
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      console.log('Missing required fields');
      return res.status(400).json({ detail: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = users.find(user => user.email === email || user.username === username);
    if (existingUser) {
      console.log('User already exists');
      return res.status(400).json({ detail: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = {
      id: uuidv4(),
      username,
      email,
      password: hashedPassword,
      bio: '',
      avatarColor: getRandomColor(),
      createdAt: new Date().toISOString(),
      isOnline: false
    };

    users.push(newUser);
    console.log('User registered successfully:', newUser.username);
    
    return res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ detail: 'Server error' });
  }
});

// User login
app.post('/api/token', async (req, res) => {
  try {
    console.log('Login attempt received:', req.body);
    const { username, password } = req.body;
    
    // Find user
    const user = users.find(u => u.username === username || u.email === username);
    if (!user) {
      console.log('User not found');
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log('Invalid password');
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    // Update user status
    user.isOnline = true;

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Login successful for user:', user.username);
    return res.status(200).json({
      access_token: token,
      token_type: 'bearer',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        bio: user.bio || '',
        avatarColor: user.avatarColor,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ detail: 'Server error' });
  }
});

// Get all public rooms
app.get('/api/rooms/public', authenticateToken, (req, res) => {
  const publicRooms = rooms.filter(room => room.isPublic).map(room => {
    // Don't send messages in the room list for efficiency
    const { messages, ...roomWithoutMessages } = room;
    return roomWithoutMessages;
  });
  return res.status(200).json(publicRooms);
});

// Get a specific room by ID
app.get('/api/rooms/:id', authenticateToken, (req, res) => {
  const room = rooms.find(r => r.id === req.params.id);
  if (!room) {
    return res.status(404).json({ detail: 'Room not found' });
  }
  
  // Don't send all messages for efficiency, just the last 50
  const recentMessages = room.messages.slice(-50);
  
  return res.status(200).json({
    ...room,
    messages: recentMessages
  });
});

// Create a new room
app.post('/api/rooms', authenticateToken, (req, res) => {
  try {
    const { name, topic, description, isPublic = true, tags = [] } = req.body;
    
    // Validate input
    if (!name || !topic) {
      return res.status(400).json({ detail: 'Name and topic are required' });
    }
    
    // Create new room
    const newRoom = {
      id: uuidv4(),
      name,
      topic,
      description: description || '',
      tags,
      isPublic,
      members: [req.user.username],
      messages: [],
      createdAt: new Date().toISOString(),
      createdBy: req.user.username,
      totalUsers: 1
    };
    
    rooms.push(newRoom);
    console.log('Room created:', newRoom.name);
    
    // Broadcast to all clients that a new room was created
    broadcastToAll({
      type: 'room_created',
      data: {
        id: newRoom.id,
        name: newRoom.name,
        topic: newRoom.topic,
        createdBy: newRoom.createdBy,
        totalUsers: newRoom.totalUsers
      }
    });
    
    return res.status(201).json(newRoom);
  } catch (error) {
    console.error('Create room error:', error);
    return res.status(500).json({ detail: 'Server error' });
  }
});

// Get room messages
app.get('/api/rooms/:id/messages', authenticateToken, (req, res) => {
  const room = rooms.find(r => r.id === req.params.id);
  if (!room) {
    return res.status(404).json({ detail: 'Room not found' });
  }
  
  // Get optional query param for limiting messages
  const limit = parseInt(req.query.limit) || 50;
  const messages = room.messages.slice(-limit);
  
  return res.status(200).json(messages);
});

// Get current user
app.get('/api/users/me', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ detail: 'User not found' });
  }
  
  // Return user info without password
  const { password, ...userInfo } = user;
  return res.status(200).json(userInfo);
});

// Update user profile
app.put('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const { username, email, bio, avatarColor } = req.body;
    
    // Find user
    const userIndex = users.findIndex(u => u.id === req.user.id);
    if (userIndex === -1) {
      return res.status(404).json({ detail: 'User not found' });
    }
    
    // Check if username or email already exists (if changed)
    if ((username && username !== users[userIndex].username) || 
        (email && email !== users[userIndex].email)) {
      const existingUser = users.find(u => 
        (username && u.username === username || email && u.email === email) && u.id !== req.user.id
      );
      
      if (existingUser) {
        return res.status(400).json({ detail: 'Username or email already in use' });
      }
    }
    
    // Update user
    users[userIndex] = {
      ...users[userIndex],
      username: username || users[userIndex].username,
      email: email || users[userIndex].email,
      bio: bio !== undefined ? bio : users[userIndex].bio,
      avatarColor: avatarColor || users[userIndex].avatarColor
    };
    
    // Broadcast user update to connected clients
    broadcastToAll({
      type: 'user_updated',
      data: {
        id: users[userIndex].id,
        username: users[userIndex].username,
        bio: users[userIndex].bio,
        avatarColor: users[userIndex].avatarColor
      }
    });
    
    // Return updated user without password
    const { password, ...userInfo } = users[userIndex];
    return res.status(200).json(userInfo);
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ detail: 'Server error' });
  }
});

// User logout
app.post('/api/logout', authenticateToken, (req, res) => {
  const userIndex = users.findIndex(u => u.id === req.user.id);
  if (userIndex !== -1) {
    users[userIndex].isOnline = false;
  }
  
  return res.status(200).json({ message: 'Logged out successfully' });
});

// Get user profile by ID
app.get('/api/users/:id', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.params.id || u.username === req.params.id);
  if (!user) {
    return res.status(404).json({ detail: 'User not found' });
  }
  
  // Return user info without sensitive data
  const { password, email, ...publicUserInfo } = user;
  return res.status(200).json(publicUserInfo);
});

// Handle WebSocket connections
wss.on('connection', (ws, userData) => {
  console.log(`User connected: ${userData.username} (${userData.id})`);
  
  // Store client connection
  clients.set(userData.id, ws);
  
  // Update user online status
  const userIndex = users.findIndex(u => u.id === userData.id);
  if (userIndex !== -1) {
    users[userIndex].isOnline = true;
  }
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection_success',
    data: {
      message: 'Successfully connected to WebSocket server'
    }
  }));
  
  // Handle messages from clients
  ws.on('message', async (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      
      switch (parsedMessage.type) {
        case 'join_room':
          handleJoinRoom(userData, parsedMessage.data);
          break;
        case 'leave_room':
          handleLeaveRoom(userData, parsedMessage.data);
          break;
        case 'chat_message':
          handleChatMessage(userData, parsedMessage.data);
          break;
        case 'whisper_message':
          handleWhisperMessage(userData, parsedMessage.data);
          break;
        case 'typing_indicator':
          handleTypingIndicator(userData, parsedMessage.data);
          break;
        case 'heartbeat':
          // Client is still active
          ws.send(JSON.stringify({ type: 'heartbeat_ack' }));
          break;
        default:
          console.log('Unknown message type:', parsedMessage.type);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    console.log(`User disconnected: ${userData.username} (${userData.id})`);
    
    // Remove client from connected clients
    clients.delete(userData.id);
    
    // Update user online status
    const userIndex = users.findIndex(u => u.id === userData.id);
    if (userIndex !== -1) {
      users[userIndex].isOnline = false;
    }
    
    // Notify all rooms where the user was a member
    rooms.forEach(room => {
      if (room.members.includes(userData.username)) {
        broadcastToRoom(room.id, {
          type: 'user_left',
          data: {
            roomId: room.id,
            user: {
              id: userData.id,
              username: userData.username
            },
            timestamp: new Date().toISOString()
          }
        });
      }
    });
  });
});

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  // Parse URL query parameters
  const url = new URL(request.url, `http://${request.headers.host}`);
  const token = url.searchParams.get('token');
  
  // Authenticate token
  const userData = authenticateWsToken(token);
  if (!userData) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  
  // Upgrade connection
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, userData);
  });
});

// WebSocket message handlers
function handleJoinRoom(userData, data) {
  const { roomId } = data;
  
  // Find room
  const roomIndex = rooms.findIndex(r => r.id === roomId);
  if (roomIndex === -1) return;
  
  // Check if user is already a member
  if (!rooms[roomIndex].members.includes(userData.username)) {
    rooms[roomIndex].members.push(userData.username);
    rooms[roomIndex].totalUsers += 1;
  }
  
  // Broadcast to all users in the room
  broadcastToRoom(roomId, {
    type: 'user_joined',
    data: {
      roomId,
      user: {
        id: userData.id,
        username: userData.username
      },
      timestamp: new Date().toISOString()
    }
  });
  
  // Add system message to room
  const systemMessage = {
    id: uuidv4(),
    text: `${userData.username} has joined the room.`,
    isSystem: true,
    timestamp: new Date().toISOString()
  };
  
  rooms[roomIndex].messages.push(systemMessage);
  
  // Broadcast system message
  broadcastToRoom(roomId, {
    type: 'chat_message',
    data: {
      ...systemMessage,
      roomId
    }
  });
  
  // Send welcome message from AI assistant
  setTimeout(() => {
    const aiMessage = {
      id: uuidv4(),
      text: `Welcome to the room, ${userData.username}! Feel free to join the conversation.`,
      user: {
        id: 'ai-assistant',
        username: 'AI Assistant'
      },
      roomId,
      timestamp: new Date().toISOString()
    };
    
    rooms[roomIndex].messages.push(aiMessage);
    
    broadcastToRoom(roomId, {
      type: 'chat_message',
      data: aiMessage
    });
  }, 1000);
}

function handleLeaveRoom(userData, data) {
  const { roomId } = data;
  
  // Find room
  const roomIndex = rooms.findIndex(r => r.id === roomId);
  if (roomIndex === -1) return;
  
  // Remove user from members
  const memberIndex = rooms[roomIndex].members.indexOf(userData.username);
  if (memberIndex !== -1) {
    rooms[roomIndex].members.splice(memberIndex, 1);
    rooms[roomIndex].totalUsers -= 1;
    
    // Add system message to room
    const systemMessage = {
      id: uuidv4(),
      text: `${userData.username} has left the room.`,
      isSystem: true,
      timestamp: new Date().toISOString()
    };
    
    rooms[roomIndex].messages.push(systemMessage);
    
    // Broadcast to all users in the room
    broadcastToRoom(roomId, {
      type: 'user_left',
      data: {
        roomId,
        user: {
          id: userData.id,
          username: userData.username
        },
        timestamp: new Date().toISOString()
      }
    });
    
    // Broadcast system message
    broadcastToRoom(roomId, {
      type: 'chat_message',
      data: {
        ...systemMessage,
        roomId
      }
    });
  }
}

function handleChatMessage(userData, data) {
  const { roomId, text } = data;
  
  // Find room
  const roomIndex = rooms.findIndex(r => r.id === roomId);
  if (roomIndex === -1) return;
  
  // Create message
  const message = {
    id: uuidv4(),
    text,
    user: {
      id: userData.id,
      username: userData.username
    },
    roomId,
    timestamp: new Date().toISOString()
  };
  
  // Add message to room
  rooms[roomIndex].messages.push(message);
  
  // Broadcast to all users in the room
  broadcastToRoom(roomId, {
    type: 'chat_message',
    data: message
  });
  
  // Generate AI response if message contains trigger words
  const lowerCaseText = text.toLowerCase();
  if (
    lowerCaseText.includes('ai') || 
    lowerCaseText.includes('help') || 
    lowerCaseText.includes('?') ||
    lowerCaseText.includes('hello') ||
    lowerCaseText.includes('hi')
  ) {
    setTimeout(() => {
      const aiResponse = generateAIResponse(text);
      
      const aiMessage = {
        id: uuidv4(),
        text: aiResponse,
        user: {
          id: 'ai-assistant',
          username: 'AI Assistant'
        },
        roomId,
        timestamp: new Date().toISOString()
      };
      
      rooms[roomIndex].messages.push(aiMessage);
      
      broadcastToRoom(roomId, {
        type: 'chat_message',
        data: aiMessage
      });
    }, Math.random() * 2000 + 1000); // Random delay between 1-3 seconds
  }
}

function handleWhisperMessage(userData, data) {
  const { text, toUser } = data;
  
  // Create whisper message
  const whisperMessage = {
    id: uuidv4(),
    text,
    fromUser: {
      id: userData.id,
      username: userData.username
    },
    toUser,
    timestamp: new Date().toISOString()
  };
  
  // Send to recipient
  const recipientWs = clients.get(toUser.id);
  if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
    recipientWs.send(JSON.stringify({
      type: 'whisper_message',
      data: whisperMessage
    }));
  }
  
  // Send confirmation to sender
  const senderWs = clients.get(userData.id);
  if (senderWs && senderWs.readyState === WebSocket.OPEN) {
    senderWs.send(JSON.stringify({
      type: 'whisper_message',
      data: whisperMessage
    }));
  }
}

function handleTypingIndicator(userData, data) {
  const { roomId, isTyping } = data;
  
  // Broadcast typing indicator to room
  broadcastToRoom(roomId, {
    type: 'typing_indicator',
    data: {
      roomId,
      userId: userData.id,
      username: userData.username,
      isTyping
    }
  });
}

// Helper function to broadcast messages to a specific room
function broadcastToRoom(roomId, message) {
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;
  
  room.members.forEach(memberUsername => {
    const member = users.find(u => u.username === memberUsername);
    if (member) {
      const ws = clients.get(member.id);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    }
  });
}

// Helper function to broadcast to all connected clients
function broadcastToAll(message) {
  clients.forEach((ws, userId) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}

// Helper function to generate AI responses
function generateAIResponse(message) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return "Hello! How can I assist you today?";
  } else if (lowerMessage.includes('help')) {
    return "I'm here to help! What would you like to know about?";
  } else if (lowerMessage.includes('how are you')) {
    return "I'm just a bot, but I'm functioning well! How about you?";
  } else if (lowerMessage.includes('what is your name')) {
    return "I'm an AI assistant created to help you. What would you like to talk about?";
  } else if (lowerMessage.includes('what can you do')) {
    return "I can answer questions, provide information, and chat with you. Ask me anything!";
  } else if (lowerMessage.includes('who created you')) {
    return "I was developed to assist users in this chat network! My knowledge comes from various sources.";
  } else if (lowerMessage.includes('what is ai') || lowerMessage.includes('artificial intelligence')) {
    return "Artificial Intelligence is a field of computer science that enables machines to simulate human intelligence. Would you like to learn more about it?";
  } else if (lowerMessage.includes('machine learning')) {
    return "Machine Learning is a branch of AI that focuses on developing systems that can learn from and make predictions based on data.";
  } else if (lowerMessage.includes('what is the meaning of life')) {
    return "That's a deep question! Some say it's happiness, others say it's about making an impact. What do you think?";
  } else if (lowerMessage.includes('tell me a joke')) {
    return "Why don't skeletons fight each other? Because they don't have the guts!";
  } else if (lowerMessage.includes('what time is it')) {
    return "I'm not connected to a clock, but you can check the time on your device!";
  } else if (lowerMessage.includes('where are you from')) {
    return "I exist in the digital world, wherever you need me!";
  } else if (lowerMessage.includes('what is your favorite color')) {
    return "I don't have eyes, but I've heard blue is quite popular!";
  } else if (lowerMessage.includes('tell me a fun fact')) {
    return "Did you know that octopuses have three hearts?";
  } else if (lowerMessage.includes('thank')) {
    return "You're welcome! Let me know if you need anything else.";
  } else if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
    return "Goodbye! Have a great day!";
  } else if (lowerMessage.includes('?')) {
    return "That's an interesting question. Let me think about it and get back to you.";
  } else {
    return "That's an interesting point. Could you elaborate more on what you're looking for?";
  }
}

// Helper function to generate random colors for user avatars
function getRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 50%)`;
}

// Seed an admin user if none exists
const seedAdminUser = async () => {
  const adminExists = users.find(user => user.username === 'admin');
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    users.push({
      id: uuidv4(),
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      bio: 'System Administrator',
      avatarColor: 'hsl(260, 70%, 50%)',
      createdAt: new Date().toISOString(),
      isOnline: false
    });
    console.log('Admin user created');
  }
};

// Frontend route handling - serve the appropriate HTML file for each route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/register.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/profile.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/chat-room.html'));
});

// Catch-all route to handle client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start the server
server.listen(PORT, async () => {
  await seedAdminUser();
  console.log(`Server running on port ${PORT}`);
});

module.exports = server;

// #CommentComplete
