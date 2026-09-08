import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EvidencePanel, { type RetrievedEvidence } from './EvidencePanel';

const evidence = (
  path: string,
  score: number,
  retrievalReason?: RetrievedEvidence['retrievalReason']
): RetrievedEvidence => ({
  path,
  score,
  excerpt: 'export const x = 1;',
  startLine: 1,
  endLine: 1,
  totalLines: 1,
  omittedLines: 0,
  omittedCharacters: 0,
  retrievalReason,
});

describe('EvidencePanel', () => {
  it.each([
    ['direct', 'Direct match'], ['symbol', 'Symbol match'],
    ['structural', 'Related by imports'], ['entry', 'Likely entry point'],
    ['repository', 'Repository context'], [undefined, 'Retrieval match'],
  ] as const)('labels retrieval reason %s', (reason, label) => {
    render(<EvidencePanel evidence={[evidence('src/a.ts', 0.7, reason)]} unverifiedMentions={[]} isLoading={false} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText('Hybrid match')).not.toBeInTheDocument();
  });
  it('reports what was retrieved rather than judging the answer', () => {
    render(
      <EvidencePanel
        evidence={[evidence('src/a.ts', 0.7, 'symbol'), evidence('src/b.ts', 0.4, 'structural')]}
        unverifiedMentions={[]}
        isLoading={false}
      />
    );
    expect(screen.getByText(/Evidence · 2 files retrieved/)).toBeInTheDocument();
    expect(screen.queryByText(/Grounded/)).not.toBeInTheDocument();
  });

  it('distinguishes the no-evidence state by wording, not colour alone', () => {
    render(<EvidencePanel evidence={[]} unverifiedMentions={[]} isLoading={false} />);
    expect(screen.getByText(/No evidence · 0 files retrieved/)).toBeInTheDocument();
    expect(screen.getByText(/No matching evidence was found in the files searched/)).toBeInTheDocument();
  });

  it('states eligible repository coverage accurately', () => {
    render(
      <EvidencePanel
        evidence={[evidence('src/a.ts', 0.6)]}
        unverifiedMentions={[]}
        isLoading={false}
        indexedFileCount={108}
        totalFileCount={110}
      />
    );
    expect(screen.getByText(/Searched 108 of 110 eligible repository files/)).toBeInTheDocument();
    expect(screen.getByText(/2 eligible files were not readable/)).toBeInTheDocument();
  });

  it('discloses character truncation within a cited line', () => {
    render(
      <EvidencePanel
        evidence={[{ ...evidence('src/long.ts', 0.5), omittedCharacters: 2400 }]}
        unverifiedMentions={[]}
        isLoading={false}
      />
    );
    expect(screen.getByText(/2400 characters not sent/)).toBeInTheDocument();
  });

  it('singularises the count for one file', () => {
    render(
      <EvidencePanel evidence={[evidence('src/a.ts', 0.5)]} unverifiedMentions={[]} isLoading={false} />
    );
    expect(screen.getByText(/Evidence · 1 file retrieved/)).toBeInTheDocument();
  });

  it('labels the ranking reason without presenting it as correctness', () => {
    render(
      <EvidencePanel
        evidence={[evidence('src/a.ts', 0.84, 'symbol')]}
        unverifiedMentions={[]}
        isLoading={false}
        indexedFileCount={12}
        totalFileCount={12}
      />
    );
    expect(screen.getByText('Symbol match')).toBeInTheDocument();
    expect(screen.getByLabelText('Retrieval ranking score 0.84')).toBeInTheDocument();
    expect(screen.getByText(/do not measure answer correctness/)).toBeInTheDocument();
  });
});
