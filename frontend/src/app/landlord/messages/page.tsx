'use client';
import SubscriptionGate from '@/components/shared/SubscriptionGate';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageSquare, Send, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { messageApi, landlordApi, getErrorMessage } from '@/lib/api';
import { Conversation, Message } from '@/types';
import { getStoredUser } from '@/lib/auth';
import { cn, formatRelative } from '@/lib/utils';

export default function LandlordMessagesPage() {
  return (
    <Suspense fallback={null}>
      <LandlordMessagesContent />
    </Suspense>
  );
}

function LandlordMessagesContent() {
  const searchParams = useSearchParams();
  const initUserId = searchParams.get('userId');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser = getStoredUser();

  useEffect(() => {
    messageApi.getConversations()
      .then((res) => {
        const convs: Conversation[] = res.data.conversations ?? [];
        setConversations(convs);

        if (initUserId) {
          // Try to find existing conversation with this user, or start one
          const existing = convs.find((c) => c.tenantId === initUserId || c.landlordId === initUserId);
          if (existing) {
            openConversation(existing);
          } else {
            startNewConversation(initUserId);
          }
        } else if (convs.length > 0) {
          openConversation(convs[0]);
        }
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoadingConvs(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setLoadingMsgs(true);
    try {
      const res = await messageApi.getConversation(conv.id);
      setMessages(res.data.messages ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingMsgs(false);
    }
  };

  const startNewConversation = async (userId: string) => {
    try {
      const res = await messageApi.startConversation({ recipientId: userId, message: '' });
      const conv: Conversation = res.data.conversation;
      setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
      openConversation(conv);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const sendMessage = async () => {
    if (!draft.trim() || !activeConv) return;
    const text = draft.trim();
    setSending(true);
    setDraft('');
    try {
      const res = await messageApi.sendMessage(activeConv.id, text);
      const newMsg: Message = res.data.message;
      setMessages((prev) => [...prev, newMsg]);
      setConversations((prev) => prev.map((c) =>
        c.id === activeConv.id ? { ...c, lastMessage: text, lastMessageAt: newMsg.createdAt } : c
      ));
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <SubscriptionGate>
      <div className="max-w-6xl mx-auto">
        <div className="page-header">
          <h1 className="page-title">Messages</h1>
          <p className="page-subtitle">Your conversations with tenants</p>
        </div>

        <div className="card overflow-hidden flex" style={{ height: '600px' }}>
          {/* Conversation list */}
          <div className={cn(
            'w-72 border-r border-neutral-100 flex flex-col flex-shrink-0',
            activeConv ? 'hidden md:flex' : 'flex w-full md:w-72'
          )}>
            <div className="p-4 border-b border-neutral-100">
              <div className="text-sm font-semibold text-neutral-700">
                Conversations ({conversations.length})
              </div>
            </div>

            {loadingConvs ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 p-6 text-center">
                <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
                <div className="text-sm">No conversations yet</div>
                <div className="text-xs mt-1">Express interest in a tenant to start messaging</div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className={cn(
                      'w-full text-left p-4 flex items-start gap-3 hover:bg-neutral-50 transition-colors border-b border-neutral-50',
                      activeConv?.id === conv.id ? 'bg-brand-50 hover:bg-brand-50' : ''
                    )}
                  >
                    <div className="w-9 h-9 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {(conv.otherPartyName || 'T')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-neutral-900 truncate">{conv.otherPartyName}</div>
                      {conv.lastMessage && (
                        <div className="text-xs text-neutral-400 truncate mt-0.5">{conv.lastMessage}</div>
                      )}
                      {conv.lastMessageAt && (
                        <div className="text-xs text-neutral-300 mt-0.5">{formatRelative(conv.lastMessageAt)}</div>
                      )}
                    </div>
                    {conv.unreadCount > 0 && (
                      <div className="w-5 h-5 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center flex-shrink-0">
                        {conv.unreadCount}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Message panel */}
          <div className={cn(
            'flex-1 flex flex-col',
            !activeConv ? 'hidden md:flex' : 'flex'
          )}>
            {!activeConv ? (
              <div className="flex-1 flex flex-col items-center justify-center text-neutral-400">
                <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                <div className="text-sm">Select a conversation to start messaging</div>
              </div>
            ) : (
              <>
                {/* Conversation header */}
                <div className="p-4 border-b border-neutral-100 flex items-center gap-3">
                  <button
                    onClick={() => setActiveConv(null)}
                    className="md:hidden btn-ghost w-8 h-8 p-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {(activeConv.otherPartyName || 'T')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-neutral-900">{activeConv.otherPartyName}</div>
                    {activeConv.contextName && (
                      <div className="text-xs text-neutral-400">{activeConv.contextName}</div>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMsgs ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-neutral-400">
                      <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                      <div className="text-sm">No messages yet. Send the first one!</div>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isOwn = msg.senderId === currentUser?.id;
                      return (
                        <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                          <div className={cn(
                            'max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm',
                            isOwn
                              ? 'bg-brand-600 text-white rounded-br-sm'
                              : 'bg-neutral-100 text-neutral-900 rounded-bl-sm'
                          )}>
                            <p className="leading-relaxed">{msg.content}</p>
                            <div className={cn('text-xs mt-1', isOwn ? 'text-brand-200' : 'text-neutral-400')}>
                              {formatRelative(msg.createdAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-neutral-100">
                  <div className="flex items-end gap-3">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message... (Enter to send)"
                      rows={1}
                      className="input flex-1 resize-none min-h-[44px] max-h-32"
                      style={{ height: 'auto' }}
                      onInput={(e) => {
                        const el = e.currentTarget;
                        el.style.height = 'auto';
                        el.style.height = `${el.scrollHeight}px`;
                      }}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!draft.trim() || sending}
                      className="btn-primary w-11 h-11 p-0 flex-shrink-0 disabled:opacity-50"
                    >
                      {sending
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Send className="w-4 h-4" />
                      }
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </SubscriptionGate>
  );
}
