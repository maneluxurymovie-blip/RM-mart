import React, { useEffect, useRef, useState } from 'react';
import { Headphones, MessageCircle, Send, ShieldCheck, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  saveChatExchangeToFirestore,
  subscribeConversationMessages,
} from '../lib/storeService';
import type { ChatMessage, Product } from '../types';

interface SupportChatWidgetProps {
  products: Product[];
  user: User | null;
}

const STORAGE_CONV_ID_KEY = 'rm_mart_chat_conv_id';
const STORAGE_MESSAGES_KEY = 'rm_mart_chat_messages';

function getOrCreateConversationId(user: User | null): string {
  if (user?.uid) {
    return `conv_${user.uid.slice(0, 32)}`;
  }
  const saved = localStorage.getItem(STORAGE_CONV_ID_KEY);
  if (saved) return saved;
  const fresh = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  localStorage.setItem(STORAGE_CONV_ID_KEY, fresh);
  return fresh;
}

const QUICK_PROMPTS = [
  { label: 'Best offers today', text: 'What special offers are available right now at RM Mart?' },
  { label: 'हिन्दी में पूछें', text: 'डिलीवरी चार्ज और रिटर्न पॉलिसी क्या है?' },
  { label: 'मराठीत विचारा', text: 'RM Mart वर कोणती उत्पादने उपलब्ध आहेत?' },
];

export const SupportChatWidget: React.FC<SupportChatWidgetProps> = ({ products, user }) => {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string>(() =>
    getOrCreateConversationId(user)
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MESSAGES_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore storage errors
    }
    return [
      {
        id: 'welcome',
        senderRole: 'ai',
        senderName: 'RM Mart Assistant',
        text: 'Namaste! Welcome to RM Mart. Ask me about products, ₹ prices, delivery, returns, or your order in English, हिन्दी, or मराठी.',
        createdAt: new Date().toISOString(),
      },
    ];
  });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [humanRequested, setHumanRequested] = useState(false);
  const [unreadAdminCount, setUnreadAdminCount] = useState(0);

  // Order verification fields inside chat
  const [showOrderVerify, setShowOrderVerify] = useState(false);
  const [verifyOrderNumber, setVerifyOrderNumber] = useState('');
  const [verifyContact, setVerifyContact] = useState(user?.email || '');

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setConversationId(getOrCreateConversationId(user));
    if (user?.email) setVerifyContact((prev) => prev || user.email || '');
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      // ignore
    }
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Real-time Firestore listener for signed-in users so owner replies appear live
  useEffect(() => {
    if (!user || !conversationId) return;
    return subscribeConversationMessages(conversationId, user, (remoteMsgs) => {
      if (remoteMsgs.length > 0) {
        setMessages(remoteMsgs);
      }
    });
  }, [user, conversationId]);

  // Poll server mirror when open so admin replies to guest sessions also appear live
  useEffect(() => {
    if (!open || !conversationId) return;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}`);
        if (!res.ok) return;
        const data = await res.json();
        const serverMsgs: ChatMessage[] = data.conversation?.messages || [];
        if (serverMsgs.length > messages.length) {
          setMessages(serverMsgs);
        }
      } catch {
        // ignore transient poll failures
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [open, conversationId, messages.length]);

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;

    setErrorMsg('');
    setInput('');
    const userMsg: ChatMessage = {
      id: `local_${Date.now()}`,
      senderRole: 'customer',
      senderName: user?.displayName || 'You',
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          customerUid: user?.uid || conversationId,
          customerName: user?.displayName || 'Guest Shopper',
          customerEmail: user?.email || '',
          message: text,
          products,
          verifyOrderNumber: verifyOrderNumber.trim() || undefined,
          verifyContact: verifyContact.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMsg(data.error || 'Support assistant could not reply right now.');
        setSending(false);
        return;
      }

      const aiReplyText = String(data.reply || '');
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        senderRole: 'ai',
        senderName: 'RM Mart Assistant',
        text: aiReplyText,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      if (user && user.emailVerified) {
        await saveChatExchangeToFirestore({
          conversationId,
          user,
          customerText: text,
          aiText: aiReplyText,
          needsHumanSupport: humanRequested,
        });
      }
    } catch {
      setErrorMsg('Unable to connect to RM Mart Support. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleRequestHuman = async () => {
    setHumanRequested(true);
    try {
      await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/human`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerUid: user?.uid || conversationId,
          customerName: user?.displayName || 'Guest Shopper',
          customerEmail: user?.email || '',
        }),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `human_${Date.now()}`,
          senderRole: 'ai',
          senderName: 'RM Mart Support',
          text: 'Your conversation has been flagged for human support. Store owner Ravindra Mane can view this thread and reply directly here.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      setErrorMsg('Could not notify human support right now.');
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setUnreadAdminCount(0);
          }}
          aria-label="Open RM Mart AI customer support chat"
          className="inline-flex items-center gap-2.5 px-4 py-3 bg-[#0D3B2E] text-[#FAF7F2] rounded-full shadow-lg hover:bg-[#092A20] transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059] focus-visible:ring-offset-2"
        >
          <MessageCircle className="w-5 h-5" aria-hidden="true" />
          <span className="text-sm font-semibold whitespace-nowrap">RM Mart Support</span>
          {unreadAdminCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-[#C5A059] text-[#14211D] text-xs font-bold flex items-center justify-center tabular-nums">
              {unreadAdminCount}
            </span>
          )}
        </button>
      ) : (
        <div
          role="dialog"
          aria-label="RM Mart Customer Support Chat"
          className="w-[calc(100vw-2.5rem)] sm:w-96 max-h-[78vh] bg-white border border-[#D8D0C1] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Chat Header */}
          <div className="bg-[#0D3B2E] text-[#FAF7F2] px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif-display text-lg font-semibold leading-tight">
                RM Mart Support
              </h2>
              <p className="text-[11px] text-[#E8D5A8]">
                English · हिन्दी · मराठी · Grounded in live catalog
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close support chat"
              className="p-1.5 rounded-lg text-[#FAF7F2]/80 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Transparent Storage Disclosure */}
          <div className="px-4 py-2 bg-[#FAF7F2] border-b border-[#E5DEC9] text-[11px] text-[#52605B] flex items-center justify-between gap-2">
            <span>Conversations are stored privately for customer support.</span>
            <button
              type="button"
              onClick={() => setShowOrderVerify((v) => !v)}
              className="font-semibold text-[#0D3B2E] hover:underline whitespace-nowrap shrink-0"
            >
              {showOrderVerify ? 'Hide Verify' : 'Verify Order'}
            </button>
          </div>

          {/* Optional Order Verification Drawer */}
          {showOrderVerify && (
            <div className="px-4 py-3 bg-[#F2ECE1] border-b border-[#E5DEC9] space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-[#0D3B2E]">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Verify identity to check order status</span>
              </div>
              <input
                type="text"
                value={verifyOrderNumber}
                onChange={(e) => setVerifyOrderNumber(e.target.value)}
                placeholder="Order ID (e.g. RMM-20261118-XXXX)"
                aria-label="Order ID for verification"
                className="w-full px-2.5 py-1.5 bg-white border border-[#D8D0C1] rounded text-xs font-mono"
              />
              <input
                type="text"
                value={verifyContact}
                onChange={(e) => setVerifyContact(e.target.value)}
                placeholder="Registered Mobile or Email"
                aria-label="Registered mobile or email for verification"
                className="w-full px-2.5 py-1.5 bg-white border border-[#D8D0C1] rounded text-xs"
              />
            </div>
          )}

          {/* Message Thread */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#FAF7F2]/50 min-h-[240px]"
          >
            {messages.map((msg) => {
              const isCustomer = msg.senderRole === 'customer';
              const isAdmin = msg.senderRole === 'admin';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] text-[#52605B] mb-1 px-1">
                    {isAdmin ? 'Ravindra Mane · Owner' : msg.senderName}
                  </span>
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      isCustomer
                        ? 'bg-[#0D3B2E] text-[#FAF7F2]'
                        : isAdmin
                          ? 'bg-[#F2ECE1] border border-[#C5A059] text-[#14211D]'
                          : 'bg-white border border-[#E5DEC9] text-[#14211D]'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
            {sending && (
              <div className="text-xs text-[#52605B] px-1">RM Mart Assistant is replying...</div>
            )}
            {errorMsg && (
              <div role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Quick Language & Policy Prompts + Human Escalation */}
          <div className="px-3 py-2.5 bg-white border-t border-[#F2ECE1] flex flex-wrap items-center gap-1.5">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => sendMessage(q.text)}
                className="px-2.5 py-1 text-[11px] font-medium bg-[#FAF7F2] border border-[#E5DEC9] text-[#0D3B2E] rounded-md hover:bg-[#F2ECE1] whitespace-nowrap shrink-0"
              >
                {q.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleRequestHuman}
              disabled={humanRequested}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-[#E8F0EC] text-[#0D3B2E] rounded-md hover:bg-[#D7E5DE] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Headphones className="w-3 h-3" aria-hidden="true" />
              <span>{humanRequested ? 'Owner Notified' : 'Human Support'}</span>
            </button>
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="p-3 bg-white border-t border-[#E5DEC9] flex items-center gap-2"
          >
            <label htmlFor="chat-input" className="sr-only">
              Type your question in English, Hindi, or Marathi
            </label>
            <input
              id="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask in English, हिन्दी, or मराठी..."
              className="flex-1 px-3 py-2 bg-[#FAF7F2] border border-[#D8D0C1] rounded-lg text-sm focus:outline-none focus:border-[#0D3B2E]"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send support message"
              className="p-2.5 bg-[#0D3B2E] text-[#FAF7F2] rounded-lg hover:bg-[#092A20] disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
