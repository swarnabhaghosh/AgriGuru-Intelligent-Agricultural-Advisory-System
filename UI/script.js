// AgriGuru Vanilla JS Application

class AgriGuruApp {
  constructor() {
    this.selectedLanguage = 'en';
    this.apiKey = '32f240e7dbf987239fa93ae66c6225c3';
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadWeatherData();
    this.populateAlerts();
    this.populateCropRecommendations();
    this.populateMarketPrices();
    this.populateFeatures();
    this.setupWeatherSearch(); // <-- Add search setup
  }

  // --- Add this method ---
  setupWeatherSearch() {
    const searchBtn = document.getElementById('searchBtn');
    const cityInput = document.getElementById('cityInput');
    if (searchBtn && cityInput) {
      searchBtn.addEventListener('click', async () => {
        const city = cityInput.value.trim();
        if (city) {
          try {
            const weatherData = await this.fetchWeatherDataByCity(city);
            this.populateWeatherData(weatherData);
          } catch (error) {
            alert('City not found or API error.');
          }
        }
      });
      cityInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchBtn.click();
      });
    }

    // --- Add lat/lon search logic ---
    const latInput = document.getElementById('latInput');
    const lonInput = document.getElementById('lonInput');
    const latlonBtn = document.getElementById('latlonBtn');
    if (latInput && lonInput && latlonBtn) {
      latlonBtn.addEventListener('click', async () => {
        const lat = parseFloat(latInput.value);
        const lon = parseFloat(lonInput.value);
        if (!isNaN(lat) && !isNaN(lon)) {
          try {
            const weatherData = await this.fetchWeatherData(lat, lon);
            this.populateWeatherData(weatherData);
          } catch (error) {
            alert('Coordinates not found or API error.');
          }
        } else {
          alert('Please enter valid latitude and longitude values.');
        }
      });
      latInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') latlonBtn.click();
      });
      lonInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') latlonBtn.click();
      });
    }

    const detectLocationBtn = document.getElementById('detectLocationBtn');
    if (detectLocationBtn && latInput && lonInput) {
      detectLocationBtn.addEventListener('click', () => {
        if (navigator.geolocation) {
          detectLocationBtn.textContent = 'Detecting...';
          navigator.geolocation.getCurrentPosition(
            (position) => {
              latInput.value = position.coords.latitude.toFixed(5);
              lonInput.value = position.coords.longitude.toFixed(5);
              detectLocationBtn.textContent = 'Detect My Location';
            },
            (error) => {
              alert('Unable to detect location.');
              detectLocationBtn.textContent = 'Detect My Location';
            }
          );
        } else {
          alert('Geolocation is not supported by your browser.');
        }
      });
    }
  }

  // --- Add this method ---
  // --- Updated Method: fetchWeatherDataByCity with UV Index support ---
  async fetchWeatherDataByCity(city) {
    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${this.apiKey}&units=metric`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${this.apiKey}&units=metric`;

    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(currentWeatherUrl),
      fetch(forecastUrl)
    ]);

    if (!currentResponse.ok || !forecastResponse.ok) {
      throw new Error('Weather API request failed');
  }

  const currentWeather = await currentResponse.json();
  const forecast = await forecastResponse.json();

  const lat = currentWeather.coord.lat;
  const lon = currentWeather.coord.lon;
  const uvUrl = `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${this.apiKey}`;

  const uvResponse = await fetch(uvUrl);
  if (!uvResponse.ok) {
    throw new Error('UV Index API request failed');
  }

  const uvData = await uvResponse.json();

  return {
    current: currentWeather,
    forecast: forecast,
    uvIndex: uvData.value
  };
}



  async loadWeatherData() {
    try {
      // Get user's location or use default coordinates (Delhi, India)
      const coords = await this.getCurrentLocation();
      const weatherData = await this.fetchWeatherData(coords.lat, coords.lon);
      this.populateWeatherData(weatherData);
    } catch (error) {
      console.error('Error loading weather data:', error);
      // Fallback to mock data if API fails
      this.populateWeatherData(null);
    }
  }

  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lon: position.coords.longitude
            });
          },
          (error) => {
            console.log('Geolocation error, using default location');
            // Default to Delhi, India coordinates
            resolve({ lat: 28.6139, lon: 77.2090 });
          }
        );
      } else {
        // Default to Delhi, India coordinates
        resolve({ lat: 28.6139, lon: 77.2090 });
      }
    });
  }

  async fetchWeatherData(lat, lon) {
    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`;
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`;
    const uvUrl = `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${this.apiKey}`;

    const [currentResponse, forecastResponse, uvResponse] = await Promise.all([
      fetch(currentWeatherUrl),
      fetch(forecastUrl),
      fetch(uvUrl)
    ]);

    if (!currentResponse.ok || !forecastResponse.ok || !uvResponse.ok) {
      throw new Error('Weather API request failed');
    }

    const currentWeather = await currentResponse.json();
    const forecast = await forecastResponse.json();
    const uvData = await uvResponse.json();

    return {
      current: currentWeather,
      forecast: forecast,
      uvIndex: uvData.value
    };
  }

  processForecastData(forecastData) {
    // 7-day forecast using OpenWeatherMap 3-hour interval data
    const dailyData = [];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayIdx = new Date().getDay();
    // Group by day (get first entry for each day)
    let lastDate = '';
    let dayCount = 0;
    for (let i = 0; i < forecastData.list.length && dayCount < 7; i++) {
      const item = forecastData.list[i];
      const date = item.dt_txt.split(' ')[0];
      if (date !== lastDate) {
        const d = new Date(item.dt * 1000);
        const dayName = dayCount === 0 ? 'Today' : daysOfWeek[(todayIdx + dayCount) % 7];
        const temp = Math.round(item.main.temp);
        const condition = item.weather[0].main;
        const iconType = this.getIconType(item.weather[0].main);
        const tooltip = item.weather[0].description;
        dailyData.push({
          day: dayName,
          temp: `${temp}°C`,
          condition,
          iconType,
          tooltip
        });
        lastDate = date;
        dayCount++;
      }
    }
    return dailyData;
  }

  populateWeatherData(weatherData) {
    // Update current weather
    if (weatherData && weatherData.current) {
      const current = weatherData.current;
      const temp = Math.round(current.main.temp);
      const feelsLike = Math.round(current.main.feels_like);
      const condition = current.weather[0].description;
      const windSpeed = current.wind ? current.wind.speed : null;
      const windDeg = current.wind ? current.wind.deg : null;
      const humidity = current.main.humidity;
      const rain = (current.rain && (current.rain['1h'] || current.rain['3h'])) ? (current.rain['1h'] || current.rain['3h']) : 0;
      const uvIndex = weatherData.uvIndex !== undefined ? weatherData.uvIndex : '--';

      // Wind direction helper
      function degToCompass(num) {
        const val = Math.floor((num / 22.5) + 0.5);
        const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
        return arr[(val % 16)];
      }

      // Update current weather display
      const tempElement = document.querySelector('.temperature');
      const conditionElement = document.querySelector('.condition');
      const feelsLikeElement = document.querySelector('.feels-like');
      const windMetric = document.getElementById('windMetric');
      const humidityMetric = document.getElementById('humidityMetric');
      const rainMetric = document.getElementById('rainMetric');
      const uvMetric = document.getElementById('uvMetric');

      if (tempElement) tempElement.textContent = `${temp}°C`;
      if (conditionElement) conditionElement.textContent = this.capitalizeWords(condition);
      if (feelsLikeElement) feelsLikeElement.textContent =` Feels like ${feelsLike}°C`;
      if (windMetric) windMetric.textContent =` 💨 Wind: ${windSpeed !== null ? windSpeed + ' km/h ' + (windDeg !== null ? degToCompass(windDeg) : '') : '--'}`;
      if (humidityMetric) humidityMetric.textContent = `💧 Humidity: ${humidity !== undefined ? humidity + '%' : '--'}`;
      if (rainMetric) rainMetric.textContent = `🌧 Rain: ${rain} mm`;
      if (uvMetric) uvMetric.textContent = `☀ UV Index: ${uvIndex}`;
    }

    // Contextual advisories
    // Contextual advisories
const advisoryDiv = document.querySelector('.advisory span');
let advice = 'Ideal conditions for irrigation today';

if (weatherData && weatherData.current && weatherData.current.main) {
  const temp = weatherData.current.main.temp;
  const humidity = weatherData.current.main.humidity;
  const rain = (weatherData.current.rain && (weatherData.current.rain['1h'] || weatherData.current.rain['3h']))
    ? (weatherData.current.rain['1h'] || weatherData.current.rain['3h'])
    : 0;
  const uv = weatherData.uvIndex !== undefined ? weatherData.uvIndex : 0;

  console.log("👉 Temp:", temp, "| Humidity:", humidity, "| Rain:", rain, "| UV:", uv); // DEBUG LOG

  if (rain > 2) {
    advice = '🌧 Rain expected — avoid irrigation today';
  } else if (temp > 35 && humidity < 30) {
    advice = '☀ Hot & dry week — consider mulching or extra irrigation';
  } else if (uv >= 8) {
    advice = '☀ UV Index very high — limit outdoor work during midday';
  } else if (humidity > 80) {
    advice = '💧 High humidity — monitor for crop diseases';
  }
}

if (advisoryDiv) {
  advisoryDiv.innerHTML = `<strong>Advisory:</strong> ${advice}`;
} else {
  console.warn("❌ Advisory div not found in DOM!");
}


    // Extended 7-day forecast
    let forecastData;
    if (weatherData && weatherData.forecast) {
      forecastData = this.processForecastData(weatherData.forecast);
    } else {
      forecastData = [
        { day: 'Today', temp: '28°C', condition: 'Sunny', iconType: 'sun', tooltip: 'Sunny' },
        { day: 'Tue', temp: '25°C', condition: 'Partly Cloudy', iconType: 'cloud', tooltip: 'Partly Cloudy' },
        { day: 'Wed', temp: '22°C', condition: 'Light Rain', iconType: 'rain', tooltip: 'Light Rain' },
        { day: 'Thu', temp: '26°C', condition: 'Sunny', iconType: 'sun', tooltip: 'Sunny' },
        { day: 'Fri', temp: '27°C', condition: 'Sunny', iconType: 'sun', tooltip: 'Sunny' },
        { day: 'Sat', temp: '29°C', condition: 'Sunny', iconType: 'sun', tooltip: 'Sunny' },
        { day: 'Sun', temp: '30°C', condition: 'Sunny', iconType: 'sun', tooltip: 'Sunny' }
      ];
    }
    const forecastGrid = document.getElementById('forecastGrid');
    if (forecastGrid) {
      forecastGrid.innerHTML = `<div class="forecast-scroll" style="display:flex;overflow-x:auto;gap:0.75em;">${
        forecastData.map(item => `
          <div class="forecast-item" title="${item.tooltip}" style="min-width:80px;">
            <div class="forecast-day">${item.day}</div>
            <div class="forecast-icon">${this.getWeatherIcon(item.iconType)}</div>
            <div class="forecast-temp">${item.temp}</div>
          </div>
        `).join('')
      }</div>`;
    }
  }

  getIconType(weatherMain) {
    const iconMap = {
      'Clear': 'sun',
      'Clouds': 'cloud',
      'Rain': 'rain',
      'Drizzle': 'rain',
      'Thunderstorm': 'rain',
      'Snow': 'cloud',
      'Mist': 'cloud',
      'Fog': 'cloud'
    };
    return iconMap[weatherMain] || 'sun';
  }

  capitalizeWords(str) {
    return str.split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  setupEventListeners() {
    // Language selector
    const languageOptions = document.getElementById('languageOptions');
    if (languageOptions) {
      languageOptions.addEventListener('click', (e) => {
        if (e.target.classList.contains('language-btn')) {
          this.handleLanguageChange(e.target);
        }
      });
    }

    // Feature cards hover effects
    document.addEventListener('DOMContentLoaded', () => {
      const featureCards = document.querySelectorAll('.feature-card');
      featureCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
          card.style.transform = 'translateY(-4px) scale(1.02)';
        });

        card.addEventListener('mouseleave', () => {
          card.style.transform = 'translateY(0) scale(1)';
        });
      });
    });
  }

  handleLanguageChange(button) {
    // Remove active class from all buttons
    document.querySelectorAll('.language-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // Add active class to clicked button
    button.classList.add('active');

    // Update selected language
    this.selectedLanguage = button.dataset.lang;

    // Here you would typically load translations
    console.log(`Language changed to: ${this.selectedLanguage}`);
  }

  getWeatherIcon(type) {
    const icons = {
      sun: `<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2">
        <circle cx="12" cy="12" r="5"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>`,
      cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
      </svg>`,
      rain: `<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
        <path d="M16 13v8l4-7-4-1z"/>
        <path d="M8 13v8l4-7-4-1z"/>
        <path d="M12 13v8l4-7-4-1z"/>
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
      </svg>`
    };
    return icons[type] || icons.sun;
  }

  populateAlerts() {
    const alertsData = [
      {
        type: 'warning',
        title: 'Drought Alert',
        message: 'Low rainfall expected for next 7 days',
        time: '2 hours ago'
      },
      {
        type: 'info',
        title: 'Market Update',
        message: 'Wheat prices increased by 5.2% today',
        time: '4 hours ago'
      },
      {
        type: 'success',
        title: 'Optimal Conditions',
        message: 'Perfect weather for cotton harvesting',
        time: '6 hours ago'
      }
    ];

    const alertsList = document.getElementById('alertsList');
    if (alertsList) {
      alertsList.innerHTML = alertsData.map(alert => `
        <div class="alert-item ${alert.type}">
          <div class="alert-title">${alert.title}</div>
          <div class="alert-message">${alert.message}</div>
          <div class="alert-time">${alert.time}</div>
        </div>
      `).join('');
    }
  }

  populateCropRecommendations() {
    const recommendations = [
      {
        crop: 'Tomatoes',
        suitability: 92,
        reason: 'Optimal soil pH and moisture levels',
        season: 'Spring'
      },
      {
        crop: 'Wheat',
        suitability: 78,
        reason: 'Good for current soil nutrients',
        season: 'Winter'
      },
      {
        crop: 'Maize',
        suitability: 85,
        reason: 'Excellent weather conditions',
        season: 'Summer'
      }
    ];

    const recommendationsContainer = document.getElementById('recommendations');
    if (recommendationsContainer) {
      recommendationsContainer.innerHTML = recommendations.map(rec => `
        <div class="recommendation-item">
          <div class="recommendation-info">
            <div class="crop-name">${rec.crop}</div>
            <div class="crop-reason">${rec.reason}</div>
            <div class="season-tag">Best for ${rec.season}</div>
          </div>
          <div class="suitability-score">
            <div class="score-label">Suitability</div>
            <div class="score-value">${rec.suitability}%</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${rec.suitability}%"></div>
            </div>
          </div>
        </div>
      `).join('');
    }
  }

  populateMarketPrices() {
    const stateInput = document.getElementById("stateInput");
    const districtInput = document.getElementById("districtInput");
    const fetchBtn = document.getElementById("fetchMarketBtn");

    if (stateInput && districtInput && fetchBtn) {
      fetchBtn.addEventListener("click", () => {
        const state = stateInput.value.trim();
        const district = districtInput.value.trim();
        if (state && district) {
          this.fetchMarketPrices(state, district);
        } else {
          alert("Please enter both state and district");
        }
      });
    }
  }


  async fetchMarketPrices(state, district) {
    try {
      const res = await fetch(`http://127.0.0.1:8000/market_prices?state=${encodeURIComponent(state)}&district=${encodeURIComponent(district)}`);
      if (!res.ok) {
        throw new Error("Market data not available for this location");
      }
      const data = await res.json();
      this.renderMarketPrices(data.prices);
    } catch (err) {
      console.error("Market price fetch error:", err.message);
      const priceList = document.getElementById("priceList");
      if (priceList) {
        priceList.innerHTML = `<div class="price-item error">❌ ${err.message}</div>`;
      }
    }
  }

  renderMarketPrices(prices) {
    const priceList = document.getElementById("priceList");
    if (!priceList) return;

    priceList.innerHTML = prices.map(item => `
      <div class="price-item">
        <div class="crop-info">
          <div class="crop-name">${item.crop}</div>
          <div class="market-type">${item.market}</div>
        </div>
        <div class="price-info">
          <div class="price-value">₹${item.price}</div>
        </div>
      </div>
    `).join('');
  }


  getArrowIcon(isUp) {
    return isUp
      ? `<svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m18 15-6-6-6 6"/>
        </svg>`
      : `<svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m6 9 6 6 6-6"/>
        </svg>`;
  }

  populateFeatures() {
    const features = [
      {
        title: 'Crop Selection Advisor',
        description: 'Get personalized crop recommendations based on your soil type, climate, and historical yield data.',
        icon: 'database',
        gradient: 'linear-gradient(135deg, #22c55e, #10b981)'
      },
      {
        title: 'Weather & Climate',
        description: 'Hyperlocal weather forecasting with drought and disease alerts tailored to your location.',
        icon: 'cloud',
        gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)'
      },
      {
        title: 'Market Intelligence',
        description: 'Real-time prices for local and national agricultural markets to maximize your profits.',
        icon: 'search',
        gradient: 'linear-gradient(135deg, #f59e0b, #f97316)'
      },
      {
        title: 'Sustainable Practices',
        description: 'Eco-friendly farming techniques customized for your land to improve long-term productivity.',
        icon: 'sun',
        gradient: 'linear-gradient(135deg, #84cc16, #22c55e)'
      },
      {
        title: 'IoT Sensors',
        description: 'Connect and monitor your field sensors for soil moisture, temperature, and nutrient levels.',
        icon: 'database',
        gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)'
      },
      {
        title: 'Offline Access',
        description: 'Download essential information and continue using the app even without internet connection.',
        icon: 'download',
        gradient: 'linear-gradient(135deg, #6b7280, #64748b)'
      }
    ];

    const featuresGrid = document.getElementById('featuresGrid');
    if (featuresGrid) {
      featuresGrid.innerHTML = features.map(feature => `
        <div class="feature-card">
          <div class="feature-icon" style="background: ${feature.gradient}">
            ${this.getFeatureIcon(feature.icon)}
          </div>
          <h3 class="feature-title">${feature.title}</h3>
          <p class="feature-description">${feature.description}</p>
          <div class="learn-more">
            Learn More
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </div>
        </div>
      `).join('');
    }
  }

  getFeatureIcon(type) {
    const icons = {
      database: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>`,
      cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
      </svg>`,
      search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>`,
      sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>`,
      download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7,10 12,15 17,10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>`
    };
    return icons[type] || icons.database;
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AgriGuruApp();
});

// Add some interactive features
document.addEventListener('DOMContentLoaded', () => {
  // Smooth scrolling for any internal links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Add click handlers for buttons
  document.querySelectorAll('.btn-primary, .btn-secondary').forEach(button => {
    button.addEventListener('click', function(e) {
      // Add a subtle animation on click
      this.style.transform = 'scale(0.95)';
      setTimeout(() => {
        this.style.transform = 'scale(1)';
      }, 150);

      // Log the action (in a real app, this would trigger actual functionality)
      console.log(`Button clicked: ${this.textContent.trim()}`);
    });
  });

  // Add hover effects for cards
  document.querySelectorAll('.stat-card, .widget').forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-2px)';
    });

    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
    });
  });
});
document.getElementById('startBtn').addEventListener('click', function () {
  const intro = document.getElementById('intro');
  const mainContent = document.getElementById('mainContent');

  // Add fade-out effect
  intro.classList.add('fade-out');

  // Wait for fade-out to finish, then show main content
  setTimeout(() => {
    intro.style.display = 'none';
    mainContent.style.display = 'block';
  }, 1000); // matches CSS transition time
});
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("predict-form").addEventListener("submit", async function (e) {
    e.preventDefault();

    const data = {
      N: parseFloat(document.getElementById("N").value),
      P: parseFloat(document.getElementById("P").value),
      K: parseFloat(document.getElementById("K").value),
      ph: parseFloat(document.getElementById("ph").value),
      temperature: parseFloat(document.getElementById("temperature").value),
      humidity: parseFloat(document.getElementById("humidity").value),
      rainfall: parseFloat(document.getElementById("rainfall").value)
    };

    try {
      const res = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      const result = await res.json();
      document.getElementById("result").textContent = "🌱 Recommended Crop: " + result.recommended_crop;
    } catch (err) {
      document.getElementById("result").textContent = "❌ Error: " + err.message;
    }
  });
});

const toggleFormBtn = document.getElementById('toggleFormBtn');
const recommendations = document.getElementById('recommendations');
const formContainer = document.getElementById('analysisFormContainer');

if (toggleFormBtn && recommendations && formContainer) {
  toggleFormBtn.addEventListener('click', () => {
    const isVisible = formContainer.style.display === 'block';

    if (isVisible) {
      formContainer.style.display = 'none';
      recommendations.style.display = 'block';
     toggleFormBtn.textContent = 'Get Detailed Analysis';
    } else {
      formContainer.style.display = 'block';
      recommendations.style.display = 'none';
      toggleFormBtn.textContent = 'Hide Analysis';
    }
  });
}
const sliderIds = ["N", "P", "K", "ph", "temperature", "humidity", "rainfall"];
sliderIds.forEach(id => {
  const slider = document.getElementById(id);
  const valueSpan = document.getElementById(`${id}-value`);
  if (slider && valueSpan) {
    slider.addEventListener("input", () => {
      valueSpan.textContent = slider.value;
    });
  }
});


// Language translations for key UI elements
const translations = {
  en: {
    'AgriGuru': 'AgriGuru',
    'Empowering Farmers with AI-Driven Insights': 'Empowering Farmers with AI-Driven Insights',
    'Real-time Weather & Irrigation Tips': 'Real-time Weather & Irrigation Tips',
    'Crop Yield Forecasts': 'Crop Yield Forecasts',
    'Market Price Monitoring': 'Market Price Monitoring',
    'Personalized Crop Advisory': 'Personalized Crop Advisory',
    'Get Started': 'Get Started',
    'Smart Farming Solutions': 'Smart Farming Solutions',
    'Weather Forecast': 'Weather Forecast',
    'Hyperlocal': 'Hyperlocal',
    'Search': 'Search',
    'Get Weather': 'Get Weather',
    'Detect My Location': 'Detect My Location',
    'Crop Recommendations': 'Crop Recommendations',
    'Based on your location: Punjab, India': 'Based on your location: Punjab, India',
    'Soil Type: Alluvial • Climate: Semi-arid • Last Yield: Good': 'Soil Type: Alluvial • Climate: Semi-arid • Last Yield: Good',
    'Get Detailed Analysis': 'Get Detailed Analysis',
    'Market Prices': 'Market Prices',
    'Live Updates': 'Live Updates',
    'Enter State': 'Enter State',
    'Enter District': 'Enter District',
    'Get Market Prices': 'Get Market Prices',
    'View All Markets': 'View All Markets',
    'N': 'N', 'P': 'P', 'K': 'K', 'pH': 'pH', 'Temperature': 'Temperature', 'Humidity': 'Humidity', 'Rainfall': 'Rainfall',
    'Get Recommendation': 'Get Recommendation',
    'Recommended Crop:': 'Recommended Crop:',
    'Error:': 'Error:',
    'AI-Powered Agricultural Advisory Platform': 'AI-Powered Agricultural Advisory Platform',
    'Ideal conditions for irrigation today': 'Ideal conditions for irrigation today',
    'Active Farmers': 'Active Farmers',
    'Yield Increase': 'Yield Increase',
    'Cost Reduction': 'Cost Reduction',
  },
  hi: {
    'AgriGuru': 'एग्रीगुरु',
    'Empowering Farmers with AI-Driven Insights': 'किसानों को एआई-संचालित सलाह के साथ सशक्त बनाना',
    'Real-time Weather & Irrigation Tips': 'रीयल-टाइम मौसम और सिंचाई सुझाव',
    'Crop Yield Forecasts': 'फसल उपज पूर्वानुमान',
    'Market Price Monitoring': 'बाजार मूल्य निगरानी',
    'Personalized Crop Advisory': 'व्यक्तिगत फसल सलाह',
    'Get Started': 'शुरू करें',
    'Smart Farming Solutions': 'स्मार्ट खेती समाधान',
    'Weather Forecast': 'मौसम पूर्वानुमान',
    'Hyperlocal': 'हाइपरलोकल',
    'Search': 'खोजें',
    'Get Weather': 'मौसम प्राप्त करें',
    'Detect My Location': 'मेरा स्थान पता करें',
    'Crop Recommendations': 'फसल सिफारिशें',
    'Based on your location: Punjab, India': 'आपके स्थान के आधार पर: पंजाब, भारत',
    'Soil Type: Alluvial • Climate: Semi-arid • Last Yield: Good': 'मिट्टी: जलोढ़ • जलवायु: अर्ध-शुष्क • पिछली उपज: अच्छी',
    'Get Detailed Analysis': 'विस्तृत विश्लेषण प्राप्त करें',
    'Market Prices': 'बाजार मूल्य',
    'Live Updates': 'लाइव अपडेट',
    'Enter State': 'राज्य दर्ज करें',
    'Enter District': 'जिला दर्ज करें',
    'Get Market Prices': 'बाजार मूल्य प्राप्त करें',
    'View All Markets': 'सभी बाजार देखें',
    'N': 'एन', 'P': 'पी', 'K': 'के', 'pH': 'पीएच', 'Temperature': 'तापमान', 'Humidity': 'आर्द्रता', 'Rainfall': 'वर्षा',
    'Get Recommendation': 'सिफारिश प्राप्त करें',
    'Recommended Crop:': 'अनुशंसित फसल:',
    'Error:': 'त्रुटि:',
    'AI-Powered Agricultural Advisory Platform': 'एआई-संचालित कृषि सलाह मंच',
    'Ideal conditions for irrigation today': 'आज सिंचाई के लिए आदर्श स्थिति',
    'Active Farmers': 'सक्रिय किसान',
    'Yield Increase': 'उपज वृद्धि',
    'Cost Reduction': 'लागत में कमी',
  },
  bn: {
    'AgriGuru': 'এগ্রিগুরু',
    'Empowering Farmers with AI-Driven Insights': 'কৃষকদের এআই-চালিত পরামর্শে ক্ষমতায়ন',
    'Real-time Weather & Irrigation Tips': 'রিয়েল-টাইম আবহাওয়া ও সেচ পরামর্শ',
    'Crop Yield Forecasts': 'ফসল উৎপাদন পূর্বাভাস',
    'Market Price Monitoring': 'বাজার মূল্য পর্যবেক্ষণ',
    'Personalized Crop Advisory': 'ব্যক্তিগত ফসল পরামর্শ',
    'Get Started': 'শুরু করুন',
    'Smart Farming Solutions': 'স্মার্ট কৃষি সমাধান',
    'Weather Forecast': 'আবহাওয়ার পূর্বাভাস',
    'Hyperlocal': 'হাইপারলোকাল',
    'Search': 'অনুসন্ধান',
    'Get Weather': 'আবহাওয়া পান',
    'Detect My Location': 'আমার অবস্থান নির্ধারণ করুন',
    'Crop Recommendations': 'ফসলের সুপারিশ',
    'Based on your location: Punjab, India': 'আপনার অবস্থান: পাঞ্জাব, ভারত',
    'Soil Type: Alluvial • Climate: Semi-arid • Last Yield: Good': 'মাটি: এলুভিয়াল • জলবায়ু: আধা-শুষ্ক • শেষ ফলন: ভাল',
    'Get Detailed Analysis': 'বিস্তারিত বিশ্লেষণ পান',
    'Market Prices': 'বাজার মূল্য',
    'Live Updates': 'লাইভ আপডেট',
    'Enter State': 'রাজ্য লিখুন',
    'Enter District': 'জেলা লিখুন',
    'Get Market Prices': 'বাজার মূল্য পান',
    'View All Markets': 'সব বাজার দেখুন',
    'N': 'এন', 'P': 'পি', 'K': 'কে', 'pH': 'পি-এইচ', 'Temperature': 'তাপমাত্রা', 'Humidity': 'আর্দ্রতা', 'Rainfall': 'বৃষ্টিপাত',
    'Get Recommendation': 'সুপারিশ পান',
    'Recommended Crop:': 'সুপারিশকৃত ফসল:',
    'Error:': 'ত্রুটি:',
    'AI-Powered Agricultural Advisory Platform': 'এআই-চালিত কৃষি পরামর্শ প্ল্যাটফর্ম',
    'Ideal conditions for irrigation today': 'আজ সেচের জন্য আদর্শ অবস্থা',
    'Active Farmers': 'সক্রিয় কৃষক',
    'Yield Increase': 'উৎপাদন বৃদ্ধি',
    'Cost Reduction': 'খরচ হ্রাস',
  }
};

function translatePage(lang) {
  // Translate static text elements by their textContent
  const allElements = document.querySelectorAll('body *:not(script):not(style)');
  allElements.forEach(el => {
    if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
      const original = el.textContent.trim();
      for (const key in translations.en) {
        if (original === translations.en[key] || original === translations.hi[key] || original === translations.bn[key]) {
          el.textContent = translations[lang][key];
        }
      }
    }
  });
  // Translate placeholders
  document.getElementById('cityInput').placeholder = translations[lang]['Enter city name'] || 'Enter city name';
  document.getElementById('stateInput').placeholder = translations[lang]['Enter State'] || 'Enter State';
  document.getElementById('districtInput').placeholder = translations[lang]['Enter District'] || 'Enter District';
  document.getElementById('N').placeholder = translations[lang]['N'] || 'N';
  document.getElementById('P').placeholder = translations[lang]['P'] || 'P';
  document.getElementById('K').placeholder = translations[lang]['K'] || 'K';
  document.getElementById('ph').placeholder = translations[lang]['pH'] || 'pH';
  document.getElementById('temperature').placeholder = translations[lang]['Temperature'] || 'Temperature';
  document.getElementById('humidity').placeholder = translations[lang]['Humidity'] || 'Humidity';
  document.getElementById('rainfall').placeholder = translations[lang]['Rainfall'] || 'Rainfall';
}

// Language dropdown logic
const languageSelector = document.getElementById('languageSelector');
const languageBtn = document.getElementById('languageBtn');
const languageDropdown = document.getElementById('languageDropdown');
const currentLanguage = document.getElementById('currentLanguage');

let selectedLang = 'en';
languageBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  languageSelector.classList.toggle('open');
  languageBtn.setAttribute('aria-expanded', languageSelector.classList.contains('open'));
});

document.querySelectorAll('.language-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    selectedLang = this.getAttribute('data-lang');
    currentLanguage.textContent = this.textContent;
    languageSelector.classList.remove('open');
    translatePage(selectedLang);
  });
});

document.addEventListener('click', function(e) {
  if (!languageSelector.contains(e.target)) {
    languageSelector.classList.remove('open');
    languageBtn.setAttribute('aria-expanded', 'false');
  }
});

// On page load, set default language
translatePage(selectedLang);