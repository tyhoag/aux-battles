const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ⚠️ Use a .env file before deploying publicly
const SPOTIFY_CLIENT_ID = '6445ab8b3d8247fb9f38380a072dc415';
const SPOTIFY_CLIENT_SECRET = '5f5b49fef82b42f598f528cce6b2a83a';

const PROMPTS = [
  'Play a song that reminds you of summer',
  'Play a song you blast in the shower',
  'Play a song with the best bass drop',
  'Play a song that hits different at 2am',
  'Play a song perfect for a road trip',
  'Play a song that makes you feel invincible',
  'Play a song for a bonfire night',
  'Play a song everyone secretly knows the words to',
  'Play the song that defined your middle school era',
  'Play a song that would get anyone on the dance floor',
  'Play a song you know every single word to',
  "Play a song that slaps but nobody's heard of it",
  "Play a song you'd dedicate to your best friend",
  'Play a song that makes you emotional',
  "Play a song you'd walk into a room to",
  'Play the song that defined your high school era',
  'Play a song with the best intro',
  'Play a song that changed your life',
  'Play a song to hype the team before a big game',
  'Play a song that would win a karaoke night',
  "Play a song you're embarrassed to love",
  'Play a song from before you were born that still slaps',
  'Play a song that always comes on at exactly the right moment',
  "Play a song that's perfect for crying in the car",
  'Play a song that makes you feel like the main character',
];

const rooms = {};
let spotifyToken = null;
let tokenExpiry = 0;

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < tokenExpiry) return spotifyToken;
  const creds = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Spotify auth failed: ' + JSON.stringify(data));
  spotifyToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return spotifyToken;
}

function makeCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function getJudge(room) {
  return room.players[room.judgeIndex % room.players.length];
}

function startRound(room) {
  const available = PROMPTS.filter(p => !room.usedPrompts.includes(p));
  if (!available.length) room.usedPrompts = [];
  const pool = available.length ? available : PROMPTS;
  const prompt = pool[Math.floor(Math.random() * pool.length)];
  room.usedPrompts.push(prompt);
  room.prompt = prompt;
  room.submissions = [];
  room.state = 'submitting';
  const judge = getJudge(room);
  io.to(room.code).emit('round_started', { prompt, judge, players: room.players, round: room.round });
}

app.use(express.static(path.join(__dirname)));

app.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ tracks: [] });
  try {
    const token = await getSpotifyToken();
    const r = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await r.json();
    const tracks = (data.tracks?.items || []).map(t => ({
      id: t.id,
      title: t.name,
      artist: t.artists.map(a => a.name).join(', '),
      image: t.album.images[2]?.url,
      url: t.external_urls.spotify,
    }));
    res.json({ tracks });
  } catch (e) {
    console.error('Search error:', e.message);
    res.status(500).json({ tracks: [], error: 'Search failed' });
  }
});

io.on('connection', socket => {
  console.log('[+]', socket.id);

  socket.on('create_room', ({ playerName }) => {
    let code;
    do { code = makeCode(); } while (rooms[code]);
    const player = { id: socket.id, name: playerName, score: 0, isHost: true };
    rooms[code] = { code, players: [player], state: 'lobby', prompt: null, submissions: [], judgeIndex: 0, usedPrompts: [], round: 0 };
    socket.join(code);
    socket.data = { roomCode: code };
    socket.emit('room_created', { code, player, room: rooms[code] });
  });

  socket.on('join_room', ({ roomCode, playerName }) => {
    const room = rooms[roomCode];
    if (!room) return socket.emit('error', { message: 'Room not found. Check the code.' });
    if (room.state !== 'lobby') return socket.emit('error', { message: 'Game already in progress.' });
    const player = { id: socket.id, name: playerName, score: 0, isHost: false };
    room.players.push(player);
    socket.join(roomCode);
    socket.data = { roomCode };
    socket.emit('room_joined', { player, room });
    socket.to(roomCode).emit('player_joined', { player, room });
  });

  socket.on('start_game', () => {
    const room = rooms[socket.data?.roomCode];
    if (!room) return;
    const me = room.players.find(p => p.id === socket.id);
    if (!me?.isHost) return;
    if (room.players.length < 3) return socket.emit('error', { message: 'Need at least 3 players to start.' });
    room.round = 1;
    room.state = 'playing';
    startRound(room);
  });

  socket.on('submit_song', ({ song }) => {
    const room = rooms[socket.data?.roomCode];
    if (!room || room.state !== 'submitting') return;
    const judge = getJudge(room);
    if (socket.id === judge.id) return;
    if (room.submissions.find(s => s.playerId === socket.id)) return;
    const playerName = room.players.find(p => p.id === socket.id)?.name;
    room.submissions.push({ playerId: socket.id, playerName, song });
    const submittable = room.players.filter(p => p.id !== judge.id);
    io.to(room.code).emit('submission_update', { count: room.submissions.length, total: submittable.length });
    if (room.submissions.length >= submittable.length) {
      room.state = 'playback';
      room.submissions = room.submissions.sort(() => Math.random() - 0.5);
      io.to(room.code).emit('playback_started', {
        submissions: room.submissions.map(s => ({ playerId: s.playerId, song: s.song })),
      });
    }
  });

  socket.on('start_voting', () => {
    const room = rooms[socket.data?.roomCode];
    if (!room || room.state !== 'playback') return;
    const me = room.players.find(p => p.id === socket.id);
    if (!me?.isHost) return;
    room.state = 'voting';
    const judge = getJudge(room);
    io.to(room.code).emit('voting_started', {
      submissions: room.submissions.map(s => ({ playerId: s.playerId, song: s.song })),
      judgeId: judge.id,
    });
  });

  socket.on('cast_vote', ({ playerId }) => {
    const room = rooms[socket.data?.roomCode];
    if (!room || room.state !== 'voting') return;
    const judge = getJudge(room);
    if (socket.id !== judge.id) return;
    const winner = room.players.find(p => p.id === playerId);
    if (winner) winner.score++;
    const winningSub = room.submissions.find(s => s.playerId === playerId);
    room.state = 'results';
    io.to(room.code).emit('round_results', {
      winnerId: playerId,
      winnerName: winner?.name,
      winningSong: winningSub?.song,
      players: room.players,
      submissions: room.submissions,
    });
  });

  socket.on('next_round', () => {
    const room = rooms[socket.data?.roomCode];
    if (!room) return;
    const me = room.players.find(p => p.id === socket.id);
    if (!me?.isHost) return;
    room.judgeIndex = (room.judgeIndex + 1) % room.players.length;
    room.round++;
    startRound(room);
  });

  socket.on('disconnect', () => {
    const { roomCode } = socket.data || {};
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];
    room.players = room.players.filter(p => p.id !== socket.id);
    console.log('[-]', socket.id);
    if (room.players.length === 0) {
      delete rooms[roomCode];
    } else {
      if (!room.players.some(p => p.isHost)) room.players[0].isHost = true;
      io.to(roomCode).emit('player_left', { room });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🎵 Aux Battle → http://localhost:${PORT}`));
