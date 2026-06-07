// #book-ref ch22-multimodal/web/src/components/MultimodalInput.tsx

import { useRef, useState } from 'react';
import { getToken } from '../lib/api.js';

type Mode = 'image' | 'audio';

interface AnalysisResult {
  type: Mode;
  text: string;
  audioUrl?: string;
}

export function MultimodalInput() {
  const [mode, setMode] = useState<Mode>('image');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ttsText, setTtsText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const ALLOWED_IMAGE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
  ];

  async function handleImageUpload(file: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      alert('Only PNG, JPEG, GIF, and WebP images are supported');
      return;
    }
    setLoading(true);
    setPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append('image', file);
    formData.append('task', 'general');
    formData.append('prompt', 'Please describe this image in detail');

    const res = await fetch('/api/vision/analyze', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });

    const data = await res.json();
    setResult({ type: 'image', text: data.result });
    setLoading(false);
  }

  async function handleAudioUpload(file: File) {
    setLoading(true);

    const formData = new FormData();
    formData.append('audio', file);
    // Leave empty for auto language detection, or specify e.g. 'en', 'ja'
    // formData.append('language', 'en');

    const res = await fetch('/api/speech/transcribe', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });

    const data = await res.json();
    setResult({ type: 'audio', text: data.text });
    setLoading(false);
  }

  async function handleTTS() {
    if (!ttsText.trim()) return;
    setLoading(true);

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ text: ttsText, voice: 'nova' }),
    });

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    setResult({ type: 'audio', text: ttsText, audioUrl: url });

    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.play();
    }

    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1rem' }}>
      <h2>Multimodal AI</h2>

      {/* Mode switch */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['image', 'audio'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setResult(null);
              setPreview(null);
            }}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: '1px solid',
              borderColor: mode === m ? '#2563eb' : '#d1d5db',
              background: mode === m ? '#2563eb' : '#fff',
              color: mode === m ? '#fff' : '#374151',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {m === 'image' ? '🖼️ Image Analysis' : '🎙️ Speech Recognition'}
          </button>
        ))}
      </div>

      {/* Image mode */}
      {mode === 'image' && (
        <div>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleImageUpload(file);
            }}
            onDragOver={(e) => e.preventDefault()}
            style={{
              border: '2px dashed #d1d5db',
              borderRadius: 12,
              padding: 40,
              textAlign: 'center',
              cursor: 'pointer',
              marginBottom: 16,
              background: preview ? 'transparent' : '#f9fafb',
            }}
          >
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                style={{ maxHeight: 300, maxWidth: '100%', borderRadius: 8 }}
              />
            ) : (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
                <div style={{ color: '#6b7280' }}>
                  Click or drag an image to upload
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                  Supports PNG, JPEG, GIF, WebP — max 5MB
                </div>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }}
          />
        </div>
      )}

      {/* Audio mode */}
      {mode === 'audio' && (
        <div>
          {/* Speech recognition */}
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Speech to Text</h3>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAudioUpload(file);
              }}
              style={{ marginBottom: 8 }}
            />
          </div>

          {/* Text-to-speech */}
          <div>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Text to Speech</h3>
            <textarea
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              placeholder="Enter text to convert to speech..."
              rows={4}
              style={{
                width: '100%',
                padding: 8,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleTTS}
              disabled={loading || !ttsText.trim()}
              style={{
                marginTop: 8,
                padding: '8px 16px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {loading ? 'Generating...' : '🔊 Generate Speech'}
            </button>
            <audio
              ref={audioRef}
              controls
              style={{ marginTop: 12, width: '100%' }}
            />
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
          ⏳ AI analyzing...
        </div>
      )}

      {/* Result display */}
      {result && !loading && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            fontSize: 14,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
          }}
        >
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
            {result.type === 'image'
              ? 'Image analysis result'
              : 'Speech recognition result'}
          </div>
          {result.text}
        </div>
      )}
    </div>
  );
}
