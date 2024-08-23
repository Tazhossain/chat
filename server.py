import os
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask import Flask, render_template, request, redirect, url_for, session

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'
socketio = SocketIO(app)

PASSWORD = "123"
rooms = {'room': []}
nicknames = {}

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        password = request.form['password']
        nickname = request.form.get('nickname', '').strip()
        if password == PASSWORD and nickname:
            session['nickname'] = nickname
            nicknames[nickname] = nickname
            return redirect(url_for('chat'))
        else:
            return render_template('index.html', error="Incorrect password or nickname required.")
    return render_template('index.html')

@app.route('/chat')
def chat():
    if 'nickname' not in session:
        return redirect(url_for('index'))
    return render_template('chat.html', nickname=session['nickname'])

@socketio.on('message')
def handle_message(msg):
    nickname = session.get('nickname')
    if msg.startswith("/nick "):
        new_nick = msg[6:].strip()
        old_nick = nickname
        nicknames.pop(old_nick, None)
        nicknames[new_nick] = new_nick
        session['nickname'] = new_nick
        emit('message', {'msg': f'{old_nick} changed their name to {new_nick}', 'type': 'system'}, room='room')
        update_users()
    elif msg == "/delete":
        rooms['room'] = []
        emit('clear_chat', room='room')
    else:
        rooms['room'].append({'nickname': nickname, 'msg': msg, 'timestamp': get_timestamp()})
        emit('message', {'msg': f'{nickname}: {msg}', 'type': 'user', 'timestamp': get_timestamp()}, room='room')

@socketio.on('delete_message')
def delete_message(index):
    if 0 <= index < len(rooms['room']):
        rooms['room'].pop(index)
        emit('update_chat', rooms['room'], broadcast=True)

@socketio.on('connect')
def connect():
    nickname = session.get('nickname')
    if nickname:
        join_room('room')
        emit('message', {'msg': f'{nickname} has joined the chat!', 'type': 'system'}, room='room')
        update_users()

@socketio.on('disconnect')
def disconnect():
    nickname = session.get('nickname')
    if nickname:
        leave_room('room')
        nicknames.pop(nickname, None)
        emit('message', {'msg': f'{nickname} has left the chat.', 'type': 'system'}, room='room')
        update_users()

def update_users():
    users = [{'nickname': nick, 'active': True} for nick in nicknames.values()]
    emit('update_users', users, broadcast=True)

def get_timestamp():
    from datetime import datetime
    return datetime.now().strftime('%H:%M:%S')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port)
