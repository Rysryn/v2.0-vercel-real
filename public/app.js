// UPDATE THESE TWO VARIABLES WITH YOUR SPOTIFY APP CREDENTIALS
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const redirectUri = 'http://localhost:8000'; // Update this to your redirect URI

// TIMING CONTROLS
const NEXT_SONG_POPUP_TIME = 5000; // Time in milliseconds before the end of the song to show the next song popup
const PAUSE_TIMEOUT = 10000; // Time in milliseconds after which to show the placeholder if the song is paused

let accessToken = null;
let refreshToken = null;
let expirationTime = null;
let lastPlaybackState = null;
let pauseStartTime = null;

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';
const QUEUE_URL = 'https://api.spotify.com/v1/me/player/queue';

let wallpapers = [];
let currentWallpaperIndex = 0;
let wallpaperInterval;
let isPlaceholderActive = false;

function checkAuth() {
    accessToken = localStorage.getItem('spotify_access_token');
    refreshToken = localStorage.getItem('spotify_refresh_token');
    expirationTime = localStorage.getItem('spotify_expiration_time');

    if (accessToken && refreshToken && expirationTime) {
        if (Date.now() > parseInt(expirationTime)) {
            refreshAccessToken();
        } else {
            startApp();
        }
    } else {
        authorize();
    }
}

function authorize() {
    const scope = 'user-read-currently-playing user-read-playback-state';
    window.location.href = `${AUTHORIZE_URL}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
}

async function getAccessToken(code) {
    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET)
        },
        body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`
    });

    const data = await response.json();
    accessToken = data.access_token;
    refreshToken = data.refresh_token;
    expirationTime = Date.now() + data.expires_in * 1000;

    localStorage.setItem('spotify_access_token', accessToken);
    localStorage.setItem('spotify_refresh_token', refreshToken);
    localStorage.setItem('spotify_expiration_time', expirationTime);

    startApp();
}

async function refreshAccessToken() {
    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET)
        },
        body: `grant_type=refresh_token&refresh_token=${refreshToken}`
    });

    const data = await response.json();
    accessToken = data.access_token;
    expirationTime = Date.now() + data.expires_in * 1000;

    localStorage.setItem('spotify_access_token', accessToken);
    localStorage.setItem('spotify_expiration_time', expirationTime);

    startApp();
}

let playlistCache = {};

async function getNowPlayingAndQueue() {
    const [nowPlayingResponse, queueResponse] = await Promise.all([
        fetch(NOW_PLAYING_URL, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        }),
        fetch(QUEUE_URL, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })
    ]);

    if (nowPlayingResponse.status === 204) {
        // No song is currently playing
        updateUI(null, null);
        return;
    }

    const nowPlayingData = await nowPlayingResponse.json();
    const queueData = await queueResponse.json();

    updateUI(nowPlayingData, queueData);
}

async function loadWallpapers() {
    try {
        const response = await fetch('/wallpapers');
        const data = await response.json();
        wallpapers = data.wallpapers;
        console.log(wallpapers);
    } catch (error) {
        console.error('Error loading wallpapers:', error);
    }
}

function cycleWallpaper() {
    if (wallpapers.length === 0) return;
    
    currentWallpaperIndex = (currentWallpaperIndex + 1) % wallpapers.length;
    const wallpaper = wallpapers[currentWallpaperIndex];
    
    const albumArt = document.getElementById('album-art');
    albumArt.src = wallpaper.imagePath;

    console.log(wallpaper.imagePath);
    
    // Update clock color and font based on wallpaper settings
    const clock = document.getElementById('clock');
    document.documentElement.style.setProperty('--clock-colour-when-full', wallpaper.clockColor);
}

function updateUI(nowPlayingData, queueData) {
    const nowPlaying = document.getElementById('now-playing');
    const albumArt = document.getElementById('album-art');
    const songName = document.getElementById('song-name');
    const artistName = document.getElementById('artist-name');
    const albumName = document.getElementById('album-name');
    const playlistName = document.getElementById('playlist-name');
    const playlistArt = document.getElementById('playlist-art');
    const progressBar = document.getElementById('progress');
    const currentTime = document.getElementById('current-time');
    const totalTime = document.getElementById('total-time');
    const clock = document.getElementById('clock');
    const mainApp = document.getElementById('app');
    const clockContainer = document.getElementById('clock');

    // Update clock
    updateClock();

    if (nowPlayingData && nowPlayingData.item) {
        if (nowPlayingData.is_playing) {
            if (isPlaceholderActive) {
                // Song has started playing, stop wallpaper cycling
                clearInterval(wallpaperInterval);
                isPlaceholderActive = false;
            }

            nowPlaying.classList.remove('placeholder');
            albumArt.src = nowPlayingData.item.album.images[0].url;
            songName.textContent = nowPlayingData.item.name;
            artistName.textContent = nowPlayingData.item.artists.map(artist => artist.name).join(', ');
            albumName.textContent = nowPlayingData.item.album.name;
            mainApp.classList.remove('full');
            clockContainer.classList.remove('full');

            // Update playlist information if available
            if (nowPlayingData.context && nowPlayingData.context.type === 'playlist') {
                const playlistId = nowPlayingData.context.uri.split(':')[2];
                getPlaylistInfo(playlistId);
            } else {
                playlistName.textContent = '';
                playlistArt.style.display = 'none';
            }

            const progress = (nowPlayingData.progress_ms / nowPlayingData.item.duration_ms) * 100;
            progressBar.style.width = `${progress}%`;

            currentTime.textContent = formatTime(nowPlayingData.progress_ms);
            totalTime.textContent = formatTime(nowPlayingData.item.duration_ms);

            // Extract colors from album art
            extractColors(albumArt.src);

            // Check if song is about to end
            if (nowPlayingData.item.duration_ms - nowPlayingData.progress_ms <= NEXT_SONG_POPUP_TIME) {
                if (queueData && queueData.queue && queueData.queue.length > 0) {
                    const nextSong = queueData.queue[0];
                    showNextSongModal(nextSong.name, nextSong.artists[0].name, nextSong.album.images[0].url);
                } else {
                    hideNextSongModal();
                }
            } else {
                hideNextSongModal();
            }

            pauseStartTime = null;
            lastPlaybackState = 'playing';
        } else {
            if (lastPlaybackState === 'playing') {
                pauseStartTime = Date.now();
            }
            
            if (pauseStartTime && Date.now() - pauseStartTime > PAUSE_TIMEOUT) {
                if(!nowPlaying.classList.contains('placeholder')) {
                    showPlaceholder();
                }
            }
            
            lastPlaybackState = 'paused';
        }
    } else {
        showPlaceholder();
    }
}

async function getPlaylistInfo(playlistId) {
    if (playlistCache[playlistId]) {
        updatePlaylistInfo(playlistCache[playlistId]);
        return;
    }

    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            playlistCache[playlistId] = data;
            updatePlaylistInfo(data);
        }
    } catch (error) {
        console.error('Error fetching playlist info:', error);
    }
}

function updatePlaylistInfo(playlistData) {
    const playlistName = document.getElementById('playlist-name');
    const playlistArt = document.getElementById('playlist-art');

    playlistName.textContent = playlistData.name;
    if (playlistData.images && playlistData.images.length > 0) {
        playlistArt.src = playlistData.images[0].url;
        playlistArt.style.display = 'block';
    } else {
        playlistArt.style.display = 'none';
    }
}

function showPlaceholder() {
    const nowPlaying = document.getElementById('now-playing');
    const albumArt = document.getElementById('album-art');
    const songName = document.getElementById('song-name');
    const artistName = document.getElementById('artist-name');
    const albumName = document.getElementById('album-name');
    const playlistName = document.getElementById('playlist-name');
    const playlistArt = document.getElementById('playlist-art');
    const mainApp = document.getElementById('app');
    const clockContainer = document.getElementById('clock');
    
    if (!isPlaceholderActive) {
        // Start cycling wallpapers only if not already active
        cycleWallpaper();
        clearInterval(wallpaperInterval);
        wallpaperInterval = setInterval(cycleWallpaper, 60000); // Set to 60 seconds
        isPlaceholderActive = true;
    }

    nowPlaying.classList.add('placeholder');
    clockContainer.classList.add('full');
    mainApp.classList.add('full');
    songName.textContent = 'Not Playing';
    artistName.textContent = '-';
    albumName.textContent = '';
    playlistName.textContent = '';
    playlistArt.style.display = 'none';
    hideNextSongModal();
}

function showNextSongModal(nextSongName, nextArtistName, nextAlbumArtUrl) {
    const modal = document.getElementById('next-song-modal');
    const nowPlaying = document.getElementById('now-playing');
    const songDetails = document.getElementById('song-details');
    const songContainer = document.getElementById('song-details-container');
    songContainer.classList.add('modal-visible');

    const nextSongNameEl = document.getElementById('next-song-name');
    const nextArtistNameEl = document.getElementById('next-artist-name');
    const nextAlbumArtEl = document.getElementById('next-album-art');

    nextSongNameEl.textContent = nextSongName;
    nextArtistNameEl.textContent = nextArtistName;
    nextAlbumArtEl.src = nextAlbumArtUrl;
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('visible'), 10);
}

function hideNextSongModal() {
    const modal = document.getElementById('next-song-modal');
    const nowPlaying = document.getElementById('now-playing');
    const songContainer = document.getElementById('song-details-container');
    songContainer.classList.remove('modal-visible');

    modal.classList.remove('visible');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

function extractColors(imageUrl) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = function() {
        const colorThief = new ColorThief();
        const palette = colorThief.getPalette(img, 4);
        
        // Set CSS variables
        document.documentElement.style.setProperty('--light-dominant-color', `rgb(${palette[0].join(',')})`);
        document.documentElement.style.setProperty('--light-subtle-color', `rgb(${palette[1].join(',')})`);
        document.documentElement.style.setProperty('--dark-dominant-color', `rgb(${palette[2].join(',')})`);
        document.documentElement.style.setProperty('--dark-subtle-color', `rgb(${palette[3].join(',')})`);
    }
}

function updateClock() {
    const now = new Date();
    const clockElement = document.getElementById('clock');
    const dayDatecontainer = document.getElementById('daydate');
 
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const day = days[now.getDay()];
    const date = now.getDate();
    const month = months[now.getMonth()];
    
    clockElement.innerHTML = `
        <span id="hours">${hours}</span>
        <span id="minutes">${minutes}</span>
    `;

    dayDatecontainer.innerHTML =`
        ${document.getElementById('now-playing').classList.contains('placeholder') ? `
                <span id="day">${day}</span>
                <span id="date">${month} ${date}</span>
        ` : ''}
        `;
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

window.onload = function() {
    getNowPlayingAndQueue();
    updateClock();
    loadWallpapers();
};

async function startApp() {
    await loadWallpapers();
    getNowPlayingAndQueue();
    setInterval(getNowPlayingAndQueue, 1000); // Update every second
    setInterval(updateClock, 1000); // Update clock every second
}

// Check for authorization code in URL
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

if (code) {
    getAccessToken(code);
} else {
    checkAuth();
}