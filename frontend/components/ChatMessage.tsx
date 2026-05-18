import { Bot, User } from 'lucide-react';

import type { ChatMessage as ChatMessageType } from '@/lib/types';

export function ChatMessage({ message }: { message: ChatMessageType }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-[20px] rounded-br-md bg-[#7C3AED] px-4 py-3 text-white shadow-[0_0_0_1px_rgba(124,58,237,0.2),0_20px_50px_rgba(124,58,237,0.18)]">
          <p className="text-sm leading-6">{message.content}</p>
          <p className="mt-2 text-right text-[11px] uppercase tracking-[0.22em] text-white/70">{message.timestamp}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#7C3AED] shadow-[0_14px_36px_rgba(15,23,42,0.1)]">
        <Bot className="h-5 w-5" />
      </div>
      <div className="max-w-[82%] rounded-[20px] rounded-tl-md bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.1)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ background: '#F3EEFF', color: '#6D28D9' }}>
            <User className="h-3.5 w-3.5" />
            Agent: {message.agent_used ?? 'Assistant'}
          </span>
          <span className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{message.timestamp}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message.content}</p>
      </div>
    </div>
  );
}
