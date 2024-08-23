const socket = io();
const chatbox = document.getElementById('chatbox');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message');
const notificationSound = new Audio('/static/sounds/notification.mp3');
let nightMode = false;
let notificationsEnabled = false;
let soundEnabled = false;

// Append message to chatbox with timestamp
function appendMessage(data) {
    const div = document.createElement('div');
    div.textContent = `[${data.timestamp}] ${data.msg}`;
    chatbox.appendChild(div);
    chatbox.scrollTop = chatbox.scrollHeight;
}

socket.on('message', function(data) {
    appendMessage(data);

    if (notificationsEnabled && Notification.permission === 'granted') {
        new Notification('New message', {
            body: data.msg,
            timestamp: data.timestamp
        });
    }

    if (soundEnabled) {
        notificationSound.play();
    }
});

socket.on('update_users', function(users) {
    const userList = document.getElementById('user-list');
    userList.innerHTML = '';
    users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.textContent = user.nickname;
        userList.appendChild(userDiv);
    });
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
    if (!notificationsEnabled && Notification.permission !== 'granted') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                notificationsEnabled = true;
                alert('Notifications enabled.');
            }
        });
    } else {
        notificationsEnabled = !notificationsEnabled;
        alert(`Notifications ${notificationsEnabled ? 'enabled' : 'disabled'}.`);
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    alert(`Sound ${soundEnabled ? 'enabled' : 'disabled'}.`);
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
        appendMessage(message);
    });
});
