import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, Music, Loader2, Globe, Github, Info, AlertCircle, Clipboard, Check } from 'lucide-react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

function App() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mediaInfo, setMediaInfo] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const [platform, setPlatform] = useState(null);
    const [shake, setShake] = useState(false);
    const [toast, setToast] = useState('');

    const [videoQuality, setVideoQuality] = useState('1080p');
    const [audioQuality, setAudioQuality] = useState('320kbps');

    useEffect(() => {
        if (url.includes('youtube.com/shorts/') || url.includes('youtu.be/')) {
            setPlatform('youtube');
        } else if (url.includes('instagram.com/reel/')) {
            setPlatform('instagram');
        } else {
            setPlatform(null);
        }
    }, [url]);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const triggerShake = () => {
        setShake(true);
        setTimeout(() => setShake(false), 400);
    };

    const extractInfo = async () => {
        if (!url.trim()) return;

        if (!platform) {
            triggerShake();
            setError('Please enter a valid YouTube Shorts or Instagram Reel link.');
            return;
        }

        setLoading(true);
        setError('');
        setMediaInfo(null);

        try {
            const response = await axios.post(`${API_BASE}/info`, { url });
            setMediaInfo(response.data);
        } catch (err) {
            triggerShake();
            setError(err.response?.data?.detail || "Invalid URL or content is private/unavailable.");
        } finally {
            setLoading(false);
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setUrl(text);
            showToast("URL Pasted!");
        } catch (err) {
            showToast("Failed to read clipboard");
        }
    };

    const downloadMedia = async (type) => {
        if (!mediaInfo) return;

        setDownloading(true);
        const endpoint = type === 'video' ? 'download/video' : 'download/mp3';
        showToast(`Starting ${type.toUpperCase()} download...`);

        try {
            const response = await axios.post(`${API_BASE}/${endpoint}`, { url }, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: response.headers['content-type'] });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;

            const contentDisposition = response.headers['content-disposition'];
            let filename = `ShortGrab_${type === 'video' ? 'Video' : 'Audio'}.${type === 'video' ? 'mp4' : 'mp3'}`;
            if (contentDisposition) {
                const matches = /filename="?([^"]+)"?/.exec(contentDisposition);
                if (matches && matches[1]) filename = matches[1];
            }

            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
            showToast("Download Complete!");
        } catch (err) {
            setError("Failed to download media. Please try again.");
            showToast("Download failed");
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="app-container">
            <div className="background-blobs">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
                <div className="blob blob-3"></div>
            </div>

            <header>
                <div className="logo-container">
                    <div className="logo-mark">SG</div>
                    <div className="wordmark">ShortGrab</div>
                    <p className="tagline">Shorts & Reels. Downloaded instantly.</p>
                </div>
            </header>

            <main>
                <section className={`input-section ${shake ? 'shake' : ''}`}>
                    <div className="input-wrapper">
                        <input
                            className="url-input"
                            type="text"
                            placeholder="Paste YouTube or Instagram link here..."
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && extractInfo()}
                            disabled={loading}
                        />
                        <button className="input-icon-btn" onClick={handlePaste}>
                            <Clipboard size={22} />
                        </button>
                    </div>
                    <button
                        className="fetch-btn"
                        onClick={extractInfo}
                        disabled={loading || !url.trim()}
                    >
                        {loading ? <Loader2 className="animate-spin" /> : "Fetch Preview"}
                    </button>

                    {error && (
                        <div className="error-toast" style={{ position: 'static', transform: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            <AlertCircle size={18} />
                            <p>{error}</p>
                        </div>
                    )}
                </section>

                {loading && !mediaInfo && (
                    <section className="preview-section" style={{ marginTop: '40px' }}>
                        <div className="preview-card glass-card skeleton" style={{ height: '300px' }}></div>
                    </section>
                )}

                {mediaInfo && (
                    <section className="preview-section" style={{ marginTop: '40px' }}>
                        <div className="preview-card glass-card">
                            <div className="thumbnail-container">
                                <img
                                    className="thumbnail-img"
                                    src={`${API_BASE}/proxy-thumbnail?url=${encodeURIComponent(mediaInfo.thumbnail)}`}
                                    alt="Thumbnail"
                                    onError={(e) => e.target.style.display = 'none'}
                                />
                                <div className="duration-badge">
                                    {Math.floor(mediaInfo.duration / 60)}:{(mediaInfo.duration % 60).toString().padStart(2, '0')}
                                </div>
                                {downloading && (
                                    <div className="loading-overlay" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Loader2 className="animate-spin" size={48} color="white" />
                                    </div>
                                )}
                            </div>

                            <div className="preview-content">
                                <div className="preview-header">
                                    <div className={`platform-badge ${platform === 'youtube' ? 'badge-youtube' : 'badge-instagram'}`}>
                                        {platform === 'youtube' ? 'YouTube Shorts' : 'Instagram Reel'}
                                    </div>
                                    <h3 className="video-title">{mediaInfo.title}</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>by {mediaInfo.uploader}</p>
                                </div>

                                <div className="download-options">
                                    <div className="quality-selector">
                                        <span className="label">Video Resolution</span>
                                        <div className="segmented-control">
                                            {['720p', '1080p'].map(q => (
                                                <button
                                                    key={q}
                                                    className={`segment-btn ${videoQuality === q ? 'active' : ''}`}
                                                    onClick={() => setVideoQuality(q)}
                                                >{q}</button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="quality-selector">
                                        <span className="label">Audio Bitrate</span>
                                        <div className="segmented-control">
                                            {['128kbps', '320kbps'].map(q => (
                                                <button
                                                    key={q}
                                                    className={`segment-btn ${audioQuality === q ? 'active' : ''} secondary`}
                                                    onClick={() => setAudioQuality(q)}
                                                >{q}</button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="download-buttons">
                                        <button
                                            className="dl-btn primary"
                                            onClick={() => downloadMedia('video')}
                                            disabled={downloading}
                                        >
                                            <Download size={20} />
                                            <span>Download Video</span>
                                        </button>
                                        <button
                                            className="dl-btn secondary"
                                            onClick={() => downloadMedia('audio')}
                                            disabled={downloading}
                                        >
                                            <Music size={20} />
                                            <span>Extract MP3</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}
            </main>

            <footer>
                <p className="footer-text">© 2026 ShortGrab. Redesigned with ❤️ for Priyabrata Panda.</p>
            </footer>

            {toast && (
                <div className="toast">
                    <Check size={18} color="#2DCA72" />
                    <span>{toast}</span>
                </div>
            )}
        </div>
    );
}

export default App;
