// src/components/FactCheckAssistant.tsx
import React, { useState, useEffect, useRef } from 'react';
import { TieredFactCheckResult, ChatMessage } from '../types';
import { factCheckAssistantService } from '../services/factCheckAssistantService';

interface Props {
  report: TieredFactCheckResult;
}

export const FactCheckAssistant: React.FC<Props> = ({ report }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', content: "Hello! Ask me any questions about the generated report." }
  ]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: query }];
    setMessages(newMessages);
    const currentQuery = query;
    setQuery('');
    setIsLoading(true);

    const response = await factCheckAssistantService.getAssistantResponse(report, newMessages, currentQuery);

    setMessages(prev => [...prev, { role: 'model', content: response }]);
    setIsLoading(false);
  };

  return (
    <div className="fixed bottom-4 right-4 w-full max-w-md bg-white border rounded-lg shadow-2xl flex flex-col h-[60vh]">
      <div className="p-4 border-b">
        <h3 className="font-bold text-lg">Fact-Check Assistant</h3>
      </div>
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-xs ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && <div className="justify-start"><div className="p-3 rounded-lg bg-gray-200">...</div></div>}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="p-4 border-t flex space-x-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about the report..."
          className="flex-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-blue-300">
          Send
        </button>
      </form>
    </div>
  );
};
