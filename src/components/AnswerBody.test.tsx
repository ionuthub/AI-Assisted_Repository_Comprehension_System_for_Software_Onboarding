import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AnswerBody from './AnswerBody';

const ANSWER = [
  '### Mechanism of Action',
  '',
  'The registry maps a type to its handler.',
  '',
  '**Key Types Involved**',
  '',
  '* `ReferralType` from `../../types/domain`',
  '- `RouteHandler`, a function signature',
  '',
  'There are exactly **two** places where this happens.',
].join('\n');

describe('AnswerBody', () => {
  it('adds no wrapper element', () => {
    const { container } = render(<AnswerBody content={ANSWER} />);
    const tags = Array.from(container.children).map((el) => el.tagName);
    expect(tags).not.toContain('DIV');
    expect(tags).toEqual(['H3', 'P', 'H4', 'UL', 'P']);
  });

  it('renders headings, bullets and paragraphs', () => {
    const { container } = render(<AnswerBody content={ANSWER} />);
    expect(container.querySelector('h3')?.textContent).toBe('Mechanism of Action');
    expect(container.querySelector('h4')?.textContent).toBe('Key Types Involved');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('drops blank lines rather than emitting empty paragraphs', () => {
    const { container } = render(<AnswerBody content={'one\n\n\ntwo'} />);
    expect(container.querySelectorAll('p')).toHaveLength(2);
  });

  it('renders inline bold markers inside paragraphs', () => {
    const { container } = render(<AnswerBody content={'There are exactly **two** places.'} />);
    expect(container.querySelector('strong')?.textContent).toBe('two');
  });

  it('renders code, headings and ordered lists without interpreting HTML', () => {
    const { container } = render(<AnswerBody content={'#### Detail\n3. Use `file.ts`\n4. Check **both**\n```ts\n**literal**\n<img src=x onerror=alert(1)>\n```\n<script>alert(1)</script>'} />);
    expect(container.querySelector('h4')?.textContent).toBe('Detail');
    expect(container.querySelector('ol')).toHaveAttribute('start', '3');
    expect(container.querySelector('li code')?.textContent).toBe('file.ts');
    expect(container.querySelector('pre code')?.textContent).toContain('**literal**');
    expect(container.querySelector('script, img')).toBeNull();
  });

  it('preserves an unfinished code block', () => {
    const { container } = render(<AnswerBody content={'```ts\nconst x = 1;'} />);
    expect(container.querySelector('pre')?.textContent).toBe('const x = 1;');
  });
});
