// src/components/FactCheckAssistant.tsx
import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { FactCheckReport, ChatMessage } from '@/types';
import { factCheckAssistantService } from '../services/factCheckAssistantService';
import ReactMarkdown from 'react-markdown';

interface FactCheckAssistantProps {
  report: FactCheckReport;
  isOpen: boolean;
  onClose: () => void;
  originalContent: string;
}

// Quick action suggestions
const QUICK_ACTIONS = [
  { label: '🔍 Explain Evidence', query: 'Explain the evidence sources and their credibility' },
  { label: '✏️ Auto-Correct', query: 'Suggest corrections for my content based on the fact-check' },
  { label: '📋 Generate Schema', query: 'Generate Schema.org markup for this fact-check' },
  { label: '✍️ Rewrite Content', query: 'Rewrite my content to be more factually accurate' },
  { label: '⭐ Editorial Review', query: 'Provide an editorial review of my content' },
  { label: '🔬 Verify Claim', query: 'Help me verify a specific claim' }
];

export const FactCheckAssistant: React.FC<FactCheckAssistantProps> = ({ 
  report, 
  isOpen, 
  onClose, 
  originalContent 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      content: `Hello! I'm **Verity**, your AI editorial assistant. I can help you with:

- 🔍 Explaining evidence and sources
- ✏️ Auto-correcting content based on fact-checks
- 📋 Generating Schema.org markup
- ✍️ Rewriting content for accuracy
- ⭐ Providing editorial reviews
- 🔬 Verifying specific claims
- 🔎 Conducting additional research

**What would you like help with?**`,
      timestamp: Date.now()
    }
  ]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Focus input when opened
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: query,
      timestamp: Date.now()
    };

    const newMessages: ChatMessage[] = [...messages, userMessage];
    setMessages(newMessages);
    const currentQuery = query;
    setQuery('');
    setIsLoading(true);
    setShowQuickActions(false); // Hide quick actions after first query

    try {
      const response = await factCheckAssistantService.getAssistantResponse(
        report,
        newMessages,
        currentQuery,
        originalContent
      );

      const modelMessage: ChatMessage = {
        role: 'model',
        content: response,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, modelMessage]);

    } catch (error) {
      console.error("❌ Assistant Error:", error);
      const errorMessage: ChatMessage = {
        role: 'model',
        content: "I apologize, but I encountered an error processing your request. This might be due to:\n\n- API configuration issues\n- Network connectivity\n- Rate limiting\n\nPlease check your API keys and try again, or rephrase your question.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickAction = (actionQuery: string) => {
    setQuery(actionQuery);
    setShowQuickActions(false);
    // Auto-submit after brief delay for UX
    setTimeout(() => {
      const form = document.getElementById('assistant-form') as HTMLFormElement;
      form?.requestSubmit();
    }, 100);
  };

  const handleClearChat = () => {
    setMessages([
      {
        role: 'model',
        content: `Chat cleared! I'm **Verity**, your AI editorial assistant. How can I help you with this fact-check report?`,
        timestamp: Date.now()
      }
    ]);
    setShowQuickActions(true);
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className={`fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-2xl flex flex-col z-50 transition-all duration-300 ${
        isMinimized ? 'w-80 h-16' : 'w-full max-w-2xl h-[70vh]'
      }`}
    >
      {/* Header */}
      <header className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
            V
          </div>
          <div>
            <h3 className="font-bold text-lg text-gray-800">Verity</h3>
            <p className="text-xs text-gray-600">AI Editorial Assistant</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleClearChat}
            className="text-gray-500 hover:text-gray-800 p-2 rounded hover:bg-gray-200 transition-colors"
            aria-label="Clear Chat"
            title="Clear Chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            onClick={toggleMinimize}
            className="text-gray-500 hover:text-gray-800 p-2 rounded hover:bg-gray-200 transition-colors"
            aria-label={isMinimized ? "Maximize" : "Minimize"}
            title={isMinimized ? "Maximize" : "Minimize"}
          >
            {isMinimized ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            )}
          </button>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-800 text-2xl px-2 hover:bg-gray-200 rounded transition-colors" 
            aria-label="Close Assistant"
          >
            &times;
          </button>
        </div>
      </header>

      {/* Messages Area */}
      {!isMinimized && (
        <>
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`rounded-lg shadow-sm max-w-[85%] ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white p-3' 
                      : 'bg-white border border-gray-200 p-4'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          // Custom rendering for links
                          a: ({ node, ...props }) => (
                            <a 
                              {...props} 
                              className="text-blue-600 hover:text-blue-800 underline" 
                              target="_blank" 
                              rel="noopener noreferrer"
                            />
                          ),
                          // Custom rendering for code blocks
                          code: ({ node, inline, ...props }) => (
                            inline ? (
                              <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono" {...props} />
                            ) : (
                              <code className="block bg-gray-100 p-2 rounded text-sm font-mono overflow-x-auto" {...props} />
                            )
                          ),
                          // Custom rendering for lists
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc pl-5 space-y-1" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="list-decimal pl-5 space-y-1" {...props} />
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  <p className="text-xs mt-2 opacity-60">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-sm text-gray-600">Verity is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {showQuickActions && messages.length <= 2 && (
            <div className="p-4 border-t bg-white">
              <p className="text-xs font-semibold text-gray-700 mb-2">Quick Actions:</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ACTIONS.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickAction(action.query)}
                    className="text-left p-2 text-xs bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-colors"
                    disabled={isLoading}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Form */}
          <form 
            id="assistant-form"
            onSubmit={handleSend} 
            className="p-4 border-t bg-white flex items-center space-x-2"
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask Verity to analyze, edit, or verify..."
              className="flex-1 p-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Sending</span>
                </>
              ) : (
                <>
                  <span>Send</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );
};
