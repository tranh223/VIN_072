import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { ArrowUp, Bot, ExternalLink, Loader2, Send, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createUsageEvent, createUserFeedback, ragStreamRich, summarizeRagConversation } from '../api/client';
import type { AuthUser, RagCitation } from '../api/types';
import { pushUserNotification } from '../utils/notifications';
import { RagMarkdown } from '../components/RagMarkdown';
import { groupRagCitationsByDocument } from '../utils/groupRagCitations';

type Role = 'assistant' | 'user';

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  citations?: RagCitation[];
  isStreaming?: boolean;
  feedback?: 'up' | 'down';
};

type FloatingActionsProps = {
  currentUser?: AuthUser | null;
};

const STARTER: ChatMessage = {
  id: 'starter',
  role: 'assistant',
  text: 'Xin chào! Mình là Kaify Bot, trợ lý tư vấn pháp lý thuế Việt Nam. Hãy đặt câu hỏi về luật thuế, và mình sẽ trả lời dựa trên văn bản pháp luật chính thức.',
};

const HALLUCINATION_NOTE = 'Lưu ý: Một phần câu trả lời';
const LEGAL_BASIS_NOTE = 'Căn cứ:';
const CHAT_HISTORY_PREFIX = 'scaify.chat.history.';
const CHAT_HISTORY_LIMIT = 50;
const RECENT_MESSAGE_LIMIT = 20;
const SUMMARY_TRIGGER_MESSAGES = 12;
const SUMMARY_MAX_CHARS = 2400;

type StoredChatHistory = {
  summary: string;
  messages: ChatMessage[];
};

function cleanChatLine(line: string) {
  return line.replace(/^⚠️\s*/, '').replace(/\*/g, '');
}

function hasHallucinationNote(text: string) {
  return cleanChatLine(text).includes(HALLUCINATION_NOTE);
}

function isSecondaryNoteLine(line: string) {
  return line.startsWith(HALLUCINATION_NOTE) || line.startsWith(LEGAL_BASIS_NOTE);
}

function isClarificationMessage(text: string) {
  const normalized = cleanChatLine(text).toLowerCase();
  return (
    normalized.includes('mình cần thêm') ||
    normalized.includes('cần thêm') ||
    normalized.includes('cho mình biết') ||
    normalized.includes('vui lòng cho mình biết') ||
    normalized.includes('để trả lời đúng')
  );
}

function countRecentClarifications(messages: ChatMessage[]) {
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === 'user') continue;
    if (message.isStreaming) continue;
    if (!isClarificationMessage(message.text)) break;
    count += 1;
    if (count >= 3) break;
  }
  return count;
}

function chatHistoryKey(user?: AuthUser | null) {
  return `${CHAT_HISTORY_PREFIX}${user?.id ?? 'guest'}`;
}

function persistableMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => !message.isStreaming && message.text.trim())
    .slice(-CHAT_HISTORY_LIMIT)
    .map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
      citations: message.citations,
      feedback: message.feedback,
    }));
}

function loadChatHistory(user?: AuthUser | null): StoredChatHistory | null {
  try {
    const raw = sessionStorage.getItem(chatHistoryKey(user));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredChatHistory;
    if (!Array.isArray(parsed.messages)) return null;
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      messages: parsed.messages,
    };
  } catch {
    sessionStorage.removeItem(chatHistoryKey(user));
    return null;
  }
}

function compactConversationSummary(previousSummary: string, messages: ChatMessage[]) {
  const persisted = persistableMessages(messages);
  const older = persisted.slice(0, Math.max(0, persisted.length - RECENT_MESSAGE_LIMIT));
  const userMessages = older
    .filter((message) => message.id !== STARTER.id && message.role === 'user')
    .map((message) => message.text.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const importantTerms = [
    'chào',
    'ngưỡng',
    'thuế',
    'shop',
    'mint_shop',
    'system prompt',
    'trốn thuế',
    'thời tiết',
    'admin',
  ];
  const selected = [
    ...userMessages.slice(0, 4),
    ...userMessages.filter((text) => importantTerms.some((term) => text.toLowerCase().includes(term))),
    ...userMessages.slice(-8),
  ];
  const unique = Array.from(new Set(selected)).slice(-24);
  const fragments = unique.map((text) => `Người dùng: ${text.slice(0, 160)}`);

  const next = [previousSummary, ...fragments].filter(Boolean).join(' | ');
  if (next.length <= SUMMARY_MAX_CHARS) return next;

  const head = next.slice(0, 500);
  const tail = next.slice(next.length - (SUMMARY_MAX_CHARS - head.length - 20));
  return `${head} | ... | ${tail}`;
}

function buildRecentMessages(messages: ChatMessage[]) {
  return persistableMessages(messages)
    .filter((message) => message.id !== STARTER.id)
    .slice(-RECENT_MESSAGE_LIMIT)
    .map((message) => ({
      role: message.role,
      text: message.text.replace(/\s+/g, ' ').trim().slice(0, 500),
    }));
}

function buildSummaryForRequest(currentSummary: string, messages: ChatMessage[]) {
  if (persistableMessages(messages).length <= SUMMARY_TRIGGER_MESSAGES) return currentSummary;
  return compactConversationSummary(currentSummary, messages);
}

function buildSummaryMessages(messages: ChatMessage[]) {
  return persistableMessages(messages)
    .filter((message) => message.id !== STARTER.id)
    .slice(-CHAT_HISTORY_LIMIT)
    .map((message) => ({
      role: message.role,
      text: message.text.replace(/\s+/g, ' ').trim().slice(0, 1200),
    }));
}

function renderChatText(text: string, role: Role) {
  const lines = text.split(/\r?\n/);

  return (
    <div className="space-y-2 leading-relaxed">
      {lines.map((rawLine, index) => {
        const line = cleanChatLine(rawLine);
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={`blank-${index}`} className="h-1" />;
        }

        if (trimmed === '---') {
          return (
            <hr
              key={`hr-${index}`}
              className={role === 'assistant' ? 'my-3 border-slate-100' : 'my-3 border-white/25'}
            />
          );
        }

        const isNote = isSecondaryNoteLine(trimmed);
        return (
          <p
            key={`line-${index}`}
            className={
              isNote
                ? 'border-t border-slate-100 pt-2 text-[13px] leading-relaxed text-slate-500'
                : role === 'assistant'
                  ? 'whitespace-pre-wrap'
                  : 'whitespace-pre-wrap text-white'
            }
          >
            {line}
          </p>
        );
      })}
    </div>
  );
}

export default function FloatingActions({ currentUser }: FloatingActionsProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [input, setInput] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState<'helpful' | 'inaccurate'>('helpful');
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([STARTER]);
  const [conversationSummary, setConversationSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const showChatRef = useRef(showChat);
  const summarizedCountRef = useRef(0);
  const summarizingRef = useRef(false);
  const dragState = useRef({
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
    moved: false,
  });
  const suppressClick = useRef(false);

  useEffect(() => {
    const toggleVisibility = () => setIsVisible(window.pageYOffset > 240);
    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  // Auto-scroll khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    showChatRef.current = showChat;
  }, [showChat]);

  useEffect(() => {
    const stored = loadChatHistory(currentUser);
    if (stored?.messages.length) {
      setMessages(stored.messages);
      setConversationSummary(stored.summary);
      summarizedCountRef.current = stored.messages.length;
    } else {
      setMessages([STARTER]);
      setConversationSummary('');
      summarizedCountRef.current = 0;
    }
  }, [currentUser?.id]);

  useEffect(() => {
    const storedMessages = persistableMessages(messages);
    if (!storedMessages.length) return;

    setConversationSummary((currentSummary) => {
      try {
        sessionStorage.setItem(
          chatHistoryKey(currentUser),
          JSON.stringify({ summary: currentSummary, messages: storedMessages })
        );
      } catch {
        // ignore sessionStorage quota/private mode failures
      }
      return currentSummary;
    });
  }, [messages, currentUser?.id]);

  useEffect(() => {
    const openSupportMenu = () => {
      setShowChat(false);
      setShowFeedbackModal(false);
      setShowChat(true);
    };
    const openChatPanel = () => {
      setShowFeedbackModal(false);
      setShowChat(true);
    };
    const openFeedbackPanel = () => {
      setShowChat(false);
      setFeedbackError(null);
      setShowFeedbackModal(true);
    };
    window.addEventListener('scaify.floatingSupport.openMenu', openSupportMenu);
    window.addEventListener('scaify.floatingSupport.openChat', openChatPanel);
    window.addEventListener('scaify.floatingSupport.openFeedback', openFeedbackPanel);
    return () => {
      window.removeEventListener('scaify.floatingSupport.openMenu', openSupportMenu);
      window.removeEventListener('scaify.floatingSupport.openChat', openChatPanel);
      window.removeEventListener('scaify.floatingSupport.openFeedback', openFeedbackPanel);
    };
  }, []);

  const canSend = input.trim().length > 0 && !isLoading;

  const openChat = () => {
    setShowChat(true);
  };

  const openFeedback = () => {
    setFeedbackError(null);
    setShowFeedbackModal(true);
  };

  const askAgent = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;

    const question = input.trim();
    setInput('');
    setIsLoading(true);

    // Thêm tin nhắn user
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: question };
    // Thêm placeholder cho assistant (đang stream)
    const aiId = `a-${Date.now()}`;
    const aiPlaceholder: ChatMessage = { id: aiId, role: 'assistant', text: '', isStreaming: true };
    setMessages((prev) => [...prev, userMsg, aiPlaceholder]);

    abortRef.current?.abort();
    const messagesForRequest = [...messages, userMsg];
    const clarificationCount = countRecentClarifications(messages);
    const summaryForRequest = buildSummaryForRequest(conversationSummary, messagesForRequest);
    abortRef.current = ragStreamRich(
      {
        query: question,
        retrieve_top_k: 20,
        rerank_top_k: 3,
        clarification_count: clarificationCount,
        conversation_summary: summaryForRequest || null,
        recent_messages: buildRecentMessages(messagesForRequest),
      },
      {
        onToken: (token) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === aiId ? { ...m, text: m.text + token } : m))
          );
        },
        onFinal: (resp) => {
          const completedAssistant: ChatMessage = {
            id: aiId,
            role: 'assistant',
            text: resp.answer,
            citations: resp.citations,
          };
          const completedMessages = [...messagesForRequest, completedAssistant];
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId
                ? { ...m, text: resp.answer, citations: resp.citations, isStreaming: false }
                : m
            )
          );
          void createUsageEvent({
            user_id: currentUser?.id ?? null,
            event_type: 'chatbot_question',
            feature: 'chatbot_question',
            metadata: {
              matched_refs: resp.citations ?? [],
              contexts_used: resp.contexts_used ?? [],
              latency_ms: resp.latency_ms,
              model: resp.model,
              tokens_used: resp.tokens_used,
              is_hallucination_risk: resp.is_hallucination_risk,
            },
          }).catch(() => undefined);

          const persistedCount = persistableMessages(completedMessages).length;
          if (
            persistedCount > SUMMARY_TRIGGER_MESSAGES &&
            persistedCount > summarizedCountRef.current &&
            !summarizingRef.current
          ) {
            summarizingRef.current = true;
            summarizeRagConversation({
              previous_summary: conversationSummary || null,
              messages: buildSummaryMessages(completedMessages),
            })
              .then((result) => {
                const nextSummary = result.summary.trim();
                if (!nextSummary) return;
                summarizedCountRef.current = persistedCount;
                setConversationSummary(nextSummary);
                try {
                  sessionStorage.setItem(
                    chatHistoryKey(currentUser),
                    JSON.stringify({
                      summary: nextSummary,
                      messages: persistableMessages(completedMessages),
                    })
                  );
                } catch {
                  // ignore sessionStorage quota/private mode failures
                }
              })
              .catch(() => {
                const fallbackSummary = buildSummaryForRequest(conversationSummary, completedMessages);
                if (fallbackSummary) setConversationSummary(fallbackSummary);
              })
              .finally(() => {
                summarizingRef.current = false;
              });
          }

          if (!showChatRef.current) {
            pushUserNotification({
              title: 'Chatbot đã trả lời',
              detail: question.length > 80 ? `${question.slice(0, 80)}...` : question,
              type: 'chatbot',
            });
          }
        },
        onDone: () => setIsLoading(false),
        onError: (err) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId
                ? { ...m, text: `⚠️ Không thể kết nối RAG backend: ${err}`, isStreaming: false }
                : m
            )
          );
          setIsLoading(false);
          pushUserNotification({
            title: 'Chatbot gặp lỗi',
            detail: String(err),
            type: 'chatbot',
          });
        },
      }
    );
  };

  const setMessageFeedback = (id: string, value: 'up' | 'down') => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, feedback: value } : m)));
  };

  const submitFeedback = () => {
    const comment = feedbackText.trim();
    if (!comment || feedbackSaving) return;
    setFeedbackSaving(true);
    setFeedbackError(null);
    void createUserFeedback({
      user_id: currentUser?.id ?? null,
      rating: feedbackType === 'helpful' ? 5 : 2,
      feedback_type: feedbackType,
      comment,
    })
      .then(() => {
        setShowFeedbackModal(false);
        setFeedbackText('');
        setFeedbackType('helpful');
        pushUserNotification({
          title: 'Đã gửi góp ý',
          detail: 'Cảm ơn bạn đã gửi phản hồi cho hệ thống.',
          type: 'feedback',
        });
      })
      .catch((err: Error) => {
        setFeedbackError(err.message);
        pushUserNotification({
          title: 'Không gửi được góp ý',
          detail: err.message,
          type: 'feedback',
        });
      })
      .finally(() => setFeedbackSaving(false));
  };

  const handleActionPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragState.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    setPanelPosition({ x: rect.left, y: rect.top });

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      const deltaX = Math.abs(moveEvent.clientX - dragState.current.startX);
      const deltaY = Math.abs(moveEvent.clientY - dragState.current.startY);
      if (deltaX > 4 || deltaY > 4) {
        dragState.current.moved = true;
        setIsDragging(true);
      }

      const nextX = moveEvent.clientX - dragState.current.offsetX;
      const nextY = moveEvent.clientY - dragState.current.offsetY;
      setPanelPosition({
        x: Math.min(Math.max(8, nextX), window.innerWidth - rect.width - 8),
        y: Math.min(Math.max(8, nextY), window.innerHeight - rect.height - 8),
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      setIsDragging(false);
      suppressClick.current = dragState.current.moved;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <>
      {isVisible && (
      <div
        className={`fixed z-[70] flex touch-none select-none flex-col gap-2 ${
          panelPosition ? '' : 'bottom-4 right-4 sm:bottom-6 sm:right-6'
        } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={panelPosition ? { left: panelPosition.x, top: panelPosition.y } : undefined}
        onPointerDown={handleActionPointerDown}
      >
        <div className="relative rounded-2xl border border-outline-variant bg-white p-1.5 shadow-[0_10px_30px_rgba(26,22,77,0.18)]">
            <button
              type="button"
              onClick={() => {
                if (suppressClick.current) return;
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="group flex w-full flex-col items-center rounded-xl px-2.5 py-2 transition-colors hover:bg-slate-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <ArrowUp className="h-5 w-5" />
              </div>
              <span className="mt-1 text-[10px] font-bold uppercase tracking-tight text-slate-600">Lên đầu</span>
            </button>
        </div>
      </div>
      )}

      <AnimatePresence>
        {showChat && (
          <div className="pointer-events-none fixed inset-0 z-[90] flex items-end justify-end p-3 sm:p-6">
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.96 }}
              className="pointer-events-auto flex h-[78vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-outline-variant bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between bg-primary px-4 py-3 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">Kaify Bot</h3>
                    <p className="text-xs opacity-80">Trợ lý giải thích căn cứ</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowChat(false)} className="rounded-full p-2 transition-colors hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[88%] rounded-2xl border p-3 text-sm shadow-sm ${
                      m.role === 'assistant' ? 'border-slate-200 bg-white' : 'ml-auto border-primary/20 bg-primary text-white'
                    }`}
                  >
                    {m.role === 'assistant' ? (
                      m.isStreaming && !m.text ? (
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Đang tìm kiếm văn bản pháp luật...
                        </span>
                      ) : m.isStreaming ? (
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800">{m.text}</p>
                      ) : (
                        <RagMarkdown content={m.text} />
                      )
                    ) : (
                      renderChatText(m.text, m.role)
                    )}

                    {/* Typing cursor khi đang stream */}
                    {m.isStreaming && m.text && (
                      <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary" />
                    )}

                    {m.role === 'assistant' &&
                      !m.isStreaming &&
                      (() => {
                        const grouped = groupRagCitationsByDocument(m.citations || []);
                        if (grouped.length === 0) return null;
                        return (
                          <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Tài liệu tham khảo
                            </p>
                            {grouped.map((g, i) => (
                              <div key={`cite-${g.url}-${i}`} className="flex items-start gap-1.5 text-[11px] text-slate-500">
                                <span className="mt-0.5 shrink-0 font-semibold text-primary">•</span>
                                <span>
                                  <span className="font-medium">{g.lawLabel}</span>
                                  {g.dieuList.length > 0 && (
                                    <span>
                                      {' '}
                                      — Điều {g.dieuList.join(', ')}
                                    </span>
                                  )}
                                  <a
                                    href={g.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Xem văn bản
                                  </a>
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                    {/* Nút feedback */}
                    {m.role === 'assistant' && !m.isStreaming && !hasHallucinationNote(m.text) && (
                      <div className="mt-2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setMessageFeedback(m.id, 'up')}
                          className={`rounded-lg p-1.5 ${m.feedback === 'up' ? 'bg-emerald-100 text-emerald-700' : 'text-outline hover:bg-slate-100'}`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMessageFeedback(m.id, 'down')}
                          className={`rounded-lg p-1.5 ${m.feedback === 'down' ? 'bg-red-100 text-red-700' : 'text-outline hover:bg-slate-100'}`}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={askAgent} className="flex gap-2 border-t border-slate-100 bg-white p-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  type="text"
                  placeholder="Hỏi về luật thuế, văn bản pháp lý..."
                  disabled={isLoading}
                  className="flex-1 rounded-xl bg-slate-100 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2 disabled:opacity-60"
                />
                <button type="submit" disabled={!canSend} className="rounded-xl bg-primary p-2.5 text-white disabled:opacity-50">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFeedbackModal && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
                <h3 className="text-base font-bold text-slate-800">Góp ý dành cho Scaify</h3>
                <button type="button" onClick={() => setShowFeedbackModal(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-200">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFeedbackType('helpful')}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                      feedbackType === 'helpful'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-outline-variant hover:bg-slate-50'
                    }`}
                  >
                    <ThumbsUp className="h-4 w-4 text-emerald-600" />
                    Hữu ích
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackType('inaccurate')}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                      feedbackType === 'inaccurate'
                        ? 'border-red-300 bg-red-50 text-red-800'
                        : 'border-outline-variant hover:bg-slate-50'
                    }`}
                  >
                    <ThumbsDown className="h-4 w-4 text-red-600" />
                    Chưa chính xác
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Mô tả thêm góp ý của bạn..."
                  className="w-full rounded-xl bg-slate-100 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                />
                {feedbackError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {feedbackError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={submitFeedback}
                  disabled={feedbackSaving || !feedbackText.trim()}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                >
                  {feedbackSaving ? 'Đang gửi...' : 'Gửi phản hồi'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
