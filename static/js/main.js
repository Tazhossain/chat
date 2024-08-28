const socket = io();
const chatbox = document.getElementById('chatbox');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message');
let nightMode = false;
let notificationsEnabled = false;
let soundEnabled = false;

// Function to format time to 12-hour format
function formatTime(date) {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return `${hours}:${minutes < 10 ? '0' : ''}${minutes} ${ampm}`;
}

// Function to add a message to the chatbox with a timestamp
function addMessage(message) {
    const div = document.createElement('div');
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.innerText = formatTime(new Date(message.timestamp));

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

    if (notificationsEnabled && data.nickname !== sessionStorage.getItem('nickname')) {
        new Notification('New message', { body: data.msg });
    }

    if (soundEnabled && data.nickname !== sessionStorage.getItem('nickname')) {
        const audio = document.getElementById('notification-sound');
        audio.play();
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

// Handle the disconnect event
socket.on('user_left', function(data) {
    const div = document.createElement('div');
    div.textContent = `${data.nickname} has left the chat.`;
    chatbox.appendChild(div);
    chatbox.scrollTop = chatbox.scrollHeight;
});
