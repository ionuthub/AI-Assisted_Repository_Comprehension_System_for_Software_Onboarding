import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, GitBranch, CheckCircle2, Loader2, Circle } from "lucide-react";
import CodeViewer from "@/components/CodeViewer";
import FolderTree from "@/components/FolderTree";
import WorkspaceQAView, { type RetrievedEvidence } from "@/components/WorkspaceQAView";
import WorkspaceSearchView from "@/components/WorkspaceSearchView";
import FileInsightsPanel from "@/components/FileInsightsPanel";
import CoveragePanel from "@/components/CoveragePanel";
import SuggestedQuestions from "@/components/SuggestedQuestions";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TAB_MODES, RETRIEVAL } from "@/constants/appConstants";
import { useProjectStore } from "@/store/useProjectStore";
import SEO from "@/components/SEO";
import { recordMetric } from "@/lib/evaluation/metrics";
import { useProjectManagement } from "@/hooks/useProjectManagement";
import { searchRepository, SearchResult } from "@/lib/semanticSearch";
import { retrieveRepositoryEvidence } from "@/lib/retrievalPipeline";
import RepositoryOverview from "@/components/RepositoryOverview";
import { analyzeProject } from "@/lib/projectAnalyzer";
import {
  consumeGenerationStream,
  type GenerationCompleteEvent,
} from "@/lib/generationProtocol";

interface RecentRepoItem {
  name: string;
  url?: string;
  date: string;
  indexed?: number;
  total?: number;
}

const EXAMPLE_REPOSITORY = "https://github.com/expressjs/express";

const INGESTION_STEPS = [
  { phase: "metadata" as const, label: "Resolving repository metadata" },
  { phase: "tree" as const, label: "Reading the file list" },
  { phase: "fetching" as const, label: "Fetching file contents" },
  { phase: "indexing" as const, label: "Building the search index" },
];

function ingestionStepState(
  step: (typeof INGESTION_STEPS)[number]["phase"],
  current?: string
): "done" | "active" | "pending" {
  if (!current) return step === "metadata" ? "active" : "pending";
  const order = INGESTION_STEPS.map((s) => s.phase);
  const stepIndex = order.indexOf(step);
  const currentIndex = order.indexOf(current as (typeof order)[number]);
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "active";
  return "pending";
}

type WorkspaceView = 'overview' | 'code' | 'search' | 'qa';

const WORKSPACE_TABS: { view: WorkspaceView; label: string; matches: WorkspaceView[] }[] = [
  { view: 'overview', label: 'Overview', matches: ['overview'] },
  { view: 'code', label: 'Code', matches: ['code'] },
  { view: 'qa', label: 'Answers', matches: ['qa'] },
];

const Index = () => {
  const { toast } = useToast();
  const {
    mode, setMode,
    project, setProject,
    fileCache,
    selectedFile, setSelectedFile,
    selectedLine, setSelectedLine,
    selectedLines, setSelectedLines,
    isLoading,
    isFileLoading,
    scanResult,
    staticAnalyses,
    searchIndex
  } = useProjectStore();

  const overview = useMemo(() => {
    if (!project) return null;
    return analyzeProject(project);
  }, [project]);

  const [searchParams] = useSearchParams();

  const excludedPathReasons = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of project?.ingestion?.excluded ?? []) map[item.path] = item.reason;
    return map;
  }, [project]);

  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('overview');
  const showsFileChrome = workspaceView === 'code';
  const [searchVal, setSearchVal] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");
  const [qaEvidence, setQaEvidence] = useState<RetrievedEvidence[]>([]);
  const [isQaLoading, setIsQaLoading] = useState(false);
  const [qaGenerationStatus, setQaGenerationStatus] = useState<
    'idle' | 'loading' | 'complete' | 'error'
  >('idle');
  const [qaCompletion, setQaCompletion] = useState<GenerationCompleteEvent | null>(null);

  const [githubUrl, setGithubUrl] = useState("");
  const [recentRepos, setRecentRepos] = useState<RecentRepoItem[]>([]);

  const {
    handleAnalyze,
    handleFileSelect,
    ingestionProgress
  } = useProjectManagement();

  const handleLineSelect = (lineNumber: number, isMultiSelect?: boolean) => {
    if (!currentFileContent) return;
    setSelectedLine(lineNumber);
    if (!isMultiSelect) {
      setSelectedLines(new Set([lineNumber]));
      return;
    }
    const next = new Set(selectedLines);
    if (next.has(lineNumber)) next.delete(lineNumber);
    else next.add(lineNumber);
    setSelectedLines(next);
  };

  useEffect(() => {
    const saved = localStorage.getItem("recent_repos");
    if (saved) {
      try {
        setRecentRepos(JSON.parse(saved));
      } catch (e) {
        console.warn("Failed to parse recent repos", e);
      }
    }
  }, []);

  const addRecentRepo = useCallback((name: string, url?: string, indexed?: number, total?: number) => {
    setRecentRepos((prev) => {
      const list = [...prev];
      const existingIndex = list.findIndex(r => r.name === name || (url && r.url === url));
      if (existingIndex !== -1) list.splice(existingIndex, 1);
      list.unshift({ name, url, date: new Date().toLocaleDateString(), indexed, total });
      const trimmed = list.slice(0, 5);
      localStorage.setItem("recent_repos", JSON.stringify(trimmed));
      return trimmed;
    });
  }, []);

  useEffect(() => {
    if (project) {
      const name = project.summary.name;
      const url = project.summary.source === 'github' ? githubUrl : undefined;
      addRecentRepo(
        name,
        url,
        project.ingestion?.filesWithContent,
        project.ingestion?.totalCandidateFiles ?? project.files.length
      );
      setWorkspaceView('overview');
    }
  }, [project, githubUrl, addRecentRepo]);

  const handleGithubAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) {
      toast({ title: "URL required", description: "Please enter a valid GitHub repository URL.", variant: "destructive" });
      return;
    }
    setMode(TAB_MODES.GITHUB);
    handleAnalyze(githubUrl, "");
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchVal.trim() || !searchIndex || !project) return;
    setWorkspaceView('search');
    setSearchQuery(searchVal);
    const results = searchRepository(searchVal, searchIndex, project.files, RETRIEVAL.SEARCH_RESULT_LIMIT);
    setSearchResults(results);
  };

  const runQuestion = async (questionText: string) => {
    if (!questionText.trim() || !project) return;

    setWorkspaceView('qa');
    setQaQuestion(questionText);
    setIsQaLoading(true);
    setQaGenerationStatus('loading');
    setQaCompletion(null);
    setQaAnswer("");
    setQaEvidence([]);

    const qaStart = performance.now();
    let systemContext = "Use the repository evidence below to answer the question. Cite the files you rely on and separate direct evidence from inference.";

    const retrieved = searchIndex
      ? retrieveRepositoryEvidence(questionText, searchIndex, project.files, staticAnalyses, {
          candidateFiles: RETRIEVAL.RAG_CANDIDATE_FILES,
          structuralSeeds: RETRIEVAL.RAG_STRUCTURAL_SEEDS,
          maxEvidenceFiles: RETRIEVAL.RAG_TOP_K,
          excerptChars: RETRIEVAL.RAG_CONTEXT_CHARS,
        })
      : [];

    const evidence: RetrievedEvidence[] = retrieved.map((item) => ({
      path: item.path,
      score: item.score,
      excerpt: item.excerpt,
      startLine: item.startLine,
      retrievalReason: item.reason,
      endLine: item.endLine,
      totalLines: item.totalLines,
      omittedLines: item.omittedLines,
      omittedCharacters: item.omittedCharacters,
    }));

    if (retrieved.length > 0) {
      systemContext += "\n\n[Repository evidence selected from lexical, symbol and import relationships]";
      for (const item of retrieved) {
        systemContext += `\n\n--- File: ${item.path} (lines ${item.startLine}-${item.endLine} of ${item.totalLines}) ---\n${item.excerpt}`;
      }
    }

    const evidenceFileCount = evidence.length;
    setQaEvidence(evidence);

    if (evidenceFileCount === 0) {
      systemContext += "\n\n[No repository context could be retrieved for this question. Say so explicitly in the first sentence and do not describe repository-specific files, functions or behaviour.]";
    }

    try {
      const response = await fetch('/api/explain-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: questionText }],
          systemContext,
          stream: true
        })
      });

      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure.error || `Generation request failed (${response.status})`);
      }

      if (!response.body) throw new Error('Response body was empty');

      let fullText = "";
      const completion = await consumeGenerationStream(response.body, (text) => {
        fullText += text;
        setQaAnswer(fullText);
      });
      if (!fullText.trim()) throw new Error('Generation completed without an answer');

      setQaAnswer(fullText);
      setQaCompletion(completion);
      setQaGenerationStatus('complete');
      const outputTokens = completion.usageMetadata?.candidatesTokenCount;
      recordMetric(
        'qa_response',
        performance.now() - qaStart,
        `question ${questionText.length} chars, ${evidenceFileCount} evidence files, ` +
          `finish ${completion.finishReason}, output tokens ${outputTokens ?? 'unknown'}`
      );
    } catch (error) {
      console.error("QA error:", error);
      setQaGenerationStatus('error');
      setQaCompletion(null);
      setQaAnswer(
        `Answer generation did not complete: ${
          error instanceof Error ? error.message : 'unknown generation error'
        }. Please try again.`
      );
    } finally {
      setIsQaLoading(false);
    }
  };

  const displayedFiles = useMemo(() => {
    if (!project) return [];
    return project.files.map((file) => {
      const cached = fileCache[file.path];
      return cached ? { ...file, ...cached } : file;
    });
  }, [project, fileCache]);

  const selectedFileEntry = selectedFile
    ? displayedFiles.find((file) => file.path === selectedFile) ?? null
    : null;

  const currentFileContent = selectedFileEntry?.content ?? null;

  return (
    <ErrorBoundary>
      <SEO
        title="Repository Comprehension System"
        description="Understand unfamiliar codebases using a repository overview, code search, and answers grounded in repository evidence."
      />
      <div className="flex flex-col relative overflow-x-hidden min-h-[82vh]">
        <main className="flex-1 container mx-auto px-4 py-8 md:px-8 flex flex-col">
          {!project ? (
            (isLoading || isFileLoading) ? (
              <div className="max-w-2xl w-full mx-auto py-12 animate-fade-in space-y-6">
                <div className="space-y-2">
                  <h1 className="text-view text-foreground">Analysing repository</h1>
                  <p className="text-body text-muted-foreground max-w-[54ch]">
                    Reading the file list, fetching source, and building the search index.
                    Larger repositories take longer.
                  </p>
                </div>

                <ol className="space-y-3">
                  {INGESTION_STEPS.map((step) => {
                    const state = ingestionStepState(step.phase, ingestionProgress?.phase);
                    return (
                      <li key={step.phase} className="flex items-start gap-3">
                        <span className="mt-0.5 w-5 h-5 shrink-0 flex items-center justify-center" aria-hidden="true">
                          {state === "done" ? (
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                          ) : state === "active" ? (
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                          ) : (
                            <Circle className="w-4 h-4 text-foreground-dim" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className={`text-ui ${state === "pending" ? "text-muted-foreground" : "text-foreground"}`}>
                            {step.label}
                            {state === "done" && <span className="sr-only">, complete</span>}
                            {state === "active" && <span className="sr-only">, in progress</span>}
                          </p>

                          {step.phase === "fetching" && ingestionProgress?.phase === "fetching" && (
                            <div className="space-y-1.5">
                              <div
                                className="h-2 rounded-full bg-secondary overflow-hidden"
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={ingestionProgress.total || 1}
                                aria-valuenow={ingestionProgress.completed}
                                aria-label="Fetching repository files"
                              >
                                <div
                                  className="h-full bg-primary transition-all duration-200"
                                  style={{ width: `${Math.round((ingestionProgress.completed / (ingestionProgress.total || 1)) * 100)}%` }}
                                />
                              </div>
                              <p className="text-meta text-muted-foreground">
                                {ingestionProgress.completed} of {ingestionProgress.total} files
                                {ingestionProgress.currentPath && ` · ${ingestionProgress.currentPath}`}
                              </p>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : (
              <div className="max-w-2xl w-full mx-auto py-12 animate-fade-in space-y-8">
                <div className="space-y-2">
                  <h1 className="text-page text-foreground tracking-tight">Analyse a repository</h1>
                  <p className="text-body text-muted-foreground max-w-[54ch]">
                    Paste a public GitHub URL. You get an overview, a searchable index, and
                    answers with the files they came from.
                  </p>
                </div>

                <form onSubmit={handleGithubAnalyze} className="space-y-3">
                  <Label htmlFor="github-url" className="block text-ui font-semibold text-foreground">
                    Repository URL
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      id="github-url"
                      placeholder="https://github.com/expressjs/express"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      className="flex-1 h-12 text-path font-mono bg-input rounded-md focus-visible:ring-primary"
                      disabled={isLoading}
                    />
                    <Button
                      type="submit"
                      className="h-12 px-6 text-ui font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary-glow border-none"
                      disabled={isLoading}
                    >
                      Analyse repository
                    </Button>
                  </div>
                  <p className="text-meta text-muted-foreground">
                    All eligible source and configuration files returned by GitHub are indexed.
                    Installed dependencies, build output, unsupported formats and files over 5 MB are skipped.
                  </p>
                </form>

                <div className="flex items-center gap-4" aria-hidden="true">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-meta text-muted-foreground">or</span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setGithubUrl(EXAMPLE_REPOSITORY);
                      setMode(TAB_MODES.GITHUB);
                      handleAnalyze(EXAMPLE_REPOSITORY, "");
                    }}
                    className="focus-ring rounded-sm text-ui text-primary underline underline-offset-2 hover:text-primary-glow disabled:opacity-50"
                    disabled={isLoading}
                  >
                    Try an example: expressjs/express
                  </button>
                </div>

                {recentRepos.length > 0 && (
                  <section className="space-y-3" aria-label="Recent repositories">
                    <h2 className="text-section text-foreground">Recent repositories</h2>
                    <ul className="rounded-md border border-border divide-y divide-border overflow-hidden bg-card">
                      {recentRepos.map((repo) => (
                        <li key={repo.url ?? repo.name}>
                          <button
                            type="button"
                            onClick={() => {
                              if (repo.url) {
                                setGithubUrl(repo.url);
                                setMode(TAB_MODES.GITHUB);
                                handleAnalyze(repo.url, "");
                              }
                            }}
                            className="focus-ring w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-surface-raised transition-colors"
                          >
                            <span className="min-w-0">
                              <span className="block text-path font-mono text-foreground truncate">{repo.name}</span>
                              <span className="block text-meta text-muted-foreground">
                                {repo.indexed !== undefined && repo.total !== undefined
                                  ? `${repo.indexed} of ${repo.total} eligible files indexed · ${repo.date}`
                                  : repo.date}
                              </span>
                            </span>
                            <span className="text-ui text-primary shrink-0" aria-hidden="true">Open</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )
          ) : (
            <div className="flex flex-col min-h-[82vh] lg:h-[82vh] border border-border rounded-md bg-card overflow-visible lg:overflow-hidden shadow-none animate-fade-in">
              <div className="border-b border-border px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-3 shrink-0 bg-card">
                <div className="flex items-center gap-2 min-w-0">
                  <GitBranch className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                  <span className="text-path font-mono text-foreground truncate max-w-[220px]">
                    {project.summary.owner ? `${project.summary.owner}/${project.summary.name}` : project.summary.name}
                  </span>
                </div>

                <nav aria-label="Workspace views">
                  <ul className="flex items-center gap-1">
                    {WORKSPACE_TABS.map((tab) => {
                      const isCurrent = tab.matches.includes(workspaceView);
                      return (
                        <li key={tab.view}>
                          <button
                            type="button"
                            aria-current={isCurrent ? "page" : undefined}
                            onClick={() => {
                              if (tab.view === 'overview') setSelectedFile(null);
                              if (tab.view === 'code' && !selectedFile && project.files.length > 0) {
                                setSelectedFile(project.files[0].path);
                              }
                              setWorkspaceView(tab.view);
                            }}
                            className={`focus-ring px-3 py-1.5 rounded text-ui transition-colors ${
                              isCurrent
                                ? "bg-surface-raised text-foreground font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {tab.label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5 min-w-0">
                  <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-[240px]">
                    <label htmlFor="workspace-search" className="sr-only">Search the indexed code</label>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="workspace-search"
                      placeholder="Search the code"
                      value={searchVal}
                      onChange={(e) => setSearchVal(e.target.value)}
                      className="pl-9 h-10 text-ui bg-input rounded-md"
                    />
                  </form>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setProject(null);
                      setSelectedFile(null);
                      setWorkspaceView('overview');
                    }}
                    className="h-10 px-4 text-ui rounded-md border-control-border bg-card text-foreground hover:border-primary/60 hover:bg-surface-raised"
                  >
                    New repository
                  </Button>
                </div>
              </div>

              <div className="flex-1 flex flex-col lg:flex-row overflow-visible lg:overflow-hidden">
                {workspaceView === 'overview' ? (
                  <div className="flex-1 h-full overflow-y-auto bg-background/30 flex justify-center">
                    <div className="max-w-5xl w-full p-4 md:p-6 animate-fade-in space-y-8">
                      <RepositoryOverview
                        project={project}
                        overview={overview}
                        staticAnalyses={staticAnalyses}
                        onFileSelect={(path) => {
                          handleFileSelect(path);
                          setWorkspaceView('code');
                        }}
                      />

                      {project.ingestion && (
                        <CoveragePanel
                          indexedFiles={project.ingestion.filesWithContent}
                          eligibleFiles={project.ingestion.totalCandidateFiles}
                          totalRepositoryFiles={project.ingestion.totalRepositoryFiles}
                          excluded={project.ingestion.excluded}
                          treeTruncated={project.ingestion.treeTruncatedByGitHub}
                        />
                      )}

                      <SuggestedQuestions onAsk={runQuestion} />
                    </div>
                  </div>
                ) : (
                  <>
                    {showsFileChrome && (
                      <div className="w-full h-60 lg:w-[280px] lg:h-full shrink-0 border-b lg:border-b-0 lg:border-r border-border/80 overflow-y-auto bg-secondary/5">
                        <FolderTree
                          tree={scanResult?.folderTree || { name: "Root", path: "", type: "folder", children: [] }}
                          selectedFile={selectedFile}
                          onFileSelect={(path) => {
                            handleFileSelect(path);
                            setWorkspaceView('code');
                          }}
                        />
                      </div>
                    )}

                    <div className="w-full flex-1 min-h-[420px] lg:min-h-0 lg:h-full overflow-hidden bg-background/30 flex flex-col">
                      {workspaceView === 'code' && (
                        <div className="h-full flex flex-col">
                          <div className="flex-1 min-h-0">
                            <CodeViewer
                              isLoading={isFileLoading}
                              fileName={selectedFile}
                              fileContent={currentFileContent}
                              onLineSelect={handleLineSelect}
                              selectedLine={selectedLine}
                              selectedLines={selectedLines}
                            />
                          </div>
                        </div>
                      )}

                      {workspaceView === 'search' && (
                        <WorkspaceSearchView
                          query={searchQuery}
                          results={searchResults}
                          indexedFileCount={project.ingestion?.filesWithContent ?? project.files.length}
                          totalFileCount={project.ingestion?.totalCandidateFiles ?? project.files.length}
                          projectFiles={project.files}
                          onBackToOverview={() => setWorkspaceView('overview')}
                          onFileSelect={(path) => {
                            handleFileSelect(path);
                            setWorkspaceView('code');
                          }}
                        />
                      )}

                      {workspaceView === 'qa' && (
                        <WorkspaceQAView
                          question={qaQuestion}
                          answer={qaAnswer}
                          isLoading={isQaLoading}
                          generationStatus={qaGenerationStatus}
                          completion={qaCompletion}
                          evidence={qaEvidence}
                          excludedPaths={excludedPathReasons}
                          indexedFileCount={project.ingestion?.filesWithContent ?? project.files.length}
                          totalFileCount={project.ingestion?.totalCandidateFiles ?? project.files.length}
                          onBackToOverview={() => setWorkspaceView('overview')}
                          onAsk={runQuestion}
                          onFileSelect={(path) => {
                            handleFileSelect(path);
                            setWorkspaceView('code');
                          }}
                        />
                      )}
                    </div>

                    {showsFileChrome && (
                      <div className="w-full max-h-96 lg:w-[320px] lg:max-h-none lg:h-full shrink-0 border-t lg:border-t-0 lg:border-l border-border/80 overflow-y-auto">
                        <FileInsightsPanel
                          path={selectedFile}
                          analysis={selectedFile ? staticAnalyses[selectedFile] : null}
                          onFileSelect={(path) => {
                            handleFileSelect(path);
                            setWorkspaceView('code');
                          }}
                          onAsk={runQuestion}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default Index;
