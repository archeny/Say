// by Stenly
'use client';

import React, { useState, useEffect, useRef, FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Menu, Plus, Diamond, Settings2, Globe, Disc2, SendHorizontal, Mic, ChevronDown, ChevronUp } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
  isStreaming?: boolean;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [deviceId, setDeviceId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [useSearch, setUseSearch] = useState(false);
  const [useThink, setUseThink] = useState(true);

  useEffect(() => {
    let sId = localStorage.getItem('overchat_session_id');
    let dId = localStorage.getItem('overchat_device_id');

    if (!sId) {
      sId = uuidv4();
      localStorage.setItem('overchat_session_id', sId);
    }
    if (!dId) {
      dId = uuidv4();
      localStorage.setItem('overchat_device_id', dId);
    }

    setSessionId(sId);
    setDeviceId(dId);

    fetchHistory(sId);
  }, []);

  const fetchHistory = async (sId: string) => {
    try {
      const res = await fetch(`/api/history?sessionId=${sId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        scrollToBottom();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantId = uuidv4();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', isStreaming: true },
    ]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: sessionId,
          deviceId: deviceId,
          messages: [...messages, userMessage],
        }),
      });

      if (!response.body) throw new Error('No readable stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let assistantAnswer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantAnswer += chunk;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, content: assistantAnswer } : msg
          )
        );
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: 'Terjadi kesalahan saat memuat balasan.' }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId ? { ...msg, isStreaming: false } : msg
        )
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <button className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold text-gray-800">Sapaan ramah dan tawaran bantuan</h1>
          <div className="flex items-center gap-1 mt-0.5 text-xs text-blue-600 font-medium">
            <Diamond className="w-3 h-3 fill-blue-600" />
            <span>Pakar</span>
          </div>
        </div>

        <button className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
          <Plus className="w-5 h-5" />
        </button>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-32">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 shadow-sm">
              <Diamond className="w-8 h-8 text-blue-500 fill-blue-500/20" />
            </div>
            <p className="text-sm">Mulai percakapan baru...</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'user' ? (
              <div className="max-w-[85%] bg-blue-50/80 rounded-3xl rounded-tr-sm px-5 py-3 text-sm text-gray-800 break-words shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                {msg.content}
              </div>
            ) : (
              <div className="w-full flex flex-col gap-2 max-w-[95%]">
                {/* Thinking Block */}
                {useThink && (
                  <div className="flex items-start mb-2 group">
                    <button className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 bg-transparent rounded px-2 py-1 transition-colors">
                      <span className="font-medium">Berpikir selama {msg.isStreaming ? '...' : 'beberapa'} detik</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                )}
                
                {/* Assistant Content */}
                <div className="prose prose-sm prose-slate max-w-none prose-p:leading-relaxed prose-li:my-0 prose-ul:my-2 w-full text-sm text-gray-800">
                  {msg.content === '' && msg.isStreaming ? (
                    <span className="inline-flex gap-1 items-center h-6">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                    </span>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-white via-white to-transparent pt-12">
        <form 
          onSubmit={handleSubmit}
          className="w-full bg-white border border-gray-200/80 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] rounded-3xl p-1 flex flex-col focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/50 transition-all"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ketik pesan atau tahan untuk bicara"
            className="w-full max-h-32 min-h-[44px] bg-transparent resize-none outline-none text-sm text-gray-800 placeholder:text-gray-400 px-4 pt-3 pb-2 scrollbar-hide"
            rows={1}
          />
          
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUseThink(!useThink)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  useThink 
                  ? 'bg-blue-50 border-blue-200 text-blue-700' 
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Berpikir</span>
              </button>
              
              <button
                type="button"
                onClick={() => setUseSearch(!useSearch)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  useSearch 
                  ? 'bg-blue-50 border-blue-200 text-blue-700' 
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Cari</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-50 transition-colors"
            >
              {input.trim() ? (
                <SendHorizontal className="w-5 h-5 text-blue-600" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
