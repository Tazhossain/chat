const socket = io();
const chatbox = document.getElementById('chatbox');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message');
const notificationSound = document.getElementById('notification-sound');
const joinedSound = document.getElementById('joined-sound');
const leavedSound = document.getElementById('leaved-sound');

let nightMode = false;
let notificationsEnabled = false;  // Disabled by default
let soundEnabled = false;  // Disabled by default
const nickname = document.querySelector('body').dataset.nickname; // Use nickname from session

function formatTime(date) {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // '0' hours should be '12'
    return `${hours}:${minutes} ${ampm}`;
}

function addMessage(message) {
    const div = document.createElement('div');
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.innerText = message.timestamp;

    const messageContent = document.createElement('div');
    messageContent.innerHTML = `<strong>${message.nickname}</strong>: ${message.msg}`;

    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper';
    messageWrapper.appendChild(messageContent);
    messageWrapper.appendChild(timestamp);

    chatbox.appendChild(messageWrapper);
    chatbox.scrollTop = chatbox.scrollHeight;
}

socket.on('message', function(data) {
    addMessage(data);

    // Play sound only for received messages from others
    if (soundEnabled && data.nickname !== nickname) {
        notificationSound.play();
    }
});

socket.on('user_joined', function(data) {
    addMessage({ nickname: data.nickname, msg: `has joined the chat.`, timestamp: formatTime(new Date()) });
    if (soundEnabled) {
        joinedSound.play();
    }
});

socket.on('user_left', function(data) {
    addMessage({ nickname: data.nickname, msg: `has left the chat.`, timestamp: formatTime(new Date()) });
    if (soundEnabled) {
        leavedSound.play();
    }
});

socket.on('update_users', function(users) {
    const userList = document.getElementById('user-list');
    userList.innerHTML = users.map(user => `
        <div>
            <span style="color: green;">●</span> ${user.nickname}
        </div>
    `).join('');
});

socket.on('update_chat', function(messages) {
    chatbox.innerHTML = '';
    messages.forEach(addMessage);
});

chatForm.addEventListener('submit', function(event) {
    event.preventDefault();
    const message = messageInput.value.trim();
    if (message !== '') {
        socket.emit('message', { nickname: nickname, msg: message });
        messageInput.value = '';
    }
});

function toggleNightMode() {
    nightMode = !nightMode;
    document.body.classList.toggle('night-mode', nightMode);
}

function clearChat() {
    socket.emit('message', { nickname: nickname, msg: '/clear' });
}

function toggleNotifications() {
    notificationsEnabled = !notificationsEnabled;
    if (notificationsEnabled && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
    alert(notificationsEnabled ? 'Notifications enabled' : 'Notifications disabled');
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    alert(soundEnabled ? 'Sound enabled' : 'Sound disabled');
}

function toggleMenu() {
    const menu = document.getElementById('options-menu');
    menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
}

// Handle the clear chat command from the server
socket.on('clear_chat', function() {
    chatbox.innerHTML = '';
});
