import * as tf from '@tensorflow/tfjs';

const textInput = document.getElementById('text-input');
const voiceSelect = document.getElementById('voice-select');
const styleSelect = document.getElementById('style-select');
const speakBtn = document.getElementById('speak-btn');
const pauseBtn = document.getElementById('pause-btn');
const resumeBtn = document.getElementById('resume-btn');
const stopBtn = document.getElementById('stop-btn');
const downloadBtn = document.getElementById('download-btn');
const submitFeedbackBtn = document.getElementById('submit-feedback');

const accentSlider = document.getElementById('accent-slider');
const toneSlider = document.getElementById('tone-slider');
const pitchSlider = document.getElementById('pitch-slider');

let speech = null;
let audioBlob = null;
let model;

// Initialize the model
async function initModel() {
  model = tf.sequential();
  model.add(tf.layers.dense({ units: 10, inputShape: [5], activation: 'relu' }));
  model.add(tf.layers.dense({ units: 3, activation: 'sigmoid' }));
  model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
}

initModel();

function loadVoices() {
  const voices = speechSynthesis.getVoices();
  voiceSelect.innerHTML = '<option value="">Select a voice</option>';
  voices.forEach((voice, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  });
}

loadVoices();
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = loadVoices;
}

async function getAIParameters(style, text) {
  const input = tf.tensor2d([[
    styleSelect.selectedIndex,
    text.length,
    text.split(' ').length,
    text.split('.').length - 1,
    text.split('!').length - 1
  ]]);
  
  const prediction = model.predict(input);
  const [accent, tone, pitch] = await prediction.data();
  return { accent, tone, pitch };
}

async function applyVoiceStyle(utterance, style, text) {
  const { accent, tone, pitch } = await getAIParameters(style, text);
  
  utterance.pitch = 0.5 + pitch;
  utterance.rate = 0.8 + tone * 0.4;
  
  // Apply accent (this is a simplified representation)
  const voices = speechSynthesis.getVoices();
  const accentedVoice = voices[Math.floor(accent * voices.length)];
  if (accentedVoice) {
    utterance.voice = accentedVoice;
  }
}

async function speak(text) {
  return new Promise((resolve) => {
    speech = new SpeechSynthesisUtterance(text);
    
    const selectedVoice = voiceSelect.value;
    if (selectedVoice) {
      speech.voice = speechSynthesis.getVoices()[selectedVoice];
    }

    applyVoiceStyle(speech, styleSelect.value, text);

    const audioChunks = [];
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const mediaStreamDestination = audioContext.createMediaStreamDestination();
    const mediaRecorder = new MediaRecorder(mediaStreamDestination.stream);

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      downloadBtn.disabled = false;
      resolve();
    };

    mediaRecorder.start();
    speechSynthesis.speak(speech);

    speech.onend = () => {
      mediaRecorder.stop();
    };
  });
}

speakBtn.addEventListener('click', async () => {
  const text = textInput.value;
  if (text) {
    downloadBtn.disabled = true;
    await speak(text);
  }
});

pauseBtn.addEventListener('click', () => {
  if (speechSynthesis.speaking) {
    speechSynthesis.pause();
  }
});

resumeBtn.addEventListener('click', () => {
  if (speechSynthesis.paused) {
    speechSynthesis.resume();
  }
});

stopBtn.addEventListener('click', () => {
  speechSynthesis.cancel();
  downloadBtn.disabled = true;
});

downloadBtn.addEventListener('click', () => {
  if (audioBlob) {
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'speech.wav';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
  }
});

submitFeedbackBtn.addEventListener('click', async () => {
  const accent = parseInt(accentSlider.value) / 100;
  const tone = parseInt(toneSlider.value) / 100;
  const pitch = parseInt(pitchSlider.value) / 100;

  const input = tf.tensor2d([[
    styleSelect.selectedIndex,
    textInput.value.length,
    textInput.value.split(' ').length,
    textInput.value.split('.').length - 1,
    textInput.value.split('!').length - 1
  ]]);

  const target = tf.tensor2d([[accent, tone, pitch]]);

  await model.fit(input, target, { epochs: 10 });
  
  alert('Feedback submitted and model updated!');
});

setInterval(() => {
  const speaking = speechSynthesis.speaking;
  const paused = speechSynthesis.paused;
  
  speakBtn.disabled = speaking && !paused;
  pauseBtn.disabled = !speaking || paused;
  resumeBtn.disabled = !paused;
  stopBtn.disabled = !speaking;
}, 100);