import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { FactCheckReport, ChatMessage } from '@/types';
import { factCheckAssistantService } from '../services/factCheckAssistantService';

// Define the props the component will accept
interface FactCheckAssistantProps {
  report: FactCheckReport;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Verity: Your AI Fact-Check Assistant
 * An interactive chat component to help users explore fact-check reports.
 */
export const FactCheckAssistant: React.FC<FactCheckAssistantProps> = ({ report, isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      content: "Hello! I'm Verity, your AI assistant. How can I help you understand this fact-check report?",
      timestamp: Date.now()
    }
  ]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Automatically scroll to the latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Handle form submission
  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: query,
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    const currentQuery = query;
    setQuery('');
    setIsLoading(true);

    try {
      const response = await factCheckAssistantService.getAssistantResponse(report, newMessages, currentQuery);
      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          content: response,
          timestamp: Date.now()
        }
      ]);
    } catch (error) {
      console.error("Assistant Error:", error);
      setMessages(prev => [
          ...prev,
        {
            role: 'model',
            content: "I'm sorry, but I encountered an error. Please try asking your question again.",
            timestamp: Date.now()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render the component if it's not open
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 w-full max-w-md bg-white border border-gray-300 rounded-lg shadow-2xl flex flex-col h-[60vh] z-50">
      <header className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
        <h3 className="font-bold text-lg">Verity - Your AI Assistant</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl" aria-label="Close Assistant">&times;</button>
      </header>
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-xs shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="p-3 rounded-lg bg-gray-200 animate-pulse">...</div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="p-4 border-t flex items-center space-x-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about the report..."
          className="flex-1 p-2 border rounded-full focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
};
