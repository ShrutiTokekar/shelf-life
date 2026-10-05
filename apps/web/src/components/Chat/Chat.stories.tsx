import { useState } from 'react';
import type { ChatEntry } from '../../stores/cookSession';
import { ChatPanel } from './ChatPanel';
import { SwapCard } from './SwapCard';

const MESSAGES: ChatEntry[] = [
  { role: 'user', text: 'I don’t have cheddar. What can I use?', actions: [] },
  {
    role: 'ai',
    text: 'Use your paneer (expires in 3 days). Grate 100 g and add a pinch of salt. It melts less, so cook 1 minute longer per side.',
    actions: [
      { type: 'swap', from: 'Cheddar', to: 'Paneer', amount: '100 g, grated' },
      { type: 'addToList', name: 'Cheddar' },
    ],
  },
];

export const Panel = () => {
  const [messages, setMessages] = useState(MESSAGES);
  return (
    <div className="h-[40rem] max-w-sm rounded-hero bg-white p-5 bordered">
      <ChatPanel
        context="Using: 42 pantry items · 2 servings · vegetarian"
        messages={messages}
        suggestions={['Exact amounts', 'I’m missing something', 'Make it for 4']}
        pending={false}
        problem={null}
        online
        onSend={(text) => setMessages((m) => [...m, { role: 'user', text, actions: [] }])}
        onAction={(_, mi, ai) =>
          setMessages((m) =>
            m.map((x, i) => (i === mi ? { ...x, applied: [...(x.applied ?? []), ai] } : x)),
          )
        }
        className="h-full"
      />
    </div>
  );
};

export const Offline = () => (
  <div className="max-w-sm">
    <ChatPanel
      context="Using: 42 pantry items · 2 servings · vegetarian"
      messages={[]}
      suggestions={['Exact amounts']}
      pending={false}
      problem="offline"
      online={false}
      onSend={() => undefined}
      onAction={() => undefined}
    />
  </div>
);

export const Swap = () => {
  const [used, setUsed] = useState(false);
  return (
    <div className="max-w-md">
      <SwapCard
        missing="Cheddar"
        swap={{ swap: 'Paneer', amount: '100 g, grated', note: 'It melts less.', adjustments: '' }}
        applied={used}
        onUse={() => setUsed(true)}
      />
    </div>
  );
};
