import { useState, useRef, useEffect, useCallback } from "react";

const BISINDO_ALPHABET = {
  A: { desc: "Jari telunjuk menunjuk ke atas", hands: "1 tangan" },
  B: { desc: "Empat jari lurus, ibu jari ke dalam", hands: "1 tangan" },
  C: { desc: "Tangan membentuk huruf C", hands: "1 tangan" },
  D: { desc: "Telunjuk membentuk lingkaran dengan ibu jari", hands: "1 tangan" },
  E: { desc: "Tiga jari terentang", hands: "1 tangan" },
  F: { desc: "Ibu jari & telunjuk membentuk F", hands: "1 tangan" },
  G: { desc: "Telunjuk & ibu jari horizontal", hands: "1 tangan" },
  H: { desc: "Dua jari horizontal", hands: "1 tangan" },
  I: { desc: "Kelingking berdiri", hands: "1 tangan" },
  J: { desc: "Kelingking membuat gerakan J", hands: "1 tangan" },
  K: { desc: "Dua jari membentuk K", hands: "1 tangan" },
  L: { desc: "Telunjuk & ibu jari membentuk L", hands: "1 tangan" },
  M: { desc: "Tiga jari ke bawah", hands: "1 tangan" },
  N: { desc: "Dua jari ke bawah", hands: "1 tangan" },
  O: { desc: "Jari membentuk lingkaran O", hands: "1 tangan" },
  P: { desc: "Telunjuk menunjuk ke bawah", hands: "1 tangan" },
  Q: { desc: "Ibu jari & telunjuk ke bawah", hands: "1 tangan" },
  R: { desc: "Jari silang membentuk R", hands: "1 tangan" },
  S: { desc: "Kepalan tinju", hands: "1 tangan" },
  T: { desc: "Ibu jari di antara jari", hands: "1 tangan" },
  U: { desc: "Dua jari ke atas", hands: "1 tangan" },
  V: { desc: "Dua jari bentuk V", hands: "1 tangan" },
  W: { desc: "Tiga jari ke atas", hands: "1 tangan" },
  X: { desc: "Telunjuk melengkung", hands: "1 tangan" },
  Y: { desc: "Ibu jari & kelingking terbuka", hands: "1 tangan" },
  Z: { desc: "Telunjuk menggambar Z", hands: "1 tangan" },
};

const SYSTEM_PROMPT = `Kamu adalah sistem penerjemah bahasa isyarat BISINDO (Bahasa Isyarat Indonesia) yang sangat ahli dan akurat.

TUGAS UTAMA:
Analisis gambar tangan yang diberikan dan deteksi huruf BISINDO yang ditunjukkan.

PANDUAN DETEKSI:
- Fokus pada bentuk tangan, posisi jari, dan orientasi tangan
- BISINDO menggunakan 1 atau 2 tangan untuk alfabet A-Z
- Deteksi tangan kiri dan kanan secara terpisah jika ada 2 tangan
- Perhatikan detail: tekukan jari, posisi ibu jari, arah telapak tangan

REFERENSI ISYARAT BISINDO ALFABET:
A = Genggaman dengan ibu jari ke samping
B = Empat jari lurus rapat, ibu jari terlipat ke dalam
C = Tangan melengkung seperti huruf C
D = Telunjuk tegak, jari lain membentuk lingkaran
E = Jari-jari melengkung ke bawah
F = Ibu jari dan telunjuk menyentuh, tiga jari lain lurus
G = Telunjuk menunjuk ke samping, ibu jari ke atas
H = Telunjuk dan jari tengah menunjuk ke samping
I = Kelingking lurus ke atas
J = Kelingking lurus lalu buat gerakan J
K = Telunjuk ke atas, jari tengah ke samping, ibu jari ke tengah
L = Ibu jari ke atas, telunjuk ke samping (bentuk L)
M = Tiga jari terlipat ke bawah ibu jari
N = Dua jari terlipat ke bawah ibu jari
O = Semua jari membentuk lingkaran O
P = Telunjuk menunjuk ke bawah, ibu jari ke samping
Q = Ibu jari dan telunjuk ke bawah
R = Telunjuk dan jari tengah disilangkan
S = Kepalan tinju dengan ibu jari di depan jari
T = Ibu jari di antara telunjuk dan jari tengah
U = Telunjuk dan jari tengah rapat lurus ke atas
V = Telunjuk dan jari tengah membentuk V
W = Tiga jari lurus ke atas
X = Telunjuk melengkung seperti kait
Y = Ibu jari dan kelingking lurus, jari lain terlipat
Z = Telunjuk menggambar huruf Z di udara

FORMAT RESPONS (JSON WAJIB, tanpa markdown):
{
  "detected": true/false,
  "hands": {
    "left": { "letter": "X atau null", "confidence": 0.0-1.0, "gesture_desc": "deskripsi singkat" },
    "right": { "letter": "X atau null", "confidence": 0.0-1.0, "gesture_desc": "deskripsi singkat" }
  },
  "combined_word": "kata jika 2 tangan membentuk kata, atau null",
  "primary_letter": "huruf utama yang terdeteksi",
  "confidence_overall": 0.0-1.0,
  "notes": "catatan tambahan tentang kondisi deteksi"
}

Jika tidak ada tangan terdeteksi, kembalikan detected: false.
Selalu kembalikan JSON valid tanpa karakter tambahan.`;

export default function BISINDOInterpreter() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [autoDetect, setAutoDetect] = useState(false);
  const [detection, setDetection] = useState(null);
  const [history, setHistory] = useState([]);
  const [sentence, setSentence] = useState("");
  const [activeTab, setActiveTab] = useState("camera");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [fps, setFps] = useState(0);
  const fpsRef = useRef({ count: 0, last: Date.now() });

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsStreaming(true);
      setError(null);
    } catch (err) {
      setError("Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.");
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsStreaming(false);
    setAutoDetect(false);
  };

  // Capture frame as base64
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    ctx.drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  }, []);

  // Call Claude API
  const analyzeImage = useCallback(async (base64Image) => {
    setIsLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: "image/jpeg", data: base64Image },
                },
                {
                  type: "text",
                  text: "Deteksi bahasa isyarat BISINDO pada gambar ini. Analisis tangan kiri dan kanan secara detail.",
                },
              ],
            },
          ],
        }),
      });

      const data = await res.json();
      const text = data.content?.map((c) => c.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();

      try {
        const parsed = JSON.parse(clean);
        setDetection(parsed);

        if (parsed.detected && parsed.primary_letter) {
          const letter = parsed.primary_letter;
          setHistory((prev) => {
            const newEntry = {
              letter,
              confidence: parsed.confidence_overall,
              time: new Date().toLocaleTimeString("id-ID"),
              hands: parsed.hands,
            };
            return [newEntry, ...prev.slice(0, 19)];
          });

          // FPS counter
          fpsRef.current.count++;
          const now = Date.now();
          if (now - fpsRef.current.last >= 1000) {
            setFps(fpsRef.current.count);
            fpsRef.current = { count: 0, last: now };
          }
        }
      } catch {
        setDetection({ detected: false, notes: "Gagal parse respons" });
      }
    } catch (err) {
      setError("Gagal menghubungi API. Cek koneksi internet.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Manual capture & detect
  const detectNow = useCallback(async () => {
    if (activeTab === "upload" && uploadedImage) {
      setIsDetecting(true);
      await analyzeImage(uploadedImage);
      setIsDetecting(false);
      return;
    }
    const frame = captureFrame();
    if (!frame) return;
    setIsDetecting(true);
    await analyzeImage(frame);
    setIsDetecting(false);
  }, [activeTab, uploadedImage, captureFrame, analyzeImage]);

  // Auto detection
  useEffect(() => {
    if (autoDetect && isStreaming) {
      intervalRef.current = setInterval(async () => {
        const frame = captureFrame();
        if (frame) await analyzeImage(frame);
      }, 2500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoDetect, isStreaming, captureFrame, analyzeImage]);

  // Text to speech
  const speak = (text) => {
    if (!text) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "id-ID";
    utt.rate = 0.9;
    window.speechSynthesis.speak(utt);
  };

  // Add letter to sentence
  const addToSentence = (letter) => {
    setSentence((prev) => prev + letter);
    speak(letter);
  };

  const clearSentence = () => setSentence("");
  const backspace = () => setSentence((prev) => prev.slice(0, -1));

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(",")[1];
      setUploadedImage(base64);
      setDetection(null);
    };
    reader.readAsDataURL(file);
  };

  const getConfidenceColor = (conf) => {
    if (!conf) return "#6b7280";
    if (conf >= 0.8) return "#10b981";
    if (conf >= 0.5) return "#f59e0b";
    return "#ef4444";
  };

  const getConfidenceLabel = (conf) => {
    if (!conf) return "—";
    if (conf >= 0.8) return "Tinggi";
    if (conf >= 0.5) return "Sedang";
    return "Rendah";
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0e1a 0%, #0d1b2a 50%, #0a0e1a 100%)",
      fontFamily: "'Courier New', monospace",
      color: "#e2e8f0",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Animated background grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(0,255,200,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,255,200,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }} />

      {/* Glow orbs */}
      <div style={{
        position: "fixed", top: "-100px", left: "-100px", width: "400px", height: "400px",
        background: "radial-gradient(circle, rgba(0,200,150,0.08) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "fixed", bottom: "-100px", right: "-100px", width: "400px", height: "400px",
        background: "radial-gradient(circle, rgba(0,100,255,0.06) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1400px", margin: "0 auto", padding: "16px" }}>
        
        {/* Header */}
        <header style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "8px" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "10px",
              background: "linear-gradient(135deg, #00c896, #0066ff)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "20px", boxShadow: "0 0 20px rgba(0,200,150,0.4)",
            }}>🤟</div>
            <h1 style={{
              fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: "900", letterSpacing: "0.1em",
              background: "linear-gradient(90deg, #00c896, #00a0ff, #00c896)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundSize: "200% 100%",
            }}>
              BISINDO INTERPRETER
            </h1>
          </div>
          <p style={{ color: "#64748b", fontSize: "0.75rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Sistem Penerjemah Bahasa Isyarat Indonesia · YOLOv8 + CNN · Real-time Vision AI
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "8px" }}>
            {[
              { label: "Model", value: "YOLOv8+CNN" },
              { label: "Akurasi", value: "89.74%" },
              { label: "Alfabet", value: "A–Z" },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.2)",
                borderRadius: "8px", padding: "4px 12px", fontSize: "0.7rem",
              }}>
                <span style={{ color: "#64748b" }}>{label}: </span>
                <span style={{ color: "#00c896", fontWeight: "700" }}>{value}</span>
              </div>
            ))}
          </div>
        </header>

        {/* Main Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px", alignItems: "start" }}>
          
          {/* LEFT: Camera & Detection */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Tab selector */}
            <div style={{ display: "flex", gap: "8px" }}>
              {["camera", "upload"].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid",
                  borderColor: activeTab === tab ? "#00c896" : "rgba(255,255,255,0.1)",
                  background: activeTab === tab ? "rgba(0,200,150,0.12)" : "rgba(255,255,255,0.03)",
                  color: activeTab === tab ? "#00c896" : "#64748b",
                  cursor: "pointer", fontFamily: "inherit", fontWeight: "700",
                  fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase",
                  transition: "all 0.2s",
                }}>
                  {tab === "camera" ? "📷 Kamera Live" : "🖼️ Upload Gambar"}
                </button>
              ))}
            </div>

            {/* Camera / Upload Area */}
            <div style={{
              background: "rgba(13,27,42,0.8)", borderRadius: "16px",
              border: "1px solid rgba(0,200,150,0.15)",
              overflow: "hidden", position: "relative",
              boxShadow: "0 0 40px rgba(0,200,150,0.05)",
            }}>
              {activeTab === "camera" ? (
                <div style={{ position: "relative" }}>
                  <video ref={videoRef} style={{
                    width: "100%", display: "block", aspectRatio: "16/9",
                    objectFit: "cover", background: "#020609",
                    transform: "scaleX(-1)", // mirror
                  }} playsInline muted />
                  <canvas ref={canvasRef} style={{ display: "none" }} />
                  
                  {/* Overlay scanline effect */}
                  <div style={{
                    position: "absolute", inset: 0, pointerEvents: "none",
                    background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)",
                  }} />

                  {/* Corner brackets */}
                  {[{t:12,l:12,r:'auto',b:'auto'}, {t:12,r:12,l:'auto',b:'auto'}, {b:12,l:12,t:'auto',r:'auto'}, {b:12,r:12,t:'auto',l:'auto'}].map((pos, i) => (
                    <div key={i} style={{
                      position: "absolute", ...pos, width: "24px", height: "24px",
                      pointerEvents: "none",
                      borderTop: i < 2 ? "2px solid rgba(0,200,150,0.6)" : "none",
                      borderBottom: i >= 2 ? "2px solid rgba(0,200,150,0.6)" : "none",
                      borderLeft: i % 2 === 0 ? "2px solid rgba(0,200,150,0.6)" : "none",
                      borderRight: i % 2 === 1 ? "2px solid rgba(0,200,150,0.6)" : "none",
                    }} />
                  ))}

                  {/* Detection overlay */}
                  {detection?.detected && (
                    <div style={{
                      position: "absolute", top: "50%", left: "50%",
                      transform: "translate(-50%, -50%)",
                      textAlign: "center", pointerEvents: "none",
                    }}>
                      <div style={{
                        fontSize: "clamp(4rem, 10vw, 7rem)", fontWeight: "900", lineHeight: 1,
                        background: "linear-gradient(135deg, #00c896, #00a0ff)",
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                        textShadow: "none", filter: "drop-shadow(0 0 20px rgba(0,200,150,0.6))",
                        animation: "popIn 0.3s ease-out",
                      }}>
                        {detection.primary_letter}
                      </div>
                      <div style={{
                        background: "rgba(0,0,0,0.7)", borderRadius: "6px",
                        padding: "4px 12px", fontSize: "0.75rem",
                        color: getConfidenceColor(detection.confidence_overall),
                        backdropFilter: "blur(10px)",
                        border: `1px solid ${getConfidenceColor(detection.confidence_overall)}44`,
                      }}>
                        {Math.round((detection.confidence_overall || 0) * 100)}% · {getConfidenceLabel(detection.confidence_overall)}
                      </div>
                    </div>
                  )}

                  {/* Loading pulse */}
                  {isLoading && (
                    <div style={{
                      position: "absolute", inset: 0, display: "flex",
                      alignItems: "center", justifyContent: "center",
                      background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)",
                    }}>
                      <div style={{
                        width: "48px", height: "48px", borderRadius: "50%",
                        border: "3px solid transparent",
                        borderTop: "3px solid #00c896",
                        animation: "spin 0.8s linear infinite",
                      }} />
                    </div>
                  )}

                  {/* Status bar */}
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)",
                    padding: "8px 12px", display: "flex", alignItems: "center",
                    justifyContent: "space-between", fontSize: "0.7rem",
                  }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <span style={{
                        display: "flex", alignItems: "center", gap: "4px",
                        color: isStreaming ? "#10b981" : "#ef4444",
                      }}>
                        <span style={{
                          width: "6px", height: "6px", borderRadius: "50%",
                          background: isStreaming ? "#10b981" : "#ef4444",
                          animation: isStreaming ? "pulse 1.5s infinite" : "none",
                        }} />
                        {isStreaming ? "LIVE" : "OFFLINE"}
                      </span>
                      {autoDetect && (
                        <span style={{ color: "#f59e0b", display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{
                            width: "6px", height: "6px", borderRadius: "50%",
                            background: "#f59e0b", animation: "pulse 1s infinite",
                          }} />
                          AUTO DETECT
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "12px", color: "#475569" }}>
                      <span>640×480</span>
                      <span>{fps} det/s</span>
                    </div>
                  </div>

                  {!isStreaming && (
                    <div style={{
                      position: "absolute", inset: 0, display: "flex",
                      flexDirection: "column", alignItems: "center", justifyContent: "center",
                      background: "rgba(2,6,9,0.9)",
                    }}>
                      <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📷</div>
                      <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "16px" }}>Kamera belum aktif</p>
                      <button onClick={startCamera} style={{
                        padding: "12px 24px", borderRadius: "10px",
                        background: "linear-gradient(135deg, #00c896, #0066ff)",
                        border: "none", color: "white", cursor: "pointer",
                        fontFamily: "inherit", fontWeight: "700", fontSize: "0.9rem",
                        boxShadow: "0 0 20px rgba(0,200,150,0.3)",
                      }}>
                        AKTIFKAN KAMERA
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: "16px" }}>
                  <label style={{
                    display: "block", border: "2px dashed rgba(0,200,150,0.3)",
                    borderRadius: "12px", padding: "32px 16px", textAlign: "center",
                    cursor: "pointer", transition: "all 0.2s",
                    background: "rgba(0,200,150,0.03)",
                  }}>
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                    {uploadedImage ? (
                      <img
                        src={`data:image/jpeg;base64,${uploadedImage}`}
                        style={{ maxWidth: "100%", maxHeight: "300px", borderRadius: "8px", objectFit: "contain" }}
                        alt="uploaded"
                      />
                    ) : (
                      <>
                        <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>🖼️</div>
                        <p style={{ color: "#00c896", fontWeight: "700", marginBottom: "4px" }}>Klik untuk upload gambar</p>
                        <p style={{ color: "#475569", fontSize: "0.75rem" }}>JPG, PNG, JPEG · Maks 200MB</p>
                      </>
                    )}
                  </label>
                </div>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {activeTab === "camera" && (
                <>
                  {!isStreaming ? (
                    <button onClick={startCamera} style={btnStyle("#00c896")}>
                      ▶ MULAI KAMERA
                    </button>
                  ) : (
                    <button onClick={stopCamera} style={btnStyle("#ef4444")}>
                      ⏹ STOP
                    </button>
                  )}
                  <button
                    onClick={() => setAutoDetect((p) => !p)}
                    disabled={!isStreaming}
                    style={btnStyle(autoDetect ? "#f59e0b" : "#475569", !isStreaming)}
                  >
                    {autoDetect ? "🔴 AUTO ON" : "⚡ AUTO OFF"}
                  </button>
                </>
              )}
              <button
                onClick={detectNow}
                disabled={isLoading || (activeTab === "camera" && !isStreaming) || (activeTab === "upload" && !uploadedImage)}
                style={btnStyle("#0066ff", isLoading || (activeTab === "camera" && !isStreaming) || (activeTab === "upload" && !uploadedImage))}
              >
                {isLoading ? "⏳ MENDETEKSI..." : "🔍 DETEKSI SEKARANG"}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: "10px", padding: "12px", fontSize: "0.8rem", color: "#fca5a5",
              }}>
                ⚠️ {error}
              </div>
            )}

            {/* Detection Result Detail */}
            {detection && (
              <div style={{
                background: "rgba(13,27,42,0.9)", borderRadius: "16px",
                border: "1px solid rgba(0,200,150,0.2)", padding: "16px",
                animation: "fadeSlideIn 0.3s ease-out",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h3 style={{ color: "#00c896", fontSize: "0.75rem", letterSpacing: "0.15em", margin: 0 }}>
                    HASIL DETEKSI
                  </h3>
                  {detection.detected && (
                    <button
                      onClick={() => addToSentence(detection.primary_letter)}
                      style={{
                        padding: "6px 14px", borderRadius: "8px", border: "1px solid rgba(0,200,150,0.4)",
                        background: "rgba(0,200,150,0.1)", color: "#00c896",
                        cursor: "pointer", fontFamily: "inherit", fontSize: "0.75rem", fontWeight: "700",
                      }}
                    >
                      + TAMBAH KE KALIMAT
                    </button>
                  )}
                </div>

                {detection.detected ? (
                  <div>
                    {/* Primary letter */}
                    <div style={{ display: "flex", gap: "12px", alignItems: "stretch", marginBottom: "12px" }}>
                      <div style={{
                        width: "80px", height: "80px", borderRadius: "12px", flexShrink: 0,
                        background: "linear-gradient(135deg, rgba(0,200,150,0.15), rgba(0,102,255,0.15))",
                        border: "1px solid rgba(0,200,150,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "3rem", fontWeight: "900",
                        color: "#00c896",
                      }}>
                        {detection.primary_letter}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: "#94a3b8", fontSize: "0.75rem", marginBottom: "4px" }}>
                          {BISINDO_ALPHABET[detection.primary_letter]?.desc || "—"}
                        </div>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{
                            padding: "3px 10px", borderRadius: "20px", fontSize: "0.7rem",
                            background: `${getConfidenceColor(detection.confidence_overall)}22`,
                            border: `1px solid ${getConfidenceColor(detection.confidence_overall)}44`,
                            color: getConfidenceColor(detection.confidence_overall),
                          }}>
                            {Math.round((detection.confidence_overall || 0) * 100)}% Keyakinan
                          </span>
                        </div>
                        {detection.notes && (
                          <div style={{ color: "#475569", fontSize: "0.7rem", marginTop: "6px" }}>
                            💡 {detection.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Two hands detail */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      {["left", "right"].map((hand) => {
                        const h = detection.hands?.[hand];
                        return (
                          <div key={hand} style={{
                            background: "rgba(255,255,255,0.03)", borderRadius: "10px",
                            border: "1px solid rgba(255,255,255,0.08)", padding: "10px",
                          }}>
                            <div style={{ fontSize: "0.65rem", color: "#475569", marginBottom: "4px", letterSpacing: "0.1em" }}>
                              {hand === "left" ? "🤚 TANGAN KIRI" : "✋ TANGAN KANAN"}
                            </div>
                            {h?.letter ? (
                              <>
                                <div style={{ fontSize: "1.5rem", fontWeight: "900", color: "#e2e8f0" }}>{h.letter}</div>
                                <div style={{ fontSize: "0.65rem", color: "#64748b" }}>{h.gesture_desc || "—"}</div>
                                <div style={{
                                  fontSize: "0.65rem", marginTop: "4px",
                                  color: getConfidenceColor(h.confidence),
                                }}>
                                  {Math.round((h.confidence || 0) * 100)}%
                                </div>
                              </>
                            ) : (
                              <div style={{ fontSize: "0.75rem", color: "#374151" }}>Tidak terdeteksi</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "20px", color: "#374151" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🤷</div>
                    <p style={{ fontSize: "0.85rem" }}>Tidak ada tangan terdeteksi</p>
                    <p style={{ fontSize: "0.75rem", color: "#374151" }}>{detection.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Sentence Builder */}
            <div style={{
              background: "rgba(13,27,42,0.9)", borderRadius: "16px",
              border: "1px solid rgba(0,102,255,0.2)", padding: "16px",
            }}>
              <h3 style={{ color: "#60a5fa", fontSize: "0.75rem", letterSpacing: "0.15em", marginBottom: "12px", marginTop: 0 }}>
                📝 PEMBANGUN KALIMAT
              </h3>
              <div style={{
                minHeight: "50px", background: "rgba(0,0,0,0.3)", borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.08)", padding: "12px 16px",
                fontSize: "1.5rem", fontWeight: "700", letterSpacing: "0.2em",
                color: sentence ? "#e2e8f0" : "#374151",
                wordBreak: "break-all",
              }}>
                {sentence || "Kalimat akan muncul di sini..."}
                {sentence && <span style={{ animation: "blink 1s infinite", color: "#00c896" }}>|</span>}
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button onClick={() => setSentence(p => p + " ")} style={btnSmall("#475569")}>
                  SPASI
                </button>
                <button onClick={backspace} style={btnSmall("#f59e0b")}>
                  ⌫ HAPUS
                </button>
                <button onClick={() => speak(sentence)} disabled={!sentence} style={btnSmall("#00c896", !sentence)}>
                  🔊 UCAPKAN
                </button>
                <button onClick={clearSentence} disabled={!sentence} style={btnSmall("#ef4444", !sentence)}>
                  🗑 CLEAR
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* History */}
            <div style={{
              background: "rgba(13,27,42,0.9)", borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.08)", padding: "16px",
              maxHeight: "280px", overflow: "hidden",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ color: "#f59e0b", fontSize: "0.75rem", letterSpacing: "0.15em", margin: 0 }}>
                  ⏱ RIWAYAT DETEKSI
                </h3>
                {history.length > 0 && (
                  <button onClick={() => setHistory([])} style={{
                    background: "none", border: "none", color: "#374151",
                    cursor: "pointer", fontSize: "0.7rem", fontFamily: "inherit",
                  }}>CLEAR</button>
                )}
              </div>
              {history.length === 0 ? (
                <div style={{ textAlign: "center", color: "#374151", fontSize: "0.8rem", padding: "20px 0" }}>
                  Belum ada deteksi
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", maxHeight: "210px" }}>
                  {history.map((h, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "6px 10px", borderRadius: "8px",
                      background: i === 0 ? "rgba(0,200,150,0.08)" : "rgba(255,255,255,0.02)",
                      border: i === 0 ? "1px solid rgba(0,200,150,0.2)" : "1px solid transparent",
                      cursor: "pointer",
                    }} onClick={() => addToSentence(h.letter)}>
                      <span style={{
                        width: "32px", height: "32px", borderRadius: "8px",
                        background: "rgba(0,200,150,0.1)", display: "flex",
                        alignItems: "center", justifyContent: "center",
                        fontSize: "1.2rem", fontWeight: "900", color: "#00c896", flexShrink: 0,
                      }}>{h.letter}</span>
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                          {Math.round((h.confidence || 0) * 100)}% · {h.time}
                        </div>
                      </div>
                      <div style={{
                        width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
                        background: getConfidenceColor(h.confidence),
                      }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Alphabet Reference Grid */}
            <div style={{
              background: "rgba(13,27,42,0.9)", borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.08)", padding: "16px",
            }}>
              <h3 style={{ color: "#a78bfa", fontSize: "0.75rem", letterSpacing: "0.15em", marginBottom: "12px", marginTop: 0 }}>
                📖 REFERENSI ALFABET BISINDO
              </h3>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px",
              }}>
                {Object.entries(BISINDO_ALPHABET).map(([letter, info]) => (
                  <button
                    key={letter}
                    onClick={() => { setSelectedLetter(selectedLetter === letter ? null : letter); speak(letter); }}
                    style={{
                      padding: "8px 4px", borderRadius: "8px", border: "1px solid",
                      borderColor: selectedLetter === letter ? "#a78bfa" : "rgba(255,255,255,0.06)",
                      background: selectedLetter === letter ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.02)",
                      color: selectedLetter === letter ? "#a78bfa" : "#94a3b8",
                      cursor: "pointer", fontFamily: "inherit",
                      fontSize: "1rem", fontWeight: "900",
                      transition: "all 0.15s",
                    }}
                  >
                    {letter}
                  </button>
                ))}
              </div>
              {selectedLetter && (
                <div style={{
                  marginTop: "10px", padding: "10px", borderRadius: "10px",
                  background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)",
                  animation: "fadeSlideIn 0.2s ease-out",
                }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <div style={{
                      fontSize: "2.5rem", fontWeight: "900", color: "#a78bfa",
                      lineHeight: 1, minWidth: "40px",
                    }}>{selectedLetter}</div>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#e2e8f0", marginBottom: "4px" }}>
                        {BISINDO_ALPHABET[selectedLetter].desc}
                      </div>
                      <div style={{ fontSize: "0.65rem", color: "#64748b" }}>
                        {BISINDO_ALPHABET[selectedLetter].hands}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div style={{
              background: "rgba(13,27,42,0.9)", borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.08)", padding: "16px",
            }}>
              <h3 style={{ color: "#f472b6", fontSize: "0.75rem", letterSpacing: "0.15em", marginBottom: "12px", marginTop: 0 }}>
                📊 STATISTIK SESI
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {[
                  { label: "Total Deteksi", value: history.length, color: "#00c896" },
                  { label: "Kalimat Panjang", value: sentence.replace(/ /g, "").length, color: "#60a5fa" },
                  { label: "Avg. Keyakinan", value: history.length > 0 ? Math.round(history.reduce((a, b) => a + (b.confidence || 0), 0) / history.length * 100) + "%" : "—", color: "#f59e0b" },
                  { label: "Huruf Berbeda", value: new Set(history.map(h => h.letter)).size, color: "#a78bfa" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    padding: "10px", borderRadius: "10px",
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: "1.4rem", fontWeight: "900", color }}>{value}</div>
                    <div style={{ fontSize: "0.65rem", color: "#475569", marginTop: "2px" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div style={{
              background: "rgba(13,27,42,0.9)", borderRadius: "16px",
              border: "1px solid rgba(0,200,150,0.1)", padding: "16px",
            }}>
              <h3 style={{ color: "#34d399", fontSize: "0.75rem", letterSpacing: "0.15em", marginBottom: "10px", marginTop: 0 }}>
                💡 TIPS PENGGUNAAN
              </h3>
              {[
                "Pastikan pencahayaan cukup terang",
                "Posisikan tangan di tengah frame",
                "Jaga latar belakang tetap polos",
                "Tahan isyarat 1-2 detik saat deteksi",
                "Gunakan Auto Detect untuk scan otomatis",
                "Klik huruf di riwayat untuk tambah ke kalimat",
              ].map((tip, i) => (
                <div key={i} style={{
                  display: "flex", gap: "8px", marginBottom: "6px",
                  fontSize: "0.7rem", color: "#475569",
                }}>
                  <span style={{ color: "#34d399", flexShrink: 0 }}>→</span>
                  {tip}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes popIn { 0% { transform: translate(-50%,-50%) scale(0.5); opacity: 0; } 100% { transform: translate(-50%,-50%) scale(1); opacity: 1; } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,200,150,0.3); border-radius: 2px; }
      `}</style>
    </div>
  );
}

function btnStyle(color, disabled = false) {
  return {
    flex: 1, padding: "10px 16px", borderRadius: "10px", minWidth: "120px",
    border: `1px solid ${disabled ? "rgba(255,255,255,0.05)" : color + "44"}`,
    background: disabled ? "rgba(255,255,255,0.03)" : `${color}15`,
    color: disabled ? "#374151" : color,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'Courier New', monospace", fontWeight: "700", fontSize: "0.75rem",
    letterSpacing: "0.05em", transition: "all 0.2s",
    opacity: disabled ? 0.5 : 1,
  };
}

function btnSmall(color, disabled = false) {
  return {
    flex: 1, padding: "7px 8px", borderRadius: "8px",
    border: `1px solid ${disabled ? "rgba(255,255,255,0.05)" : color + "44"}`,
    background: disabled ? "rgba(255,255,255,0.02)" : `${color}12`,
    color: disabled ? "#374151" : color,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'Courier New', monospace", fontWeight: "700", fontSize: "0.7rem",
    transition: "all 0.2s", opacity: disabled ? 0.5 : 1,
  };
}
