let wallpapers = [];
const defaultFont = 'Roboto';

document.addEventListener('DOMContentLoaded', () => {
    loadWallpapers();
    
    const addBtn = document.getElementById('addWallpaperBtn');
    const modal = document.getElementById('addWallpaperModal');
    const wallpaperForm = document.getElementById('wallpaperForm');
    
    addBtn.addEventListener('click', () => {
        modal.style.display = 'block';
        addBtn.classList.add('rotate');
    });
    
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
    
    wallpaperForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addNewWallpaper();
    });
    
    document.getElementById('imagePath').addEventListener('change', updatePreview);
    document.getElementById('clockColor').addEventListener('input', updatePreview);
    document.getElementById('fontSource').addEventListener('change', toggleFontInputs);
    document.getElementById('googleFont').addEventListener('input', updatePreview);
    document.getElementById('customFontFile').addEventListener('change', handleCustomFont);
    document.getElementById('fontWeight').addEventListener('input', updateFontWeight);
});

function loadWallpapers() {
    console.log('Loading wallpapers...');
    fetch('/wallpapers')
        .then(response => response.json())
        .then(data => {
            wallpapers = data.wallpapers;
            console.log('Wallpapers loaded:', wallpapers);
            renderWallpapers();
        })
        .catch(error => console.error('Error loading wallpapers:', error));
}

function renderWallpapers() {
    console.log('Rendering wallpapers...');
    const grid = document.getElementById('wallpaperGrid');
    grid.innerHTML = '';
    wallpapers.forEach((wallpaper, index) => {
        const wallpaperElement = createWallpaperElement(wallpaper, index);
        grid.appendChild(wallpaperElement);
    });
}

function createWallpaperElement(wallpaper, index) {
    console.log('Creating wallpaper element:', wallpaper);
    const div = document.createElement('div');
    div.className = 'wallpaper-item';
    const imagePath = getImagePath(wallpaper.imagePath);
    console.log('Image path for display:', imagePath);
    div.style.backgroundImage = `url(${imagePath})`;
    
    const clock = document.createElement('span');
    clock.className = 'clock';
    clock.textContent = `10:03`;
    clock.style.color = wallpaper.clockColor;
    clock.style.fontWeight = wallpaper.fontWeight;
    
    if (wallpaper.fontType === 'google') {
        loadGoogleFont(wallpaper.fontName);
        clock.style.fontFamily = wallpaper.fontName;
    } else if (wallpaper.fontType === 'custom') {
        loadCustomFont(wallpaper.fontName, wallpaper.fontUrl);
        clock.style.fontFamily = wallpaper.fontName;
    } else {
        clock.style.fontFamily = defaultFont;
    }
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removeWallpaper(index));
    
    div.appendChild(clock);
    div.appendChild(removeBtn);
    return div;
}

function addNewWallpaper() {
    const imageInput = document.getElementById('imagePath');
    const clockColor = document.getElementById('clockColor').value;
    const fontSource = document.getElementById('fontSource').value;
    const fontWeight = document.getElementById('fontWeight').value;
    let fontName, fontUrl, fontType;

    if (fontSource === 'google') {
        fontName = document.getElementById('googleFont').value;
        fontType = 'google';
    } else if (fontSource === 'custom') {
        const fontFile = document.getElementById('customFontFile').files[0];
        fontName = fontFile.name.split('.')[0];
        fontUrl = URL.createObjectURL(fontFile);
        fontType = 'custom';
    } else {
        fontName = defaultFont;
        fontType = 'default';
    }
    
    let imagePath;
    
    // Handling the image path
    if (imageInput.files && imageInput.files[0]) {
        // For file uploads
        const file = imageInput.files[0];
        imagePath = `/wallpapers/${file.name}`;
        console.log('File to be uploaded:', file);
    } else if (imageInput.value.startsWith('http')) {
        // For URL inputs
        imagePath = imageInput.value;
    } else {
        // For other local paths
        imagePath = `/wallpapers/${imageInput.value}`;
    }
    
    const newWallpaper = { imagePath, clockColor, fontName, fontUrl, fontType, fontWeight };
    console.log('Adding new wallpaper:', newWallpaper);
    wallpapers.push(newWallpaper);
    
    saveWallpapers();
    renderWallpapers();
    closeModal();
}

function removeWallpaper(index) {
    console.log('Removing wallpaper at index:', index);
    wallpapers.splice(index, 1);
    saveWallpapers();
    renderWallpapers();
}

function saveWallpapers() {
    console.log('Saving wallpapers:', wallpapers);
    fetch('/save-wallpapers', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wallpapers, defaultFont }),
    })
    .then(response => response.json())
    .then(data => console.log('Wallpapers saved:', data))
    .catch(error => console.error('Error saving wallpapers:', error));
}

function updatePreview() {
    console.log('Updating preview...');
    const previewWallpaper = document.getElementById('previewWallpaper');
    const imageInput = document.getElementById('imagePath');
    const clockColor = document.getElementById('clockColor').value;
    const fontSource = document.getElementById('fontSource').value;
    const fontWeight = document.getElementById('fontWeight').value;
    
    let previewImageUrl;
    if (imageInput.files && imageInput.files[0]) {
        previewImageUrl = URL.createObjectURL(imageInput.files[0]);
    } else {
        previewImageUrl = getImagePath(imageInput.value);
    }
    console.log('Preview image URL:', previewImageUrl);
    
    previewWallpaper.style.backgroundImage = `url(${previewImageUrl})`;
    const previewClock = previewWallpaper.querySelector('.clock');
    previewClock.style.color = clockColor;
    previewClock.style.fontWeight = fontWeight;
    
    if (fontSource === 'google') {
        const fontName = document.getElementById('googleFont').value;
        loadGoogleFont(fontName);
        previewClock.style.fontFamily = fontName;
    } else if (fontSource === 'default') {
        previewClock.style.fontFamily = defaultFont;
    }
}

function getImagePath(path) {
    console.log('Getting image path for:', path);
    if (path.startsWith('http')) {
        return path;
    } else if (path.startsWith('/wallpapers/')) {
        return path;
    } else {
        return `/wallpapers/${path}`;
    }
}

function toggleFontInputs() {
    const fontSource = document.getElementById('fontSource').value;
    document.getElementById('googleFont').style.display = fontSource === 'google' ? 'block' : 'none';
    document.getElementById('customFontFile').style.display = fontSource === 'custom' ? 'block' : 'none';
    document.getElementById('fontWeightContainer').style.display = fontSource !== 'default' ? 'flex' : 'none';
}

function handleCustomFont(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const fontName = file.name.split('.')[0];
            loadCustomFont(fontName, e.target.result);
            const previewClock = document.querySelector('#previewWallpaper .clock');
            previewClock.style.fontFamily = fontName;
        };
        reader.readAsDataURL(file);
    }
}

function loadGoogleFont(fontName) {
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css?family=${fontName.replace(' ', '+')}`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
}

function loadCustomFont(fontName, fontUrl) {
    const style = document.createElement('style');
    style.textContent = `
        @font-face {
            font-family: '${fontName}';
            src: url('${fontUrl}') format('truetype');
        }
    `;
    document.head.appendChild(style);
}

function updateFontWeight(event) {
    const fontWeightValue = document.getElementById('fontWeightValue');
    fontWeightValue.textContent = event.target.value;
    updatePreview();
}

function closeModal() {
    document.getElementById('addWallpaperModal').style.display = 'none';
    document.getElementById('addWallpaperBtn').classList.remove('rotate');
    document.getElementById('wallpaperForm').reset();
    toggleFontInputs();
}