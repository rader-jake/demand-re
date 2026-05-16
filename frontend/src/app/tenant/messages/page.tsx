'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Send, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { messageApi, getErrorMessage } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

export default function TenantMessagesPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const user = getStoredUser();

  useEffect(() => {
    messageApi.getConversations()
      .then(res => setConversations(res.data))
      .catch(() => toast.error('Failed to load conversations'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    messageApi.getConversation(selected.id)
      .then(res => setMessages(res.data.messages || []))
      .catch(() => toast.error('Failed to load messages'));
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConversation = (conv: any) => {
    setSelected(conv);
    setShowThread(true);
  };

  const send = async () => {
    if (!text.trim() || !selected) return;
    setSending(true);
    try {
      await messageApi.sendMessage(selected.id, text.trim());
      setText('');
      const res = await messageApi.getConversation(selected.id);
      setMessages(res.data.messages || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="page-header">
        <h1 className="page-title">Messages</h1>
        <p className="page-subtitle">Conversations with landlords and brokers</p>
      </div>

      <div className="flex-1 card overflow-hidden flex min-h-0">
        {/* Conversation list */}
        <div className={cn('w-full sm:w-72 border-r border-neutral-200 flex flex-col flex-shrink-0', showThread ? 'hidden sm:flex' : 'flex')}>
          <div className="p-4 border-b border-neutral-100">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Conversations</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
              <MessageSquare className="w-8 h-8 text-neutral-300 mb-2" />
              <p className="text-sm text-neutral-400">No conversations yet</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors border-b border-neutral-100',
                    selected?.id === conv.id && 'bg-brand-50'
                  )}
                >
                  <div className="font-medium text-sm text-neutral-900 truncate">{conv.otherPartyName}</div>
                  <div className="text-xs text-neutral-500 truncate mt-0.5">{conv.lastMessage || 'No messages yet'}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message thread */}
        <div className={cn('flex-1 flex flex-col min-w-0', showThread ? 'flex' : 'hidden sm:flex')}>
          {!selected ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
              <MessageSquare className="w-12 h-12 text-neutral-200 mb-3" />
              <p className="text-neutral-400">Select a conversation to view messages</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-neutral-200 flex items-center gap-3">
                <button className="sm:hidden text-brand-600 text-sm font-medium mr-1" onClick={() => setShowThread(false)}>← Back</button>
                <div>
                  <div className="font-semibold text-neutral-900">{selected.otherPartyName}</div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {messages.map(msg => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm',
                        isMe ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-neutral-100 text-neutral-900 rounded-bl-sm'
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div className="px-4 py-3 border-t border-neutral-200 flex gap-2">
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                  placeholder="Type a message..."
                  className="input flex-1"
                />
                <button onClick={send} disabled={sending || !text.trim()} className="btn-primary px-4">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
