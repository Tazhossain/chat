const socket = io();
const chatbox = document.getElementById('chatbox');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message');
let nightMode = false;
let notificationsEnabled = false;
let soundEnabled = false;

socket.on('message', function(data) {
    const div = document.createElement('div');
    div.textContent = data.msg;
    chatbox.appendChild(div);
    chatbox.scrollTop = chatbox.scrollHeight;

    if (notificationsEnabled) {
        new Notification('New message', { body: data.msg });
    }

    if (soundEnabled) {
        // Play notification sound
        const audio = new Audio('/static/sounds/notification.mp3');
        audio.play();
    }
});

socket.on('update_users', function(users) {
    // Update the user list (not shown in UI yet)
});

chatForm.addEventListener('submit', function(event) {
    event.preventDefault();
    const message = messageInput.value.trim();
    if (message !== '') {
        socket.send(message);
        messageInput.value = '';
    }
});

function toggleNightMode() {
    nightMode = !nightMode;
    document.body.classList.toggle('night-mode', nightMode);
}

function clearChat() {
    socket.emit('message', '/delete');
}

function toggleNotifications() {
    notificationsEnabled = !notificationsEnabled;
    if (notificationsEnabled && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
}

function toggleMenu() {
    const menu = document.getElementById('options-menu');
    menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
}

// Handle the clear chat command from the server
socket.on('clear_chat', function() {
    chatbox.innerHTML = '';
});

// Handle the update chat command to refresh chat history
socket.on('update_chat', function(messages) {
    chatbox.innerHTML = '';
    messages.forEach(function(message) {
        const div = document.createElement('div');
        div.textContent = `${message.nickname}: ${message.msg}`;
        chatbox.appendChild(div);
    });
    chatbox.scrollTop = chatbox.scrollHeight;
});
