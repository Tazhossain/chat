import os
import gevent
from gevent import monkey
monkey.patch_all()
import redis
from flask import Flask, render_template, request, redirect, url_for, session
from flask_socketio import SocketIO, emit, join_room, leave_room
from datetime import timedelta, datetime
import telebot
import json
import time

# Environment Variables
SECRET_KEY = os.getenv('SECRET_KEY', 'your-default-secret-key')
REDIS_URL = os.getenv('REDIS_URL')
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')
PASSWORD = os.getenv('PASSWORD')
WEBHOOK_URL = os.getenv('WEBHOOK_URL')

# Flask Setup
app = Flask(__name__, template_folder='template')
app.secret_key = SECRET_KEY

# Redis Configuration
r = redis.Redis.from_url(REDIS_URL)
r.ping()

# Socket.IO Setup
socketio = SocketIO(app, message_queue=REDIS_URL, async_mode='gevent')

# Telegram bot setup
bot = telebot.TeleBot(TELEGRAM_BOT_TOKEN)

# Track nicknames
nicknames = {}
pending_leave_events = {}

@app.before_request
def make_session_permanent():
    session.permanent = True
    app.permanent_session_lifetime = timedelta(hours=1)

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        nickname = request.form.get('nickname', '').strip()
        password = request.form['password']
        if password == PASSWORD and nickname:
            session['nickname'] = nickname
            session['joined'] = False
            return redirect(url_for('chat'))
        return render_template('index.html', error="Incorrect password or nickname required.")
    return render_template('index.html')

@app.route('/chat')
def chat():
    if 'nickname' not in session:
        return redirect(url_for('index'))
    return render_template('chat.html', nickname=session['nickname'])

@app.route('/logout')
def logout():
    handle_disconnect(manual_logout=True)
    session.clear()
    return redirect(url_for('index'))

@socketio.on('message')
def handle_message(data):
    nickname = session.get('nickname')
    msg = data.get('msg', '')

    if msg.startswith("/nick "):
        new_nick = msg[6:].strip()
        old_nick = nickname
        nicknames.pop(old_nick, None)
        nicknames[new_nick] = new_nick
        session['nickname'] = new_nick  # Update session with new nickname
        update_users()
    elif msg == "/clear":
        r.delete('chat:room')
        emit('clear_chat', room='room')
    else:
        if not msg.startswith("/"):
            message = {
                'nickname': nickname,
                'msg': msg,
                'timestamp': get_timestamp()
            }
            r.rpush('chat:room', json.dumps(message))
            emit('message', message, room='room')
            if nickname != "Telegram":
                send_to_telegram(message)

@socketio.on('connect')
def connect(sid):
    nickname = session.get('nickname')
    if nickname:
        join_room('room')
        if not session.get('joined', False):
            session['joined'] = True
            nicknames[nickname] = nickname
            update_chat_history()
            socketio.emit('user_joined', {'nickname': nickname}, room='room')
            send_to_telegram({'nickname': nickname, 'msg': 'has joined the chat!'})
            update_users()
        else:
            update_chat_history()

@socketio.on('disconnect')
def disconnect():
    handle_disconnect()

def handle_disconnect(manual_logout=False):
    nickname = session.get('nickname')
    if nickname and session.get('joined'):
        if manual_logout:
            complete_disconnect(nickname)
        else:
            pending_leave_events[nickname] = time.time()
            socketio.start_background_task(wait_before_confirming_disconnect, nickname)

def wait_before_confirming_disconnect(nickname):
    gevent.sleep(30)
    if nickname in pending_leave_events and time.time() - pending_leave_events[nickname] >= 30:
        with app.app_context():  # Ensure we're within the app context
            complete_disconnect(nickname)
        pending_leave_events.pop(nickname, None)

def complete_disconnect(nickname):
    leave_room('room')
    socketio.emit('user_left', {'nickname': nickname}, room='room')
    send_to_telegram({'nickname': nickname, 'msg': 'has left the chat!'})
    nicknames.pop(nickname, None)
    session['joined'] = False
    update_users()

def send_to_telegram(message):
    telegram_message = f"{message['nickname']}: {message['msg']}"
    bot.send_message(TELEGRAM_CHAT_ID, telegram_message)

def update_users():
    users = [{'nickname': nick} for nick in nicknames.values()]
    emit('update_users', users, room='room')

def update_chat_history():
    messages = r.lrange('chat:room', 0, -1)
    parsed_messages = []
    for message in messages:
        try:
            parsed_messages.append(json.loads(message))
        except json.JSONDecodeError:
            print(f"Failed to decode message: {message}")
            continue  # Skip any messages that fail to parse
    emit('update_chat', parsed_messages, room='room')

def get_timestamp():
    return datetime.now().strftime('%I:%M %p')

@bot.message_handler(func=lambda message: True)
def receive_telegram_message(message):
    if message.chat.id == int(TELEGRAM_CHAT_ID):
        telegram_message = {
            'nickname': "Telegram",
            'msg': message.text,
            'timestamp': get_timestamp()
        }
        r.rpush('chat:room', json.dumps(telegram_message))
        socketio.emit('message', telegram_message, room='room')

if __name__ == '__main__':
    bot.remove_webhook()
    bot.set_webhook(url=f'{WEBHOOK_URL}/{TELEGRAM_BOT_TOKEN}')
    socketio.run(app, host='0.0.0.0', port=int(os.getenv('PORT', 5000)))
