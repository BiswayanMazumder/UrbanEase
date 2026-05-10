import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Send,
  Clock3,
  MessageSquare,
  CheckCheck,
  ShieldCheck,
} from "lucide-react";

const API_BASE = 'https://urban-ease-theta.vercel.app';

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = {
  root: {
    height: "100vh",
    backgroundColor: "#f6f7fb",
    display: "flex",
    overflow: "hidden",
    fontFamily: "sans-serif",
  },

  // SIDEBAR
  sidebar: (mobileChat) => ({
    width: "360px",
    minWidth: "360px",
    backgroundColor: "#fff",
    borderRight: "1px solid #e5e7eb",
    display: mobileChat ? "none" : "flex",
    flexDirection: "column",
    height: "100%",
  }),
  sidebarHeader: {
    padding: "20px",
    borderBottom: "1px solid #f3f4f6",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  headerIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "16px",
    backgroundColor: "#000",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 600,
    color: "#111",
  },
  headerSub: {
    margin: 0,
    fontSize: "13px",
    color: "#6b7280",
  },
  ticketList: {
    flex: 1,
    overflowY: "auto",
    padding: "12px",
  },
  skeletonItem: {
    height: "96px",
    borderRadius: "16px",
    backgroundColor: "#f3f4f6",
    marginBottom: "12px",
    animation: "pulse 1.5s ease-in-out infinite",
  },
  emptyState: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px",
    textAlign: "center",
  },
  emptyTitle: {
    margin: "16px 0 4px",
    fontWeight: 600,
    color: "#1f2937",
    fontSize: "15px",
  },
  emptyDesc: {
    margin: 0,
    fontSize: "13px",
    color: "#9ca3af",
  },

  // TICKET CARD
  ticketCard: (selected) => ({
    width: "100%",
    textAlign: "left",
    padding: "16px",
    borderRadius: "24px",
    marginBottom: "12px",
    cursor: "pointer",
    border: selected ? "1px solid #000" : "1px solid #f3f4f6",
    backgroundColor: selected ? "#000" : "#fff",
    color: selected ? "#fff" : "#111",
    transition: "border-color 0.15s, background-color 0.15s",
    boxSizing: "border-box",
  }),
  ticketCardTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },
  ticketSubject: {
    margin: 0,
    fontWeight: 600,
    fontSize: "14px",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    maxWidth: "180px",
  },
  ticketId: (selected) => ({
    margin: "4px 0 0",
    fontSize: "12px",
    color: selected ? "#d1d5db" : "#9ca3af",
  }),
  ticketTime: (selected) => ({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "16px",
    fontSize: "12px",
    color: selected ? "#d1d5db" : "#9ca3af",
  }),

  // CHAT PANEL
  chatPanel: (mobileChat) => ({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#fafafa",
    // mobile
    ...(typeof window !== "undefined" && window.innerWidth < 768
      ? { display: mobileChat ? "flex" : "none" }
      : {}),
  }),
  chatHeader: {
    backgroundColor: "#fff",
    borderBottom: "1px solid #e5e7eb",
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chatHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  backBtn: {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    color: "#111",
  },
  chatSubjectTitle: {
    margin: 0,
    fontWeight: 600,
    fontSize: "15px",
    color: "#111",
  },
  chatMeta: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "4px",
  },
  chatTicketId: {
    fontSize: "12px",
    color: "#9ca3af",
  },

  // MESSAGES
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 16px",
  },
  messageList: {
    maxWidth: "768px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  messageRow: (isUser) => ({
    display: "flex",
    justifyContent: isUser ? "flex-end" : "flex-start",
  }),
  messageBubble: (isUser) => ({
    maxWidth: "70%",
    padding: "16px 20px",
    borderRadius: isUser ? "24px 24px 4px 24px" : "24px 24px 24px 4px",
    backgroundColor: isUser ? "#000" : "#fff",
    color: isUser ? "#fff" : "#111",
    border: isUser ? "none" : "1px solid #e5e7eb",
  }),
  senderName: {
    margin: "0 0 6px",
    fontSize: "12px",
    fontWeight: 500,
    color: "#9ca3af",
  },
  messageText: {
    margin: 0,
    fontSize: "15px",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },
  messageMeta: (isUser) => ({
    display: "flex",
    alignItems: "center",
    gap: "4px",
    marginTop: "10px",
    fontSize: "11px",
    color: isUser ? "#9ca3af" : "#9ca3af",
    justifyContent: isUser ? "flex-end" : "flex-start",
  }),

  // INPUT
  inputBar: {
    backgroundColor: "#fff",
    borderTop: "1px solid #e5e7eb",
    padding: "16px",
  },
  inputRow: {
    maxWidth: "768px",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  textarea: {
    flex: 1,
    resize: "none",
    borderRadius: "16px",
    border: "1px solid #e5e7eb",
    padding: "12px 16px",
    outline: "none",
    fontSize: "14px",
    backgroundColor: "#f9fafb",
    fontFamily: "sans-serif",
    lineHeight: 1.5,
  },
  sendBtn: (disabled) => ({
    height: "48px",
    width: "48px",
    borderRadius: "16px",
    backgroundColor: disabled ? "#9ca3af" : "#000",
    color: "#fff",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    flexShrink: 0,
    transition: "background-color 0.15s",
  }),

  // EMPTY CHAT
  emptyChatWrap: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyChatInner: {
    textAlign: "center",
  },
  emptyChatTitle: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 8px",
  },
  emptyChatDesc: {
    fontSize: "14px",
    color: "#9ca3af",
    margin: 0,
  },
};

// ─── Status badge ───────────────────────────────────────────────────────────

const statusStyle = (status, selected) => {
  if (selected) {
    return {
      fontSize: "12px",
      padding: "4px 10px",
      borderRadius: "999px",
      backgroundColor: "rgba(255,255,255,0.15)",
      color: "#fff",
      textTransform: "capitalize",
      whiteSpace: "nowrap",
    };
  }
  const map = {
    resolved: { bg: "#dcfce7", color: "#15803d" },
    closed: { bg: "#f3f4f6", color: "#4b5563" },
    in_progress: { bg: "#dbeafe", color: "#1d4ed8" },
    open: { bg: "#fef9c3", color: "#a16207" },
  };
  const s = map[status] || map.open;
  return {
    fontSize: "12px",
    padding: "4px 10px",
    borderRadius: "999px",
    backgroundColor: s.bg,
    color: s.color,
    textTransform: "capitalize",
    whiteSpace: "nowrap",
  };
};

// ─── Component ──────────────────────────────────────────────────────────────

const HelpCenter = () => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);

  const messagesEndRef = useRef(null);
  const token = localStorage.getItem("firebase_token");

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const fetchTickets = async () => {
    try {
      setLoadingTickets(true);
      const res = await fetch(`${API_BASE}/api/support/my-tickets`, { headers: authHeaders });
      const data = await res.json();
      setTickets(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTickets(false);
    }
  };

  const fetchMessages = async (ticketId) => {
    try {
      setLoadingMessages(true);
      const res = await fetch(`${API_BASE}/api/support/${ticketId}/messages`, { headers: authHeaders });
      const data = await res.json();
      setMessages(data.messages || []);
      await fetch(`${API_BASE}/api/support/${ticketId}/read`, { method: "POST", headers: authHeaders });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const openTicket = async (ticket) => {
    setSelectedTicket(ticket);
    setMobileChat(true);
    await fetchMessages(ticket.id);
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    try {
      setSending(true);
      await fetch(`${API_BASE}/api/support/${selectedTicket.id}/message`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ message }),
      });
      setMessage("");
      await fetchMessages(selectedTicket.id);
      await fetchTickets();
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => { fetchTickets(); }, []);

  useEffect(() => {
    if (!selectedTicket) return;
    const interval = setInterval(() => fetchMessages(selectedTicket.id), 4000);
    return () => clearInterval(interval);
  }, [selectedTicket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (date) =>
    new Date(date).toLocaleString("en-IN", {
      hour: "numeric", minute: "numeric", day: "numeric", month: "short",
    });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>

      {/* SIDEBAR */}
      <div style={styles.sidebar(mobileChat)}>

        <div style={styles.sidebarHeader}>
          <div style={styles.headerIcon}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 style={styles.headerTitle}>Help Center</h1>
            <p style={styles.headerSub}>Chat with UrbanEase Support</p>
          </div>
        </div>

        <div style={styles.ticketList}>
          {loadingTickets ? (
            [...Array(6)].map((_, i) => (
              <div key={i} style={styles.skeletonItem} />
            ))
          ) : tickets.length === 0 ? (
            <div style={styles.emptyState}>
              <div>
                <MessageSquare size={42} color="#d1d5db" />
                <h3 style={styles.emptyTitle}>No Support Tickets</h3>
                <p style={styles.emptyDesc}>Your support conversations will appear here.</p>
              </div>
            </div>
          ) : (
            tickets.map((ticket) => {
              const selected = selectedTicket?.id === ticket.id;
              return (
                <button
                  key={ticket.id}
                  onClick={() => openTicket(ticket)}
                  style={styles.ticketCard(selected)}
                >
                  <div style={styles.ticketCardTop}>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={styles.ticketSubject}>{ticket.subject}</h3>
                      <p style={styles.ticketId(selected)}>#{ticket.ticket_id}</p>
                    </div>
                    <span style={statusStyle(ticket.status, selected)}>
                      {ticket.status.replace("_", " ")}
                    </span>
                  </div>
                  <div style={styles.ticketTime(selected)}>
                    <Clock3 size={13} />
                    {formatTime(ticket.updated_at)}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* CHAT PANEL */}
      <div style={styles.chatPanel(mobileChat)}>
        {selectedTicket ? (
          <>
            {/* Header */}
            <div style={styles.chatHeader}>
              <div style={styles.chatHeaderLeft}>
                <button style={styles.backBtn} onClick={() => setMobileChat(false)}>
                  <ArrowLeft size={22} />
                </button>
                <div>
                  <h2 style={styles.chatSubjectTitle}>{selectedTicket.subject}</h2>
                  <div style={styles.chatMeta}>
                    <span style={styles.chatTicketId}>#{selectedTicket.ticket_id}</span>
                    <span style={statusStyle(selectedTicket.status, false)}>
                      {selectedTicket.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div style={styles.messages}>
              {loadingMessages ? (
                <div style={{ maxWidth: "768px", margin: "0 auto" }}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} style={{ ...styles.skeletonItem, borderRadius: "24px" }} />
                  ))}
                </div>
              ) : (
                <div style={styles.messageList}>
                  {messages.map((msg) => {
                    const isUser = msg.sender_type === "user";
                    return (
                      <div key={msg.id} style={styles.messageRow(isUser)}>
                        <div style={styles.messageBubble(isUser)}>
                          {!isUser && (
                            <p style={styles.senderName}>{msg.sender_name}</p>
                          )}
                          <p style={styles.messageText}>{msg.message}</p>
                          <div style={styles.messageMeta(isUser)}>
                            {formatTime(msg.created_at)}
                            {isUser && <CheckCheck size={14} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div style={styles.inputBar}>
              <div style={styles.inputRow}>
                <textarea
                  rows={1}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type your message..."
                  style={styles.textarea}
                />
                <button
                  disabled={sending || !message.trim()}
                  onClick={sendMessage}
                  style={styles.sendBtn(sending || !message.trim())}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={styles.emptyChatWrap}>
            <div style={styles.emptyChatInner}>
              <MessageSquare size={54} color="#d1d5db" />
              <h2 style={styles.emptyChatTitle}>Select a Conversation</h2>
              <p style={styles.emptyChatDesc}>Open a support ticket to continue chatting.</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default HelpCenter;