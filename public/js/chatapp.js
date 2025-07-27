async function fetchUsername(userId) {
  try {
    const response = await fetch(`/api/users/${userId}`);
    if (response.ok) {
      const data = await response.json();
      return data.username;
    } else {
      console.error('Failed to fetch username');
      return 'Anonymous';
    }
  } catch (error) {
    console.error('Error fetching username:', error);
    return 'Anonymous';
  }
}
const USER=require('../models/schema.js');
function getCookie(name) {
  const cookies = document.cookie.split('; ');
  for (let cookie of cookies) {
    const [key, value] = cookie.split('=');
    if (key === name) {
      return decodeURIComponent(value); // Decode the cookie value
    }
  }
  return null; // Return null if the cookie is not found
}
const socket = io(); // Connect to server

const id = getCookie("user"); 
const username=User.findbyid(id);

const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

// Send message to server
sendButton.addEventListener('click', () => {
  if(username==NULL){
    alert("Please login to send messages.");
    window.location.href="/login";
    return;
  }
  const message = messageInput.value.trim();
  if (message !== '') {
    const msgData = { user: username, message };
    socket.emit('chatMessage', msgData);

    messageInput.value = '';
  }
});

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendButton.click();
  }
});

// Receive message from server
socket.on('chatMessage', (msgData) => {
  // If the message is from the current user, style as 'sent', otherwise 'received'
  const type = (msgData.user === username) ? 'sent' : 'received';
  addMessage(msgData, type);
});

// Add message to chat box
function addMessage({ user, message }, type) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', type);
  messageElement.innerHTML = ` 
    <div class="username">YOU</div>
    <p>${escapeHTML(message)}</p>
  `;
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
