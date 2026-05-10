import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowLeft,
  Send,
  Clock3,
  MessageSquare,
  CheckCheck,
  ShieldCheck,
  Sparkles,
  Inbox,
  ChevronRight,
  Wifi,
  WifiOff,
} from "lucide-react";
import { auth } from "../firebase";

const API_BASE = "https://urban-ease-theta.vercel.app";

/* ─────────────────────────────────────────────────────────────────────────────
   GLOBAL STYLES  (injected once)
───────────────────────────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #f7f8fc;
    --surface:   #ffffff;
    --surface2:  #f0f2f8;
    --border:    rgba(0,0,0,0.07);
    --border-hi: rgba(0,0,0,0.12);
    --accent:    #6c63ff;
    --accent2:   #ff6b9d;
    --accent3:   #00b894;
    --text:      #111827;
    --muted:     #6b7280;
    --muted2:    #d1d5db;
    --user-msg:  #6c63ff;
    --radius-xl: 24px;
    --radius-lg: 16px;
    --radius-md: 12px;
    --font-head: 'Syne', sans-serif;
    --font-body: 'DM Sans', sans-serif;
    --shadow-glow: 0 0 40px rgba(108,99,255,0.12);
    --shadow-card: 0 2px 16px rgba(0,0,0,0.08);
    --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  html, body, #root { height: 100%; }

  /* scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 99px; }

  /* keyframes */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; } to { opacity: 1; }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-24px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(24px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.92); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes pulse-ring {
    0%   { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(108,99,255,0.5); }
    70%  { transform: scale(1);    box-shadow: 0 0 0 10px rgba(108,99,255,0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(108,99,255,0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }
  @keyframes bounce-dot {
    0%, 80%, 100% { transform: scale(0); }
    40%           { transform: scale(1); }
  }
  @keyframes gradient-shift {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-8px); }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes ripple {
    from { transform: scale(0); opacity: 0.6; }
    to   { transform: scale(2.5); opacity: 0; }
  }
  @keyframes statusPulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }

  /* ticket card hover */
  .ticket-card {
    transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition), background var(--transition);
    position: relative;
    overflow: hidden;
  }
  .ticket-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(108,99,255,0.08) 0%, transparent 60%);
    opacity: 0;
    transition: opacity var(--transition);
    pointer-events: none;
  }
  .ticket-card:hover::before { opacity: 1; }
  .ticket-card:hover {
    transform: translateY(-2px) scale(1.005);
    box-shadow: 0 8px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(108,99,255,0.2);
  }
  .ticket-card.selected {
    background: linear-gradient(135deg, #6c63ff 0%, #8b5cf6 100%) !important;
    border-color: transparent !important;
    box-shadow: 0 8px 32px rgba(108,99,255,0.35), var(--shadow-glow);
  }
  .ticket-card.selected:hover {
    transform: translateY(-2px) scale(1.008);
    box-shadow: 0 12px 40px rgba(108,99,255,0.3), var(--shadow-glow);
  }

  /* send button */
  .send-btn {
    transition: transform var(--transition), box-shadow var(--transition), background var(--transition);
    position: relative;
    overflow: hidden;
  }
  .send-btn:not(:disabled):hover {
    transform: scale(1.08);
    box-shadow: 0 4px 20px rgba(108,99,255,0.5);
  }
  .send-btn:not(:disabled):active {
    transform: scale(0.95);
  }
  .send-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 70%);
    opacity: 0;
    transition: opacity 0.15s;
  }
  .send-btn:not(:disabled):active::after { opacity: 1; }

  /* message bubble */
  .msg-bubble {
    animation: fadeUp 0.3s ease both;
    transition: transform 0.2s ease;
  }
  .msg-bubble:hover { transform: scale(1.01); }

  /* textarea */
  .msg-input {
    transition: border-color var(--transition), box-shadow var(--transition);
  }
  .msg-input:focus {
    border-color: var(--accent) !important;
    box-shadow: 0 0 0 3px rgba(108,99,255,0.15), 0 2px 8px rgba(0,0,0,0.3);
    outline: none;
  }

  /* back button */
  .back-btn {
    transition: transform var(--transition), background var(--transition);
    border-radius: 10px;
    padding: 6px;
  }
  .back-btn:hover {
    transform: translateX(-3px);
    background: rgba(255,255,255,0.07);
  }

  /* shimmer skeleton */
  .skeleton {
    background: linear-gradient(90deg, #f0f2f8 25%, #e5e7eb 50%, #f0f2f8 75%);
    background-size: 200% 100%;
    animation: shimmer 1.6s infinite;
  }

  /* typing dots */
  .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--muted); margin: 0 2px; }
  .dot:nth-child(1) { animation: bounce-dot 1.4s ease-in-out 0s infinite; }
  .dot:nth-child(2) { animation: bounce-dot 1.4s ease-in-out 0.2s infinite; }
  .dot:nth-child(3) { animation: bounce-dot 1.4s ease-in-out 0.4s infinite; }

  /* noise overlay */
  .noise::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E");
    pointer-events: none;
    opacity: 0.6;
  }

  /* status badge */
  .status-badge {
    backdrop-filter: blur(8px);
    transition: transform var(--transition);
  }
  .status-badge:hover { transform: scale(1.05); }
`;

/* ─────────────────────────────────────────────────────────────────────────────
   STATUS CONFIG
───────────────────────────────────────────────────────────────────────────── */
const STATUS_MAP = {
  resolved:    { bg: "rgba(0,212,170,0.12)",  color: "#00d4aa", dot: "#00d4aa" },
  closed:      { bg: "rgba(107,107,128,0.15)", color: "#9ca3af", dot: "#9ca3af" },
  in_progress: { bg: "rgba(108,99,255,0.15)", color: "#a78bfa", dot: "#8b5cf6" },
  open:        { bg: "rgba(255,107,157,0.12)", color: "#ff6b9d", dot: "#ff6b9d" },
};
const getStatus = (s) => STATUS_MAP[s] || STATUS_MAP.open;

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────────────────────────────── */
const HelpCenter = () => {
  const [token, setToken] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [newMsgIds, setNewMsgIds] = useState(new Set());

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  /* inject global CSS once */
  useEffect(() => {
    if (document.getElementById("hc-styles")) return;
    const tag = document.createElement("style");
    tag.id = "hc-styles";
    tag.textContent = GLOBAL_CSS;
    document.head.appendChild(tag);
  }, []);

  /* online/offline */
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  /* firebase auth */
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const t = await user.getIdToken(true);
        localStorage.setItem("firebase_token", t);
        setToken(t);
      } else {
        setToken(null);
        setLoadingTickets(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => { if (token) fetchTickets(token); }, [token]);

  /* ── API ── */
  const hdrs = useCallback(
    (t) => ({ Authorization: `Bearer ${t ?? token}`, "Content-Type": "application/json" }),
    [token]
  );

  const fetchTickets = async (t) => {
    try {
      setLoadingTickets(true);
      const res = await fetch(`${API_BASE}/api/support/my-tickets`, { headers: hdrs(t) });
      const data = await res.json();
      setTickets(data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingTickets(false); }
  };

  const fetchMessages = async (ticketId, silent = false) => {
    try {
      if (!silent) setLoadingMessages(true);
      const res = await fetch(`${API_BASE}/api/support/${ticketId}/messages`, { headers: hdrs() });
      const data = await res.json();
      const incoming = data.messages || [];

      setMessages((prev) => {
        const prevIds = new Set(prev.map((m) => m.id));
        const freshIds = new Set();
        incoming.forEach((m) => { if (!prevIds.has(m.id)) freshIds.add(m.id); });
        if (freshIds.size > 0) setNewMsgIds(freshIds);

        if (
          prev.length === incoming.length &&
          prev[prev.length - 1]?.id === incoming[incoming.length - 1]?.id
        ) return prev;
        return incoming;
      });

      await fetch(`${API_BASE}/api/support/${ticketId}/read`, { method: "POST", headers: hdrs() });
    } catch (e) { console.error(e); }
    finally { if (!silent) setLoadingMessages(false); }
  };

  const openTicket = async (ticket) => {
    setSelectedTicket(ticket);
    setMobileChat(true);
    setMessages([]);
    await fetchMessages(ticket.id);
  };

  const sendMessage = async () => {
    if (!message.trim() || sending) return;
    const text = message.trim();
    setMessage("");
    textareaRef.current?.focus();
    try {
      setSending(true);
      await fetch(`${API_BASE}/api/support/${selectedTicket.id}/message`, {
        method: "POST",
        headers: hdrs(),
        body: JSON.stringify({ message: text }),
      });
      await fetchMessages(selectedTicket.id);
      await fetchTickets();
    } catch (e) { console.error(e); setMessage(text); }
    finally { setSending(false); }
  };

  /* poll – silent, only triggers re-render when new message arrives */
  useEffect(() => {
    if (!selectedTicket || !token) return;
    const id = setInterval(() => fetchMessages(selectedTicket.id, true), 4000);
    return () => clearInterval(id);
  }, [selectedTicket, token]);

  /* auto scroll */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* clear new-msg highlight after animation */
  useEffect(() => {
    if (newMsgIds.size === 0) return;
    const t = setTimeout(() => setNewMsgIds(new Set()), 1500);
    return () => clearTimeout(t);
  }, [newMsgIds]);

  const formatTime = (d) =>
    new Date(d).toLocaleString("en-IN", {
      hour: "numeric", minute: "numeric", day: "numeric", month: "short",
    });

  /* ── AUTO-RESIZE TEXTAREA ── */
  const handleInput = (e) => {
    setMessage(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{
      height: "100vh", display: "flex", overflow: "hidden",
      background: "var(--bg)", fontFamily: "var(--font-body)",
      color: "var(--text)", position: "relative",
    }}>

      {/* Ambient background orbs */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "-20%", left: "-10%",
          width: "600px", height: "600px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(108,99,255,0.05) 0%, transparent 70%)",
          animation: "float 8s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "-20%", right: "-10%",
          width: "500px", height: "500px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,107,157,0.04) 0%, transparent 70%)",
          animation: "float 10s ease-in-out 2s infinite",
        }} />
      </div>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: "360px", minWidth: "360px",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: mobileChat ? "none" : "flex",
        flexDirection: "column",
        height: "100%",
        position: "relative",
        zIndex: 1,
        animation: "slideInLeft 0.4s cubic-bezier(0.4,0,0.2,1) both",
      }}>

        {/* Sidebar header */}
        <div style={{
          padding: "24px 20px 20px",
          borderBottom: "1px solid var(--border)",
          background: "linear-gradient(180deg, #fafbff 0%, #ffffff 100%)",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* decorative line */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "2px",
            background: "linear-gradient(90deg, var(--accent), var(--accent2), var(--accent3))",
            backgroundSize: "200% 100%",
            animation: "gradient-shift 3s ease infinite",
          }} />

          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "16px",
              background: "linear-gradient(135deg, var(--accent), #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 4px 20px rgba(108,99,255,0.4)",
              animation: "pulse-ring 3s ease-in-out infinite",
            }}>
              <ShieldCheck size={22} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{
                fontFamily: "var(--font-head)", fontSize: "18px", fontWeight: 700,
                color: "var(--text)", letterSpacing: "-0.3px",
              }}>Help Center</h1>
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                UrbanEase Support
              </p>
            </div>

            {/* online indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: online ? "var(--accent3)" : "#ef4444",
                animation: online ? "statusPulse 2s ease-in-out infinite" : "none",
                boxShadow: online ? "0 0 8px rgba(0,212,170,0.6)" : "none",
              }} />
              {online
                ? <Wifi size={14} color="var(--accent3)" />
                : <WifiOff size={14} color="#ef4444" />}
            </div>
          </div>

          {/* ticket count */}
          {!loadingTickets && tickets.length > 0 && (
            <div style={{
              marginTop: "16px",
              display: "flex", alignItems: "center", gap: "8px",
              animation: "fadeIn 0.4s 0.3s both",
            }}>
              <span style={{
                fontSize: "11px", fontWeight: 600, color: "var(--muted)",
                letterSpacing: "0.8px", textTransform: "uppercase",
              }}>
                {tickets.length} Conversation{tickets.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Ticket list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>
          {loadingTickets ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{
                height: "100px", borderRadius: "20px", marginBottom: "10px",
                animationDelay: `${i * 0.1}s`,
              }} />
            ))
          ) : tickets.length === 0 ? (
            <div style={{
              height: "100%", display: "flex", alignItems: "center",
              justifyContent: "center", padding: "40px 24px", textAlign: "center",
              animation: "fadeUp 0.5s ease both",
            }}>
              <div>
                <div style={{
                  width: "72px", height: "72px", borderRadius: "24px",
                  background: "var(--surface2)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                  animation: "float 4s ease-in-out infinite",
                }}>
                  <Inbox size={32} color="#9ca3af" />
                </div>
                <h3 style={{
                  fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "15px",
                  color: "var(--text)", marginBottom: "6px",
                }}>No Tickets Yet</h3>
                <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>
                  Your support conversations<br />will appear here.
                </p>
              </div>
            </div>
          ) : (
            tickets.map((ticket, i) => {
              const selected = selectedTicket?.id === ticket.id;
              const st = getStatus(ticket.status);
              return (
                <button
                  key={ticket.id}
                  onClick={() => openTicket(ticket)}
                  className={`ticket-card ${selected ? "selected" : ""}`}
                  style={{
                    width: "100%", textAlign: "left",
                    padding: "16px",
                    borderRadius: "20px",
                    marginBottom: "10px",
                    cursor: "pointer",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--surface2)",
                    color: "var(--text)",
                    animation: `fadeUp 0.4s ${i * 0.06}s both`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3 style={{
                        fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "14px",
                        overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                        color: selected ? "#fff" : "var(--text)",
                      }}>{ticket.subject}</h3>
                      <p style={{
                        fontSize: "11px", marginTop: "3px",
                        color: selected ? "rgba(255,255,255,0.55)" : "var(--muted)",
                        fontFamily: "monospace",
                      }}>#{ticket.ticket_id}</p>
                    </div>

                    {/* status badge */}
                    <span className="status-badge" style={{
                      fontSize: "11px", padding: "4px 10px",
                      borderRadius: "999px",
                      background: selected ? "rgba(255,255,255,0.15)" : st.bg,
                      color: selected ? "#fff" : st.color,
                      fontWeight: 600, whiteSpace: "nowrap",
                      display: "flex", alignItems: "center", gap: "5px",
                      flexShrink: 0,
                    }}>
                      <span style={{
                        width: "5px", height: "5px", borderRadius: "50%",
                        background: selected ? "#fff" : st.dot,
                        display: "inline-block",
                        animation: ticket.status === "in_progress" ? "statusPulse 1.5s ease-in-out infinite" : "none",
                      }} />
                      {ticket.status.replace("_", " ")}
                    </span>
                  </div>

                  <div style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    marginTop: "12px", fontSize: "11px",
                    color: selected ? "rgba(255,255,255,0.5)" : "var(--muted)",
                  }}>
                    <Clock3 size={11} />
                    {formatTime(ticket.updated_at)}
                    <ChevronRight size={13} style={{ marginLeft: "auto" }} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── CHAT PANEL ── */}
      <main style={{
        flex: 1, display: "flex", flexDirection: "column",
        background: "var(--bg)",
        position: "relative", zIndex: 1,
        animation: "fadeIn 0.3s ease both",
      }}>

        {selectedTicket ? (
          <>
            {/* Chat header */}
            <div style={{
              background: "var(--surface)",
              borderBottom: "1px solid var(--border)",
              padding: "16px 24px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              backdropFilter: "blur(12px)",
              animation: "slideInRight 0.35s ease both",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: "1px",
                background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
                opacity: 0.4,
              }} />

              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <button
                  className="back-btn"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text)", display: "flex", alignItems: "center" }}
                  onClick={() => setMobileChat(false)}
                >
                  <ArrowLeft size={20} />
                </button>

                <div style={{
                  width: "40px", height: "40px", borderRadius: "14px",
                  background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 4px 16px rgba(108,99,255,0.3)",
                }}>
                  <Sparkles size={16} color="#fff" />
                </div>

                <div>
                  <h2 style={{
                    fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "15px",
                    color: "var(--text)", letterSpacing: "-0.2px",
                  }}>{selectedTicket.subject}</h2>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px" }}>
                    <span style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "monospace" }}>
                      #{selectedTicket.ticket_id}
                    </span>
                    {(() => {
                      const st = getStatus(selectedTicket.status);
                      return (
                        <span className="status-badge" style={{
                          fontSize: "11px", padding: "2px 8px", borderRadius: "999px",
                          background: st.bg, color: st.color, fontWeight: 600,
                          display: "flex", alignItems: "center", gap: "4px",
                        }}>
                          <span style={{
                            width: "4px", height: "4px", borderRadius: "50%",
                            background: st.dot, display: "inline-block",
                          }} />
                          {selectedTicket.status.replace("_", " ")}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Support avatar */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>UrbanEase Support</span>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "12px",
                  background: "linear-gradient(135deg, var(--accent3), #00a87d)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 2px 12px rgba(0,212,170,0.3)",
                }}>
                  <ShieldCheck size={16} color="#fff" />
                </div>
              </div>
            </div>

            {/* Messages area */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
              {loadingMessages ? (
                <div style={{ maxWidth: "720px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: i % 2 === 0 ? "flex-start" : "flex-end",
                    }}>
                      <div className="skeleton" style={{
                        height: "80px", width: `${[55, 45, 60, 40][i]}%`,
                        borderRadius: "20px", animationDelay: `${i * 0.1}s`,
                      }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  maxWidth: "720px", margin: "0 auto",
                  display: "flex", flexDirection: "column", gap: "12px",
                }}>
                  {messages.map((msg, i) => {
                    const isUser = msg.sender_type === "user";
                    const isNew = newMsgIds.has(msg.id);
                    return (
                      <div
                        key={msg.id}
                        className="msg-bubble"
                        style={{
                          display: "flex",
                          justifyContent: isUser ? "flex-end" : "flex-start",
                          animationDelay: isNew ? "0s" : `${Math.min(i * 0.04, 0.4)}s`,
                        }}
                      >
                        {!isUser && (
                          <div style={{
                            width: "32px", height: "32px", borderRadius: "10px",
                            background: "linear-gradient(135deg, var(--accent3), #00a87d)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, marginRight: "10px", alignSelf: "flex-end",
                            boxShadow: "0 2px 10px rgba(0,212,170,0.25)",
                          }}>
                            <ShieldCheck size={14} color="#fff" />
                          </div>
                        )}

                        <div style={{ maxWidth: "68%" }}>
                          {!isUser && (
                            <p style={{
                              fontSize: "11px", fontWeight: 600, color: "var(--muted)",
                              marginBottom: "5px", marginLeft: "4px",
                            }}>{msg.sender_name}</p>
                          )}

                          <div style={{
                            padding: "14px 18px",
                            borderRadius: isUser ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                            background: isUser
                              ? "linear-gradient(135deg, var(--accent), #8b5cf6)"
                              : "var(--surface)",
                            color: "var(--text)",
                            border: isUser ? "none" : "1px solid var(--border)",
                            boxShadow: isUser
                              ? "0 4px 20px rgba(108,99,255,0.25)"
                              : "0 2px 12px rgba(0,0,0,0.07)",
                            position: "relative",
                            ...(isNew && {
                              boxShadow: isUser
                                ? "0 4px 30px rgba(108,99,255,0.4)"
                                : "0 4px 20px rgba(0,0,0,0.1), 0 0 0 1px rgba(108,99,255,0.2)",
                            }),
                          }}>
                            <p style={{
                              fontSize: "14px", lineHeight: 1.65,
                              whiteSpace: "pre-wrap", color: "var(--text)",
                            }}>{msg.message}</p>
                          </div>

                          <div style={{
                            display: "flex", alignItems: "center",
                            gap: "4px", marginTop: "6px",
                            justifyContent: isUser ? "flex-end" : "flex-start",
                            paddingLeft: isUser ? 0 : "4px",
                            paddingRight: isUser ? "4px" : 0,
                          }}>
                            <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                              {formatTime(msg.created_at)}
                            </span>
                            {isUser && <CheckCheck size={12} color="var(--accent3)" />}
                          </div>
                        </div>

                        {isUser && (
                          <div style={{
                            width: "32px", height: "32px", borderRadius: "10px",
                            background: "linear-gradient(135deg, var(--accent), #8b5cf6)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, marginLeft: "10px", alignSelf: "flex-end",
                            boxShadow: "0 2px 10px rgba(108,99,255,0.35)",
                            fontSize: "13px", fontWeight: 700, color: "#fff",
                            fontFamily: "var(--font-head)",
                          }}>
                            U
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Typing indicator while sending */}
                  {sending && (
                    <div style={{ display: "flex", justifyContent: "flex-end", animation: "fadeUp 0.25s ease both" }}>
                      <div style={{
                        padding: "14px 20px",
                        borderRadius: "20px 20px 4px 20px",
                        background: "linear-gradient(135deg, rgba(108,99,255,0.5), rgba(139,92,246,0.5))",
                        border: "1px solid rgba(108,99,255,0.3)",
                        display: "flex", alignItems: "center", gap: "2px",
                      }}>
                        <span className="dot" style={{ background: "rgba(255,255,255,0.7)" }} />
                        <span className="dot" style={{ background: "rgba(255,255,255,0.7)" }} />
                        <span className="dot" style={{ background: "rgba(255,255,255,0.7)" }} />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input bar */}
            <div style={{
              background: "var(--surface)",
              borderTop: "1px solid var(--border)",
              padding: "16px 24px 20px",
              backdropFilter: "blur(12px)",
            }}>
              <div style={{ maxWidth: "720px", margin: "0 auto" }}>
                <div style={{
                  display: "flex", alignItems: "flex-end", gap: "12px",
                  background: "var(--surface2)",
                  border: "1.5px solid var(--border-hi)",
                  borderRadius: "20px",
                  padding: "8px 8px 8px 16px",
                  transition: "box-shadow var(--transition), border-color var(--transition)",
                }}>
                  <textarea
                    ref={textareaRef}
                    className="msg-input"
                    rows={1}
                    value={message}
                    onChange={handleInput}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message…"
                    style={{
                      flex: 1, resize: "none", border: "none",
                      background: "transparent", color: "var(--text)",
                      fontFamily: "var(--font-body)", fontSize: "14px",
                      lineHeight: 1.6, outline: "none",
                      padding: "6px 0", maxHeight: "120px", overflowY: "auto",
                    }}
                  />

                  <button
                    className="send-btn"
                    disabled={sending || !message.trim()}
                    onClick={sendMessage}
                    style={{
                      width: "44px", height: "44px", borderRadius: "14px", flexShrink: 0,
                      background: sending || !message.trim()
                        ? "var(--muted2)"
                        : "linear-gradient(135deg, var(--accent), #8b5cf6)",
                      border: "none", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: sending || !message.trim() ? "not-allowed" : "pointer",
                      boxShadow: sending || !message.trim() ? "none" : "0 4px 16px rgba(108,99,255,0.35)",
                    }}
                  >
                    {sending
                      ? <div style={{
                          width: "16px", height: "16px", borderRadius: "50%",
                          border: "2px solid rgba(255,255,255,0.3)",
                          borderTopColor: "#fff",
                          animation: "spin-slow 0.7s linear infinite",
                        }} />
                      : <Send size={17} />}
                  </button>
                </div>

                <p style={{
                  textAlign: "center", fontSize: "10px", color: "var(--muted)",
                  marginTop: "8px",
                }}>
                  Press Enter to send · Shift+Enter for new line
                </p>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            animation: "scaleIn 0.4s ease both",
          }}>
            <div style={{ textAlign: "center", padding: "32px" }}>
              <div style={{
                width: "96px", height: "96px", borderRadius: "32px",
                background: "linear-gradient(135deg, rgba(108,99,255,0.08), rgba(255,107,157,0.05))",
                border: "1px solid var(--border-hi)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 24px",
                animation: "float 5s ease-in-out infinite",
                boxShadow: "0 8px 40px rgba(108,99,255,0.1)",
              }}>
                <MessageSquare size={40} color="#d1d5db" />
              </div>

              <h2 style={{
                fontFamily: "var(--font-head)", fontSize: "22px", fontWeight: 700,
                color: "var(--text)", marginBottom: "10px", letterSpacing: "-0.3px",
              }}>Select a Conversation</h2>

              <p style={{ fontSize: "14px", color: "var(--muted)", lineHeight: 1.6 }}>
                Pick a support ticket from the sidebar<br />to start chatting with our team.
              </p>

              <div style={{
                marginTop: "32px", display: "flex", gap: "12px", justifyContent: "center",
                flexWrap: "wrap",
              }}>
                {["🚀 Fast responses", "🔒 Secure", "24/7 Support"].map((tag, i) => (
                  <span key={i} style={{
                    fontSize: "12px", padding: "6px 14px",
                    borderRadius: "999px",
                    background: "var(--surface)",
                    border: "1px solid var(--border-hi)",
                    color: "var(--muted)",
                    animation: `fadeUp 0.4s ${0.1 + i * 0.1}s both`,
                  }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default HelpCenter;