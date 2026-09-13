// EmotionAI Frontend
// The frontend is served by FastAPI, so a relative API path works locally
// and after deployment without changing the URL.
const API_URL = "/predict";
const HEALTH_URL = "/health";

const form = document.getElementById("emotionForm");
const textInput = document.getElementById("textInput");
const charCount = document.getElementById("charCount");
const inputHint = document.getElementById("inputHint");
const predictBtn = document.getElementById("predictBtn");
const btnText = document.getElementById("btnText");

const errorBox = document.getElementById("errorBox");
const errorText = document.getElementById("errorText");

const resultSection = document.getElementById("resultSection");
const emotionEmoji = document.getElementById("emotionEmoji");
const emotionLabel = document.getElementById("emotionLabel");
const confidenceValue = document.getElementById("confidenceValue");
const confidenceFill = document.getElementById("confidenceFill");
const probabilityList = document.getElementById("probabilityList");
const analyzedText = document.getElementById("analyzedText");
const resetBtn = document.getElementById("resetBtn");

const serverStatus = document.getElementById("serverStatus");
const statusText = document.getElementById("statusText");

const emotionEmojis = {
    sadness: "😢",
    joy: "😄",
    love: "❤️",
    anger: "😠",
    fear: "😨",
    surprise: "😲"
};

const emotionOrder = [
    "sadness",
    "joy",
    "love",
    "anger",
    "fear",
    "surprise"
];

// Update character counter and simple client-side validation state.
textInput.addEventListener("input", () => {
    const length = textInput.value.length;
    charCount.textContent = `${length} / 2000`;

    if (textInput.value.trim().length === 0) {
        inputHint.textContent = "Enter at least 1 character";
    } else {
        inputHint.textContent = "Ready to analyze";
    }

    hideError();
});

// Example buttons.
document.querySelectorAll(".example-chip").forEach((button) => {
    button.addEventListener("click", () => {
        textInput.value = button.dataset.text;
        textInput.dispatchEvent(new Event("input"));
        textInput.focus();
    });
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = textInput.value.trim();

    // Fast client-side validation matching the Pydantic constraints.
    if (!text) {
        showError("Please enter some text before analyzing.");
        textInput.focus();
        return;
    }

    if (text.length > 2000) {
        showError("Text must be 2000 characters or fewer.");
        textInput.focus();
        return;
    }

    hideError();
    setLoading(true);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ text })
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(getApiErrorMessage(data, response.status));
        }

        renderResult(data);
    } catch (error) {
        console.error("Prediction error:", error);

        if (error instanceof TypeError) {
            showError("Unable to connect to the FastAPI server. Make sure the backend is running.");
        } else {
            showError(error.message || "Prediction failed. Please try again.");
        }
    } finally {
        setLoading(false);
    }
});

resetBtn.addEventListener("click", () => {
    resultSection.classList.add("hidden");
    textInput.focus();
    window.scrollTo({
        top: document.querySelector(".classifier-card").offsetTop - 20,
        behavior: "smooth"
    });
});

function setLoading(isLoading) {
    predictBtn.disabled = isLoading;

    if (isLoading) {
        btnText.textContent = "Analyzing...";
        predictBtn.querySelector(".btn-arrow").innerHTML = '<span class="spinner"></span>';
    } else {
        btnText.textContent = "Analyze Emotion";
        predictBtn.querySelector(".btn-arrow").textContent = "→";
    }
}

function renderResult(data) {
    const emotion = String(data.predicted_emotion || "").toLowerCase();
    const confidence = Number(data.confidence || 0);

    emotionEmoji.textContent = emotionEmojis[emotion] || "🤖";
    emotionLabel.textContent = emotion || "Unknown";

    const confidencePercent = toPercent(confidence);
    confidenceValue.textContent = `${confidencePercent.toFixed(1)}%`;

    // Reset first so the transition animates from zero.
    confidenceFill.style.width = "0%";
    requestAnimationFrame(() => {
        confidenceFill.style.width = `${confidencePercent}%`;
    });

    analyzedText.textContent = data.text || textInput.value.trim();

    renderProbabilities(data.all_probabilites || {});

    resultSection.classList.remove("hidden");

    setTimeout(() => {
        resultSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }, 80);
}

function renderProbabilities(probabilities) {
    probabilityList.innerHTML = "";

    // Keep the model's six labels in a predictable order.
    const labels = emotionOrder.filter((label) =>
        Object.prototype.hasOwnProperty.call(probabilities, label)
    );

    // Add any unexpected API labels after the known labels.
    Object.keys(probabilities).forEach((label) => {
        if (!labels.includes(label)) labels.push(label);
    });

    labels.forEach((emotion, index) => {
        const value = Number(probabilities[emotion] || 0);
        const percent = toPercent(value);

        const row = document.createElement("div");
        row.className = "probability-row";

        row.innerHTML = `
            <span class="probability-name">${escapeHtml(emotion)}</span>
            <div class="probability-track">
                <div class="probability-fill" style="width: 0%"></div>
            </div>
            <span class="probability-value">${percent.toFixed(1)}%</span>
        `;

        probabilityList.appendChild(row);

        const fill = row.querySelector(".probability-fill");
        setTimeout(() => {
            fill.style.width = `${percent}%`;
        }, 80 + index * 70);
    });
}

function toPercent(value) {
    // Your API returns probabilities between 0 and 1.
    // This also safely handles a percentage value if the backend is changed later.
    const normalized = value <= 1 ? value * 100 : value;
    return Math.min(100, Math.max(0, normalized));
}

function getApiErrorMessage(data, status) {
    if (data?.detail) {
        if (Array.isArray(data.detail)) {
            return data.detail
                .map((item) => item.msg || "Invalid input")
                .join(". ");
        }

        return String(data.detail);
    }

    if (status === 422) {
        return "The submitted text is not valid. Please check your input.";
    }

    if (status === 503) {
        return "The model is not loaded yet. Please wait a moment and try again.";
    }

    if (status >= 500) {
        return "The server encountered an error while making the prediction.";
    }

    return `Request failed with status ${status}.`;
}

function showError(message) {
    errorText.textContent = message;
    errorBox.classList.remove("hidden");
}

function hideError() {
    errorBox.classList.add("hidden");
}

// Avoid rendering unexpected API text as HTML.
function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// Check the FastAPI server when the page opens.
async function checkServerHealth() {
    try {
        const response = await fetch(HEALTH_URL, {
            method: "GET",
            headers: { "Accept": "application/json" }
        });

        const data = await response.json();

        if (response.ok && data.model_loaded) {
            serverStatus.classList.add("online");
            statusText.textContent = "Model online";
        } else if (response.ok) {
            serverStatus.classList.remove("online");
            serverStatus.classList.add("offline");
            statusText.textContent = "Model loading";
        } else {
            throw new Error("Health check failed");
        }
    } catch {
        serverStatus.classList.remove("online");
        serverStatus.classList.add("offline");
        statusText.textContent = "Server offline";
    }
}

checkServerHealth();
