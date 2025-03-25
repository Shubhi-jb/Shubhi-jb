let map;
let markers = [];

function initMap() {
  map = L.map('map-container').setView([20.5937, 78.9629], 5); // Default to India’s center
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
  }).addTo(map);
  document.getElementById('search-button').addEventListener('click', searchLocation);
}

function searchLocation() {
  const locationInput = document.getElementById('location-input').value;
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationInput + ", India")}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.length > 0) {
        const location = data[0];
        const lat = parseFloat(location.lat);
        const lon = parseFloat(location.lon);
        map.setView([lat, lon], 12);
        clearMarkers();
        addMarker([lat, lon], 'Your Location');
        fetchNearbyResources([lat, lon]);
      } else {
        alert('Location not found in India. Please try again.');
      }
    })
    .catch((error) => console.error('Error fetching location data:', error));
}

function addMarker(coords, title) {
  const marker = L.marker(coords).addTo(map).bindPopup(title);
  markers.push(marker);
}

function clearMarkers() {
  markers.forEach((marker) => map.removeLayer(marker));
  markers = [];
}

function fetchNearbyResources(coords) {
  const [lat, lon] = coords;
  const query = `
    [out:json];
    (
      node["amenity"="shelter"](around:5000, ${lat}, ${lon});
      node["amenity"="hospital"](around:5000, ${lat}, ${lon});
      node["amenity"="food_bank"](around:5000, ${lat}, ${lon});
    );
    out body;
    >;
    out skel qt;
  `;
  fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
    .then((response) => response.json())
    .then((data) => {
      console.log('Overpass API Response:', data.elements);
      if (data.elements.length > 0) {
        data.elements.forEach((element) => {
          const resourceCoords = [element.lat, element.lon];
          const resourceName = element.tags.name || 'Unnamed Resource';
          addMarker(resourceCoords, resourceName);
        });
        updateResourceList(data.elements);
      } else {
        console.log('No resources found nearby.');
      }
    })
    .catch((error) => console.error('Error fetching Overpass API data:', error));
}

function updateResourceList(resources) {
  const resourceItems = document.getElementById('resource-items');
  resourceItems.innerHTML = '';
  resources.forEach((resource) => {
    const resourceName = resource.tags.name || 'Unnamed Resource';
    const resourceType = resource.tags.amenity || 'Unknown Type';
    const phone = resource.tags.phone || 'Phone not available';
    const address = resource.tags['addr:street'] || 'Address not available';
    const website = resource.tags.website || '';
    const card = document.createElement('div');
    card.className = 'resource-card';
    card.innerHTML = `
      <h4>${resourceName}</h4>
      <p><strong>Type:</strong> ${resourceType}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Address:</strong> ${address}</p>
      ${website ? `<p><strong>Website:</strong> <a href="${website}" target="_blank">${website}</a></p>` : ''}
    `;
    resourceItems.appendChild(card);
  });
}

// Chatbot Logic
const chatbotMessages = document.getElementById('chatbot-messages');
const chatbotInput = document.getElementById('chatbot-input');
const chatbotSend = document.getElementById('chatbot-send');

// India-specific helplines
const helplines = {
  "natural disasters": "National Disaster Response Force: 9711077372 | NDMA Helpline: 1078",
  "mental health": "Kiran Helpline: 1800-599-0019 | Vandrevala Foundation: 9999-666-555",
  "domestic violence": "Women Helpline: 181 | National Commission for Women: 7827170170",
  "homelessness": "NULM Shelter Info: 011-23062852 | Local Police: 100"
};

// Mapping for Hindi inputs to English keys
const crisisMapping = {
  "प्राकृतिक आपदाएँ": "natural disasters",
  "मानसिक स्वास्थ्य": "mental health",
  "घरेलू हिंसा": "domestic violence",
  "बेघरता": "homelessness"
};

// Simplified VADER Sentiment Analysis (pre-trained lexicon)
const vaderLexicon = {
  "happy": 1.9, "sad": -1.6, "hopeless": -2.0, "good": 1.5, "bad": -1.3, "help": 0.5,
  "terrible": -2.1, "great": 2.0, "distress": -1.8 // Add more as needed
};

function analyzeSentiment(text) {
  const words = text.toLowerCase().split(/\s+/);
  let score = 0;
  let count = 0;
  words.forEach(word => {
    if (vaderLexicon[word]) {
      score += vaderLexicon[word];
      count++;
    }
  });
  return count > 0 ? score / count : 0; // Average score, -1 to 1
}

// Chatbot state
let currentStep = "crisis";
let selectedCrisis = null;
let languageCode = 'en';

function addMessage(message, isUser = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = isUser ? 'user-message' : 'bot-message';
  messageDiv.innerHTML = message;
  chatbotMessages.appendChild(messageDiv);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function processInput() {
  const input = chatbotInput.value.trim();
  if (!input) return;

  addMessage(input, true);
  chatbotInput.value = '';

  const sentiment = analyzeSentiment(input);
  if (sentiment < -0.5 && currentStep !== "emergency") {
    addMessage(languageCode === 'hi' ?
      "मुझे लगता है कि आप बहुत परेशान हैं। क्या आपको तुरंत सहायता चाहिए? (हाँ/नहीं)" :
      "I sense you're feeling very distressed. Do you need immediate help? (Yes/No)");
    currentStep = "distress";
    return;
  }

  if (currentStep === "crisis") {
    const crisisTypes = Object.keys(helplines);
    let crisis = null;

    // Normalize input for comparison
    const normalizedInput = input.trim();

    if (languageCode === 'hi') {
      crisis = crisisMapping[normalizedInput] || null;
      console.log("Hindi Input:", normalizedInput, "Mapped Crisis:", crisis); // Debugging
    } else {
      crisis = crisisTypes.find(c => c === normalizedInput.toLowerCase());
      console.log("English Input:", normalizedInput, "Mapped Crisis:", crisis); // Debugging
    }

    if (crisis) {
      selectedCrisis = crisis;
      addMessage(languageCode === 'hi' ? "क्या यह आपातकालीन स्थिति है? (हाँ/नहीं)" : "Is this an emergency? (Yes/No)");
      currentStep = "emergency";
    } else if (normalizedInput.toLowerCase() === "language") {
      addMessage(`Please select a language:<br><br>
        <button onclick="selectLanguage('en')">English</button>
        <button onclick="selectLanguage('hi')">हिंदी</button>`);
      currentStep = "language";
    } else {
      addMessage(languageCode === 'hi' ?
        `क्षमा करें, मैं उस संकट प्रकार को नहीं पहचानता। कृपया नीचे से चुनें:<br><br>
        <button onclick="selectCrisis('प्राकृतिक आपदाएँ')">प्राकृतिक आपदाएँ</button>
        <button onclick="selectCrisis('मानसिक स्वास्थ्य')">मानसिक स्वास्थ्य</button>
        <button onclick="selectCrisis('घरेलू हिंसा')">घरेलू हिंसा</button>
        <button onclick="selectCrisis('बेघरता')">बेघरता</button>` :
        `Sorry, I don’t recognize that crisis type. Please choose from below:<br><br>
        <button onclick="selectCrisis('natural disasters')">Natural Disasters</button>
        <button onclick="selectCrisis('mental health')">Mental Health</button>
        <button onclick="selectCrisis('domestic violence')">Domestic Violence</button>
        <button onclick="selectCrisis('homelessness')">Homelessness</button>`);
    }
  } else if (currentStep === "language") {
    if (input.toLowerCase() === "en") {
      languageCode = 'en';
      addMessage("Language set to English. What type of crisis are you facing?");
      currentStep = "crisis";
    } else if (input.toLowerCase() === "hi") {
      languageCode = 'hi';
      addMessage("भाषा हिंदी में सेट की गई। आप किस प्रकार के संकट का सामना कर रहे हैं?");
      currentStep = "crisis";
    } else {
      addMessage(`Invalid language. Please select below:<br><br>
        <button onclick="selectLanguage('en')">English</button>
        <button onclick="selectLanguage('hi')">हिंदी</button>`);
    }
  } else if (currentStep === "emergency") {
    if (input.toLowerCase() === "yes" || input.toLowerCase() === "हाँ") {
      addMessage(languageCode === 'hi' ?
        "कृपया तुरंत 112 या स्थानीय आपातकालीन नंबर पर कॉल करें।" :
        "Please call 112 or your local emergency number immediately.");
    } else {
      const response = helplines[selectedCrisis];
      const hindiCrisisNames = {
        "natural disasters": "प्राकृतिक आपदाएँ",
        "mental health": "मानसिक स्वास्थ्य",
        "domestic violence": "घरेलू हिंसा",
        "homelessness": "बेघरता"
      };
      addMessage(languageCode === 'hi' ?
        `<strong>${hindiCrisisNames[selectedCrisis]}</strong> के लिए हेल्पलाइन: <strong>${response}</strong>` :
        `Here’s the helpline for <strong>${selectedCrisis}</strong>: <strong>${response}</strong>`);
    }
    currentStep = "crisis";
    selectedCrisis = null;
  } else if (currentStep === "distress") {
    if (input.toLowerCase() === "yes" || input.toLowerCase() === "हाँ") {
      addMessage(languageCode === 'hi' ?
        "मैं आपको तुरंत सहायता से जोड़ रहा हूँ। कृपया 112 डायल करें।" :
        "I’m connecting you to immediate help. Please dial 112.");
      currentStep = "crisis";
    } else {
      addMessage(languageCode === 'hi' ?
        "ठीक है, मैं आपकी सहायता के लिए यहाँ हूँ। आप किस प्रकार के संकट का सामना कर रहे हैं?" :
        "Okay, I’m here to help. What type of crisis are you facing?");
      currentStep = "crisis";
    }
  }
}

// Function to handle button clicks for crisis selection
function selectCrisis(crisis) {
  chatbotInput.value = crisis;
  processInput();
}

// Function to handle button clicks for language selection
function selectLanguage(lang) {
  chatbotInput.value = lang;
  processInput();
}

chatbotSend.addEventListener('click', processInput);
chatbotInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') processInput();
});

addMessage(`Hi! I can provide helpline numbers and nearby resources for crises in India. What type of crisis are you facing?<br><br>Options:<br>- Natural Disasters (प्राकृतिक आपदाएँ)<br>- Mental Health (मानसिक स्वास्थ्य)<br>- Domestic Violence (घरेलू हिंसा)<br>- Homelessness (बेघरता)<br>Type "language" to switch between English and Hindi.`);

// Chatbot Toggle
const chatbotIcon = document.getElementById('chatbot-icon');
const chatbotContainer = document.getElementById('chatbot');
const chatbotClose = document.getElementById('chatbot-close');

chatbotIcon.addEventListener('click', () => {
  chatbotContainer.classList.toggle('open');
});

chatbotClose.addEventListener('click', () => {
  chatbotContainer.classList.remove('open');
});

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

themeToggle.addEventListener('click', () => {
  body.dataset.theme = body.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', body.dataset.theme);
  updateThemeIcon();
});

const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  body.dataset.theme = savedTheme;
}

function updateThemeIcon() {
  const icon = themeToggle.querySelector('i');
  if (body.dataset.theme === 'dark') {
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
  } else {
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
  }
}

updateThemeIcon();

window.onload = initMap;