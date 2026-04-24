require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const PROMPTS = [
  'Your instant reaction to the words "dance party."',
  'The song with the best piano riff of all time.',
  'A song that makes you think of a rodeo.',
  'If you were leading an army into battle, what song would be playing?',
  'The song that makes you want to drive 100 mph.',
  'Your go-to song for hitting a PR at the gym.',
  'Your biggest guilty pleasure song.',
  'A song everyone skips but you always turn up.',
  'A song that reminds you of your dad.',
  'Your ultimate vacation song.',
  'The song that played at every elementary school field day.',
  'A song that reminds you of a crush.',
  'The song that takes you back to your first kiss.',
  'Your late-night drive song.',
  'A song that feels like it belongs in a movie trailer.',
  'Your favorite Disney song.',
  'Your "let me put you on" song — the underground gem only you know.',
  'A song that instantly puts you in a good mood.',
  'Your perfect chill Sunday morning song.',
  'A song that feels like winter.',
  'A song that takes you straight back to childhood.',
  'Your walkout song if you were a professional fighter.',
  "A song you'd blast on the world's biggest speakers.",
  'If you were a DJ at a massive party, what song gets everyone going?',
  'A song that makes you want to run through a wall.',
  'A song that goes absolutely crazy in the car.',
  'Your perfect up-the-canyon song.',
  'A song that makes you feel like a winner.',
  'A song that never, ever gets old.',
  'Your go-to song while chilling at the beach.',
  "A song you'd be embarrassed to have in your Recently Played.",
  'A song that would be hilariously inappropriate at a funeral.',
  'The worst song you could play on a first date.',
  'A song your parents would actually love.',
  'A song your parents would absolutely hate.',
  'The most random song in your entire library.',
  'A song you secretly know every single word to.',
  'A song so bad it would clear the entire room.',
  'Your ultimate breakup song.',
  'A song that makes you stop and think about life.',
  "A song that's timeless and ages like fine wine.",
  'A song that perfectly describes your life right now.',
  "A song you'd send to someone you're into.",
  'Your cry-in-the-shower song.',
  'Your full-concert-in-the-shower song.',
  'A song you never, ever skip.',
  "The song playing over the intro of your life's movie.",
  'Your perfect road trip song.',
  "A song you'd use in a hype edit or montage.",
  "The song you'd play at your wedding.",
  'The one song that best represents your personality.',
  "The first song you'd play to show someone your music taste.",
  'A song that defines your entire generation.',
  'If you were in a high-speed chase with the cops, what song is playing?',
  'The song you need playing while skydiving.',
  'Your soundtrack for escaping a burning building.',
  'A song to play right before jumping off a cliff.',
  'Your entrance song to a rap battle.',
  'The first song you play after winning the lottery.',
  'Your perfect slow dance song.',
  'Your wedding entrance song.',
  'The first song you play after your car breaks down.',
  'Your go-to stuck-in-traffic song.',
  'The song you always play while cooking.',
  'Your theme song if you were a superhero.',
  'Your theme song if you were a villain plotting world domination.',
  "The song you're listening to while time traveling.",
  'The best video game song of all time.',
  'The song playing the moment you discover hidden treasure.',
  'Your soundtrack for exploring a haunted mansion.',
  'Your go-to song for the most relaxed, hazy night possible.',
  'The song keeping you sane while surviving alone in the jungle.',
  "The last song you'd ever want to hear before you die.",
  'Your pregame hype song.',
  'The song playing right after you hit the game-winning shot.',
  'The song playing as you embarrassingly trip in public.',
  'The song you put on right after your crush rejects you.',
  'Your soundtrack for when your best friend betrays you.',
  'The song you play after getting absolutely roasted.',
  'Your go-to heartbreak song.',
  'Your go-to study song.',
  'Your most relaxing song of all time.',
  'The theme song from your favorite childhood TV show.',
  "The perfect end-credits song for your life.",
  'The song that brings out your alter ego.',
  'The one song that best represents your friend group.',
  'The song you want to be remembered by.',
  'The song that gets you through a brutal 12-hour shift.',
  'A song that takes you straight back to high school.',
  'A song that takes you straight back to college.',
  'A song that takes you back to being at a live sporting event.',
  "The song that's guaranteed to win you this round.",
  'A song that works in literally any situation.',
  'A song that everyone and their mom knows every word to.',
  'The song that gets the biggest reaction in any crowd.',
  'A song you will defend no matter what anyone says.',
  'A song that makes you feel genuinely grateful for nature.',
  'A song with an unforgettable goofy intro.',
  'A song with a whistle in it.',
  'The song playing when the pizza rolls come out of the oven.',
  'Your perfect rainy day song.',
  'A song that makes you feel like you\'re already on vacation.',
  'You open the hotel curtains to a perfect sunrise. What song plays?',
  'Your walk-away-from-an-explosion song.',
  'Your training montage song for taking down your biggest rival.',
  "The song playing over the post-credits scene of your life's movie.",
  'The song playing as you stare out the car window on a rainy day.',
  'A song that would make you walk out on a first date.',
  'The absolute worst song you could play at a funeral.',
  'An annoyingly catchy song you know every single word to.',
  'A song that takes you back to junior high.',
  'The song playing during that painfully awkward middle school slow dance.',
  'The song you had on repeat right after getting your driver\'s license.',
  'The song that played at every single birthday party when you were 10.',
  "A song that makes you feel like you're floating in outer space.",
  'Your late-night, empty-highway song.',
  'A song that makes you feel rich even when you\'re completely broke.',
  'The entrance song for your professional wrestler persona.',
  'The perfect haunted house soundtrack.',
  'Your go-to Halloween song.',
  'The most annoyingly overplayed Christmas song of all time.',
  'The best Christmas song ever made.',
  'Your favorite hymn or worship song.',
  'A song that screams "congratulations" without ever saying the word.',
  'The cops just showed up to shut down the party. What\'s the last song?',
  'A song that somehow sounds even better through a cheap Bluetooth speaker.',
  'The song that most reminds you of your hometown.',
  'That one song every person at the party knows every word to.',
  'A song with an animal in the title.',
  'A song with the most earth-shaking, absurd bass drop.',
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
