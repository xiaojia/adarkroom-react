/**
 * AudioEngine — 音频引擎（移植自旧版 script/audio.js）
 * -----------------------------------------------------
 * 基于 Web Audio API：
 *  - playBackgroundMusic(src)：循环背景音乐（淡入淡出切换）
 *  - playEventMusic(src) / stopEventMusic()：事件背景音乐（压低主背景）
 *  - playSound(src)：一次性音效
 *  - setSceneMusic(moduleId, {fire, huts})：按模块/状态选背景音乐
 * 资源位于 public/audio/（Vite public 目录，构建后 /audio/*.flac）。
 */
import { AudioLibrary } from './audioLibrary';

const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
const pathFor = (src) => (src.indexOf('http') === 0 || src.indexOf('/') === 0 ? src : BASE + src);

// 总音量放大：FLAC 素材本身电平偏低，增益 1.0 偏小，这里拉满（约 +6dB）。
// 若个别曲目出现削波，把该值调小即可（如 1.5）。
const MASTER_GAIN = 2.0;

export const AudioEngine = {
  FADE_TIME: 1,
  AUDIO_BUFFER_CACHE: {},
  _audioContext: null,
  _master: null,
  _currentBackgroundMusic: null,
  _currentEventAudio: null,
  _currentSoundEffectAudio: null,
  _initialized: false,
  _muted: false,
  _queuedScene: null, // 未初始化前记住要播的场景音乐，init 后补播

  init() {
    if (AudioEngine._initialized) {
      AudioEngine.tryResumingAudioContext();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    AudioEngine._audioContext = new AC();
    AudioEngine._createMasterChannel();
    AudioEngine._initialized = true;
    AudioEngine.tryResumingAudioContext();
    // 补播 init 前的场景音乐
    if (AudioEngine._queuedScene) {
      const fns = AudioEngine._queuedScene;
      AudioEngine._queuedScene = null;
      AudioEngine.playBackgroundMusic(fns.src, fns.loop);
    }
  },

  /** 用户手势时调用：恢复自动播放限制挂起的上下文 */
  tryResumingAudioContext() {
    if (!AudioEngine._initialized || !AudioEngine._audioContext) return;
    if (AudioEngine._audioContext.state === 'suspended') {
      AudioEngine._audioContext.resume();
    }
  },

  isAudioContextRunning() {
    return !!AudioEngine._audioContext && AudioEngine._audioContext.state !== 'suspended';
  },

  _createMasterChannel() {
    AudioEngine._master = AudioEngine._audioContext.createGain();
    AudioEngine._master.gain.setValueAtTime(MASTER_GAIN, AudioEngine._audioContext.currentTime);
    AudioEngine._master.connect(AudioEngine._audioContext.destination);
    if (AudioEngine._muted) AudioEngine.setMasterVolume(0, 0.05);
  },

  _getMissingAudioBuffer() {
    const buffer = AudioEngine._audioContext.createBuffer(1, AudioEngine._audioContext.sampleRate, AudioEngine._audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length / 2; i++) data[i] = Math.sin(i * 0.05) / 4;
    return buffer;
  },

  _playSound(buffer) {
    if (AudioEngine._currentSoundEffectAudio && AudioEngine._currentSoundEffectAudio.source.buffer === buffer) {
      return; // 防止同一音效连续触发
    }
    const source = AudioEngine._audioContext.createBufferSource();
    source.buffer = buffer;
    source.onended = () => {
      if (AudioEngine._currentSoundEffectAudio && AudioEngine._currentSoundEffectAudio.source.buffer === buffer) {
        AudioEngine._currentSoundEffectAudio = null;
      }
    };
    source.connect(AudioEngine._master);
    source.start();
    AudioEngine._currentSoundEffectAudio = { source };
  },

  _playBackgroundMusic(buffer) {
    const source = AudioEngine._audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const envelope = AudioEngine._audioContext.createGain();
    envelope.gain.setValueAtTime(0.0, AudioEngine._audioContext.currentTime);
    const fadeTime = AudioEngine._audioContext.currentTime + AudioEngine.FADE_TIME;

    if (AudioEngine._currentBackgroundMusic && AudioEngine._currentBackgroundMusic.source) {
      const curG = AudioEngine._currentBackgroundMusic.envelope.gain.value;
      AudioEngine._currentBackgroundMusic.envelope.gain.cancelScheduledValues(AudioEngine._audioContext.currentTime);
      AudioEngine._currentBackgroundMusic.envelope.gain.setValueAtTime(curG, AudioEngine._audioContext.currentTime);
      AudioEngine._currentBackgroundMusic.envelope.gain.linearRampToValueAtTime(0.0, fadeTime);
      try { AudioEngine._currentBackgroundMusic.source.stop(fadeTime + 0.3); } catch (e) {}
    }

    source.connect(envelope);
    envelope.connect(AudioEngine._master);
    source.start();
    envelope.gain.linearRampToValueAtTime(1.0, fadeTime);

    AudioEngine._currentBackgroundMusic = { source, envelope };
  },

  _playEventMusic(buffer) {
    const source = AudioEngine._audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const envelope = AudioEngine._audioContext.createGain();
    envelope.gain.setValueAtTime(0.0, AudioEngine._audioContext.currentTime);
    const fadeTime = AudioEngine._audioContext.currentTime + AudioEngine.FADE_TIME * 2;

    if (AudioEngine._currentBackgroundMusic != null) {
      const curG = AudioEngine._currentBackgroundMusic.envelope.gain.value;
      AudioEngine._currentBackgroundMusic.envelope.gain.cancelScheduledValues(AudioEngine._audioContext.currentTime);
      AudioEngine._currentBackgroundMusic.envelope.gain.setValueAtTime(curG, AudioEngine._audioContext.currentTime);
      AudioEngine._currentBackgroundMusic.envelope.gain.linearRampToValueAtTime(0.2, fadeTime);
    }

    source.connect(envelope);
    envelope.connect(AudioEngine._master);
    source.start();
    envelope.gain.linearRampToValueAtTime(1.0, fadeTime);

    AudioEngine._currentEventAudio = { source, envelope };
  },

  _stopEventMusic() {
    const fadeTime = AudioEngine._audioContext.currentTime + AudioEngine.FADE_TIME * 2;
    if (AudioEngine._currentEventAudio && AudioEngine._currentEventAudio.source) {
      const curG = AudioEngine._currentEventAudio.envelope.gain.value;
      AudioEngine._currentEventAudio.envelope.gain.cancelScheduledValues(AudioEngine._audioContext.currentTime);
      AudioEngine._currentEventAudio.envelope.gain.setValueAtTime(curG, AudioEngine._audioContext.currentTime);
      AudioEngine._currentEventAudio.envelope.gain.linearRampToValueAtTime(0.0, fadeTime);
      try { AudioEngine._currentEventAudio.source.stop(fadeTime + 1); } catch (e) {}
      AudioEngine._currentEventAudio = null;
    }
    if (AudioEngine._currentBackgroundMusic) {
      const curG = AudioEngine._currentBackgroundMusic.envelope.gain.value;
      AudioEngine._currentBackgroundMusic.envelope.gain.cancelScheduledValues(AudioEngine._audioContext.currentTime);
      AudioEngine._currentBackgroundMusic.envelope.gain.setValueAtTime(curG, AudioEngine._audioContext.currentTime);
      AudioEngine._currentBackgroundMusic.envelope.gain.linearRampToValueAtTime(1.0, fadeTime);
    }
  },

  loadAudioFile(src) {
    src = pathFor(src);
    if (AudioEngine.AUDIO_BUFFER_CACHE[src]) {
      return Promise.resolve(AudioEngine.AUDIO_BUFFER_CACHE[src]);
    }
    return fetch(src)
      .then((resp) => resp.arrayBuffer())
      .then((buffer) => {
        if (!buffer || buffer.byteLength === 0) {
          console.error('cannot load audio from ' + src);
          return AudioEngine._getMissingAudioBuffer();
        }
        return AudioEngine._audioContext.decodeAudioData(buffer).then((decoded) => {
          AudioEngine.AUDIO_BUFFER_CACHE[src] = decoded;
          return decoded;
        }).catch(() => AudioEngine._getMissingAudioBuffer());
      });
  },

  /** 播放场景背景音乐（按模块/火势/村庄规模选择），参数：loop 固定 true */
  setSceneMusic(moduleId, opts = {}) {
    const L = AudioLibrary;
    let src = null;
    switch (moduleId) {
      case 'room': {
        const f = Math.max(0, opts.fire || 0);
        const arr = [L.MUSIC_FIRE_DEAD, L.MUSIC_FIRE_SMOLDERING, L.MUSIC_FIRE_FLICKERING, L.MUSIC_FIRE_BURNING, L.MUSIC_FIRE_ROARING];
        src = arr[f] || L.MUSIC_FIRE_DEAD;
        break;
      }
      case 'outside': {
        const h = Math.max(0, opts.huts || 0);
        src = h >= 20 ? L.MUSIC_RAUCOUS_VILLAGE
          : h >= 10 ? L.MUSIC_LARGE_VILLAGE
          : h >= 5 ? L.MUSIC_MODEST_VILLAGE
          : h >= 2 ? L.MUSIC_TINY_VILLAGE
          : h === 1 ? L.MUSIC_LONELY_HUT
          : L.MUSIC_SILENT_FOREST;
        break;
      }
      case 'path': src = L.MUSIC_DUSTY_PATH; break;
      case 'world': src = L.MUSIC_WORLD; break;
      case 'space': src = L.MUSIC_SPACE; break;
      case 'ship':
      case 'fabricator': src = L.MUSIC_SHIP; break;
      default: return; // 其它不切背景
    }
    AudioEngine.playBackgroundMusic(src);
  },

  playBackgroundMusic(src) {
    if (!AudioEngine._initialized) {
      AudioEngine._queuedScene = { src, loop: true };
      return;
    }
    AudioEngine.loadAudioFile(src).then((buf) => AudioEngine._playBackgroundMusic(buf));
  },

  playEventMusic(src) {
    if (!AudioEngine._initialized) return;
    AudioEngine.loadAudioFile(src).then((buf) => AudioEngine._playEventMusic(buf));
  },

  stopEventMusic() {
    if (!AudioEngine._initialized) return;
    AudioEngine._stopEventMusic();
  },

  playSound(src) {
    if (!AudioEngine._initialized) return;
    AudioEngine.loadAudioFile(src).then((buf) => AudioEngine._playSound(buf));
  },

  setBackgroundMusicVolume(volume, s) {
    if (!AudioEngine._master || !AudioEngine._currentBackgroundMusic) return;
    const t = AudioEngine._audioContext.currentTime;
    const v = volume === undefined ? 1.0 : volume;
    const fade = s === undefined ? 1.0 : s;
    const curG = AudioEngine._currentBackgroundMusic.envelope.gain.value;
    AudioEngine._currentBackgroundMusic.envelope.gain.cancelScheduledValues(t);
    AudioEngine._currentBackgroundMusic.envelope.gain.setValueAtTime(curG, t);
    AudioEngine._currentBackgroundMusic.envelope.gain.linearRampToValueAtTime(v, t + fade);
  },

  setMasterVolume(volume, s) {
    if (!AudioEngine._master) return;
    const t = AudioEngine._audioContext.currentTime;
    const v = volume === undefined ? MASTER_GAIN : volume;
    const fade = s === undefined ? 1.0 : s;
    const curG = AudioEngine._master.gain.value;
    AudioEngine._master.gain.cancelScheduledValues(t);
    AudioEngine._master.gain.setValueAtTime(curG, t);
    AudioEngine._master.gain.linearRampToValueAtTime(v, t + fade);
  },

  /** 静音开关 */
  setMuted(muted) {
    AudioEngine._muted = !!muted;
    AudioEngine.setMasterVolume(AudioEngine._muted ? 0 : MASTER_GAIN, 0.1);
  },
};

export default AudioEngine;
