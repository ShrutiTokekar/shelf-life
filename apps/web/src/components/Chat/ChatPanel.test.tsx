import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { ChatPanel, type ChatPanelProps } from './ChatPanel';

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

function setup(over: Partial<ChatPanelProps> = {}) {
  const props: ChatPanelProps = {
    context: 'Using: 12 pantry items · 2 servings · vegetarian',
    messages: [
      { role: 'user', text: 'I don’t have cheddar.', actions: [] },
      {
        role: 'ai',
        text: 'Use your paneer.',
        actions: [
          { type: 'swap', from: 'Cheddar', to: 'Paneer', amount: '100 g' },
          { type: 'addToList', name: 'Cheddar' },
        ],
        applied: [1],
      },
    ],
    suggestions: ['Exact amounts', 'Make it for 4'],
    pending: false,
    problem: null,
    online: true,
    onSend: vi.fn(),
    onAction: vi.fn(),
    ...over,
  };
  return { props, ...render(<ChatPanel {...props} />) };
}

describe('ChatPanel (RCP-8, RCP-9)', () => {
  it('is a polite log with labeled messages, action buttons, chips, input and the safety footer', async () => {
    const { props, container } = setup();
    const log = screen.getByRole('log', { name: 'Conversation' });
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(within(log).getByText('Use your paneer.').parentElement).toHaveTextContent(
      'Shelf Life AI: Use your paneer.',
    );
    await userEvent.click(within(log).getByRole('button', { name: 'Swap in paneer' }));
    expect(props.onAction).toHaveBeenCalledWith(props.messages[1]!.actions[0], 1, 0);
    expect(within(log).getByRole('button', { name: 'Add cheddar to list, done' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Make it for 4' }));
    expect(props.onSend).toHaveBeenCalledWith('Make it for 4');
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Ask about this recipe' }),
      'More salt?{Enter}',
    );
    expect(props.onSend).toHaveBeenCalledWith('More salt?');
    expect(screen.getByText(/AI can make mistakes\. Double-check allergens/)).toBeInTheDocument();
    // No speech recognition in this browser: no mic.
    expect(screen.queryByRole('button', { name: 'Speak your question' })).toBeNull();
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('offline: says chat needs a connection and disables sending (rule 2)', () => {
    setup({ online: false });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Chat needs a connection. Your recipe is still here.',
    );
    expect(screen.getByRole('textbox', { name: 'Ask about this recipe' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Exact amounts' })).toBeDisabled();
  });

  it('voice: offered only where supported, with the privacy note the first time', async () => {
    const start = vi.fn();
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = class {
      start = start;
      stop = vi.fn();
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
    };
    setup();
    const mic = screen.getByRole('button', { name: 'Speak your question' });
    await userEvent.click(mic);
    expect(start).toHaveBeenCalled();
    expect(mic).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Chrome uses Google’s servers/)).toBeInTheDocument();
  });
});
