import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const CORE_ARTEFACT_COMMIT = "85ab075065732b3652acabf8f67d2cee33e14d6f";

type RepositoryKey = "warehouse-dispatch" | "clinic-triage";
type Condition = "manual" | "codemap";
type SequenceId = "A" | "B" | "C" | "D";
type Phase = "setup" | "prepare-condition" | "tasks" | "nasa" | "sus" | "feedback" | "complete";
type NasaKey = "mentalDemand" | "physicalDemand" | "temporalDemand" | "performance" | "effort" | "frustration";

type StudyTask = {
  id: number;
  category: "orientation" | "type-processing" | "cross-cutting" | "change-impact";
  title: string;
  prompt: string;
};

type TaskResult = StudyTask & {
  answer: string;
  completed: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  durationSeconds: number;
};

type ConditionAssignment = {
  condition: Condition;
  repositoryKey: RepositoryKey;
};

type NasaResponses = Record<NasaKey, number | null>;
type CompletedNasaResponses = Record<NasaKey, number>;

type ConditionResult = {
  order: number;
  condition: Condition;
  repository: {
    name: string;
    url: string;
    commit: string;
  };
  tasks: TaskResult[];
  nasaTlx: {
    responses: NasaResponses;
    rawScore: number | null;
  };
};

const REPOSITORIES: Record<
  RepositoryKey,
  { label: string; url: string; commit: string; tasks: StudyTask[] }
> = {
  "warehouse-dispatch": {
    label: "warehouse-dispatch",
    url: "https://github.com/ionuthub/warehouse-dispatch",
    commit: "937be9d5598f81703e95c1a3ce2a2ec234287ee9",
    tasks: [
      {
        id: 1,
        category: "orientation",
        title: "Project orientation",
        prompt: "Where does execution start in this project? Describe the startup flow.",
      },
      {
        id: 2,
        category: "type-processing",
        title: "Type-specific processing",
        prompt:
          "Which code decides how a given order type is processed? Explain how the correct handler is selected.",
      },
      {
        id: 3,
        category: "cross-cutting",
        title: "Cross-cutting behaviour",
        prompt:
          "Stock is reserved in more than one place in this codebase. Find every production place where it happens. Test files do not count.",
      },
      {
        id: 4,
        category: "change-impact",
        title: "Change-impact reasoning",
        prompt:
          "A new order type is to be added. Where would you add it, and what else would need to change for the application to work?",
      },
    ],
  },
  "clinic-triage": {
    label: "clinic-triage",
    url: "https://github.com/ionuthub/clinic-triage",
    commit: "67d7a5a0c37452946876b0e7626b6c882888d4f0",
    tasks: [
      {
        id: 1,
        category: "orientation",
        title: "Project orientation",
        prompt: "Where does execution start in this project? Describe the startup flow.",
      },
      {
        id: 2,
        category: "type-processing",
        title: "Type-specific processing",
        prompt:
          "Which code decides how a given referral type is processed? Explain how the correct route handler is selected.",
      },
      {
        id: 3,
        category: "cross-cutting",
        title: "Cross-cutting behaviour",
        prompt:
          "Eligibility is checked in more than one place in this codebase. Find every production place where it happens. Test files do not count.",
      },
      {
        id: 4,
        category: "change-impact",
        title: "Change-impact reasoning",
        prompt:
          "A new referral type is to be added. Where would you add it, and what else would need to change for the application to work?",
      },
    ],
  },
};

const SEQUENCES: Record<SequenceId, [ConditionAssignment, ConditionAssignment]> = {
  A: [
    { condition: "manual", repositoryKey: "warehouse-dispatch" },
    { condition: "codemap", repositoryKey: "clinic-triage" },
  ],
  B: [
    { condition: "codemap", repositoryKey: "clinic-triage" },
    { condition: "manual", repositoryKey: "warehouse-dispatch" },
  ],
  C: [
    { condition: "manual", repositoryKey: "clinic-triage" },
    { condition: "codemap", repositoryKey: "warehouse-dispatch" },
  ],
  D: [
    { condition: "codemap", repositoryKey: "warehouse-dispatch" },
    { condition: "manual", repositoryKey: "clinic-triage" },
  ],
};

// Fixed before data collection: three balanced blocks of four participants.
const RANDOMISED_SEQUENCE: SequenceId[] = ["A", "D", "B", "C", "C", "B", "D", "A", "D", "A", "C", "B"];

const NASA_DIMENSIONS: { key: NasaKey; label: string; low: string; high: string }[] = [
  { key: "mentalDemand", label: "Mental Demand", low: "Low", high: "High" },
  { key: "physicalDemand", label: "Physical Demand", low: "Low", high: "High" },
  { key: "temporalDemand", label: "Temporal Demand", low: "Low", high: "High" },
  { key: "performance", label: "Performance", low: "Perfect", high: "Failure" },
  { key: "effort", label: "Effort", low: "Low", high: "High" },
  { key: "frustration", label: "Frustration", low: "Low", high: "High" },
];

const NASA_VALUES = Array.from({ length: 21 }, (_, index) => index * 5);

const SUS_ITEMS = [
  "I think that I would like to use this system frequently.",
  "I found the system unnecessarily complex.",
  "I thought the system was easy to use.",
  "I think that I would need the support of a technical person to be able to use this system.",
  "I found the various functions in this system were well integrated.",
  "I thought there was too much inconsistency in this system.",
  "I would imagine that most people would learn to use this system very quickly.",
  "I found the system very cumbersome to use.",
  "I felt very confident using the system.",
  "I needed to learn a lot of things before I could get going with this system.",
];

function emptyNasaResponses(): NasaResponses {
  return {
    mentalDemand: null,
    physicalDemand: null,
    temporalDemand: null,
    performance: null,
    effort: null,
    frustration: null,
  };
}

function calculateSusScore(responses: number[]): number {
  const contribution = responses.reduce((total, value, index) => {
    return total + (index % 2 === 0 ? value - 1 : 5 - value);
  }, 0);
  return contribution * 2.5;
}

function calculateRawNasaTlx(responses: CompletedNasaResponses): number {
  const values = NASA_DIMENSIONS.map((dimension) => responses[dimension.key]);
  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10;
}

function participantNumberFromId(value: string): number | null {
  const match = value.trim().match(/^P?(\d+)$/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function Study() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [participantId, setParticipantId] = useState("");
  const [sequenceId, setSequenceId] = useState<SequenceId | null>(null);
  const [conditionIndex, setConditionIndex] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [taskIndex, setTaskIndex] = useState(0);
  const [taskStartedAt, setTaskStartedAt] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [currentTaskResults, setCurrentTaskResults] = useState<TaskResult[]>([]);
  const [conditionResults, setConditionResults] = useState<ConditionResult[]>([]);
  const [nasaResponses, setNasaResponses] = useState<NasaResponses>(emptyNasaResponses());
  const [susResponses, setSusResponses] = useState<(number | null)[]>(Array(10).fill(null));
  const [helped, setHelped] = useState("");
  const [difficult, setDifficult] = useState("");
  const [preferred, setPreferred] = useState("");

  const participantNumber = useMemo(() => participantNumberFromId(participantId), [participantId]);
  const sequence = sequenceId ? SEQUENCES[sequenceId] : null;
  const assignment = sequence?.[conditionIndex] ?? null;
  const repository = assignment ? REPOSITORIES[assignment.repositoryKey] : null;
  const currentTask = repository?.tasks[taskIndex] ?? null;
  const nasaComplete = NASA_DIMENSIONS.every((dimension) => nasaResponses[dimension.key] !== null);
  const susComplete = susResponses.every((value) => value !== null);

  const susScore = useMemo(() => {
    if (!susComplete) return null;
    return calculateSusScore(susResponses as number[]);
  }, [susComplete, susResponses]);

  const prepareSession = () => {
    if (!participantNumber) return;
    const assignedSequence = RANDOMISED_SEQUENCE[(participantNumber - 1) % RANDOMISED_SEQUENCE.length];
    setSequenceId(assignedSequence);
    setConditionIndex(0);
    setPhase("prepare-condition");
  };

  const beginTasks = () => {
    if (!assignment || !repository) return;
    const now = Date.now();
    if (!sessionStartedAt) setSessionStartedAt(new Date(now).toISOString());
    setTaskIndex(0);
    setTaskStartedAt(now);
    setPhase("tasks");
  };

  const finishTask = (completed: boolean) => {
    if (!currentTask || !taskStartedAt || (completed && !answer.trim())) return;
    const now = Date.now();
    const durationMs = now - taskStartedAt;
    setCurrentTaskResults((results) => [
      ...results,
      {
        ...currentTask,
        answer: completed ? answer.trim() : "",
        completed,
        startedAt: new Date(taskStartedAt).toISOString(),
        completedAt: new Date(now).toISOString(),
        durationMs,
        durationSeconds: Math.round(durationMs / 100) / 10,
      },
    ]);
    setAnswer("");

    if (repository && taskIndex === repository.tasks.length - 1) {
      setTaskStartedAt(null);
      setPhase("nasa");
    } else {
      setTaskIndex((index) => index + 1);
      setTaskStartedAt(now);
    }
  };

  const submitNasa = () => {
    if (!assignment || !repository) return;
    const completedResponses = nasaResponses as CompletedNasaResponses;
    const result: ConditionResult = {
      order: conditionIndex + 1,
      condition: assignment.condition,
      repository: {
        name: repository.label,
        url: repository.url,
        commit: repository.commit,
      },
      tasks: currentTaskResults,
      nasaTlx: {
        responses: completedResponses,
        rawScore: nasaComplete ? calculateRawNasaTlx(completedResponses) : null,
      },
    };

    setConditionResults((results) => [...results, result]);
    setCurrentTaskResults([]);
    setNasaResponses(emptyNasaResponses());
    setTaskIndex(0);

    if (conditionIndex === 0) {
      setConditionIndex(1);
      setPhase("prepare-condition");
    } else {
      setPhase("sus");
    }
  };

  const exportSession = () => {
    if (!sessionStartedAt || !sequenceId || conditionResults.length !== 2) return;
    const completedAt = new Date().toISOString();
    const payload = {
      schemaVersion: 5,
      protocolVersion: "comparative-v2-optional-responses",
      participant: {
        id: participantId.trim(),
        eligibility: "current-year-3-computer-science-student",
      },
      coreArtefactCommit: CORE_ARTEFACT_COMMIT,
      assignment: {
        sequenceId,
        sequence: SEQUENCES[sequenceId],
        method: "pre-randomised-balanced-block",
      },
      session: {
        startedAt: sessionStartedAt,
        completedAt,
      },
      conditions: conditionResults,
      sus: {
        appliesTo: "codemap",
        responses: susResponses,
        score: susScore,
      },
      feedback: {
        codemapHelped: helped.trim(),
        codemapDifficult: difficult.trim(),
        preferredMethodAndWhy: preferred.trim(),
      },
    };

    const safeId = participantId.trim().replace(/[^a-zA-Z0-9_-]+/g, "-") || "participant";
    downloadJson(`study-${safeId}-comparative.json`, payload);
    setPhase("complete");
  };

  const resetSession = () => {
    setPhase("setup");
    setParticipantId("");
    setSequenceId(null);
    setConditionIndex(0);
    setSessionStartedAt(null);
    setTaskIndex(0);
    setTaskStartedAt(null);
    setAnswer("");
    setCurrentTaskResults([]);
    setConditionResults([]);
    setNasaResponses(emptyNasaResponses());
    setSusResponses(Array(10).fill(null));
    setHelped("");
    setDifficult("");
    setPreferred("");
  };

  return (
    <main className="container mx-auto max-w-4xl px-4 py-10 pb-16 md:px-8 md:pb-20">
      <div className="mb-8">
        <p className="text-metadata uppercase tracking-wider text-muted-foreground">Research study</p>
        <h1 className="mt-2 text-view font-semibold text-foreground">Repository comprehension evaluation</h1>
        <p className="mt-3 max-w-2xl text-body text-muted-foreground">
          Compare manual repository inspection with Codemap. Use only the study ID provided by the researcher; do not enter your name or email address.
        </p>
      </div>

      {phase !== "complete" && (
        <aside className="mb-6 space-y-3 rounded-lg border border-border p-4">
          <p className="text-body text-muted-foreground">
            Taking part is voluntary. You may skip any question or stop at any time.
            Stopping clears this session without exporting it. It does not delete a file already exported;
            contact the researcher about withdrawal of an exported record.
          </p>
          <Button variant="outline" onClick={() => {
            if (window.confirm("Stop participating and discard this unexported session?")) resetSession();
          }}>Stop participating and discard session</Button>
        </aside>
      )}

      {phase === "setup" && (
        <section className="space-y-6 rounded-lg border border-border bg-card p-6">
          <p className="rounded-md border border-border bg-muted/30 p-4 text-ui text-muted-foreground">
            Eligibility: current Year 3 Computer Science student. Eligibility is confirmed by the researcher during recruitment.
          </p>

          <div className="space-y-2">
            <Label htmlFor="participant-id">Participant ID</Label>
            <Input
              id="participant-id"
              value={participantId}
              onChange={(event) => setParticipantId(event.target.value)}
              placeholder="e.g. P01"
              autoComplete="off"
            />
            <p className="text-metadata text-muted-foreground">Use the allocated ID format P01, P02, P03, and so on.</p>
          </div>

          <Button onClick={prepareSession} disabled={!participantNumber}>
            Prepare session
          </Button>
        </section>
      )}

      {phase === "prepare-condition" && assignment && repository && (
        <section className="space-y-6 rounded-lg border border-border bg-card p-6">
          <div>
            <p className="text-metadata text-muted-foreground">Condition {conditionIndex + 1} of 2</p>
            <h2 className="mt-1 text-section font-semibold text-foreground">
              {assignment.condition === "manual" ? "Manual repository inspection" : "Codemap"}
            </h2>
            <p className="mt-2 text-body text-muted-foreground">
              Repository: <span className="font-medium text-foreground">{repository.label}</span>
            </p>
          </div>

          {assignment.condition === "manual" ? (
            <div className="space-y-4">
              <p className="text-body text-muted-foreground">
                Open the repository on GitHub. During the timed tasks use only the GitHub web interface, including normal file navigation and built-in code search. Do not use Codemap, another AI tool, an IDE, or an external search engine.
              </p>
              <Button variant="outline" onClick={() => window.open(repository.url, "_blank", "noopener,noreferrer")}>
                Open repository on GitHub
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-body text-muted-foreground">
                Open Codemap in a second tab, analyse the repository below, and wait until the workspace is ready. During the timed tasks use only Codemap.
              </p>
              <div className="rounded-md border border-border bg-code-background p-4 font-mono text-ui text-foreground">
                {repository.url}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => window.open("/", "_blank", "noopener,noreferrer")}>
                  Open Codemap in new tab
                </Button>
                <Button variant="outline" onClick={() => navigator.clipboard?.writeText(repository.url)}>
                  Copy repository URL
                </Button>
              </div>
            </div>
          )}

          <div className="border-t border-border pt-5">
            <Button onClick={beginTasks}>Begin timed tasks</Button>
          </div>
        </section>
      )}

      {phase === "tasks" && assignment && repository && currentTask && (
        <section className="space-y-6 rounded-lg border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-metadata text-muted-foreground">
                {assignment.condition === "manual" ? "Manual" : "Codemap"} · Task {taskIndex + 1} of {repository.tasks.length}
              </p>
              <h2 className="mt-1 text-section font-semibold text-foreground">{currentTask.title}</h2>
            </div>
            <span className="rounded-full border border-border px-3 py-1 text-metadata text-muted-foreground">
              {repository.label}
            </span>
          </div>

          <p className="text-body font-medium text-foreground">{currentTask.prompt}</p>

          <div className="space-y-2">
            <Label htmlFor="task-answer">Your answer</Label>
            <Textarea
              id="task-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              rows={8}
              placeholder="Write your answer here. Include file paths or code locations where relevant."
            />
          </div>

          <p className="text-metadata text-muted-foreground">
            The timer stops when you submit or skip this task. Answers cannot be edited after submission.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => finishTask(true)} disabled={!answer.trim()}>
              {taskIndex === repository.tasks.length - 1 ? "Submit task and continue" : "Submit and next task"}
            </Button>
            <Button variant="outline" onClick={() => finishTask(false)}>
              Unable to answer / skip
            </Button>
          </div>
        </section>
      )}

      {phase === "nasa" && assignment && (
        <section className="space-y-7 rounded-lg border border-border bg-card p-6">
          <div>
            <h2 className="text-section font-semibold text-foreground">NASA-TLX</h2>
            <p className="mt-2 text-body text-muted-foreground">
              Rate the workload you experienced during the {assignment.condition === "manual" ? "manual" : "Codemap"} condition. Each response is optional. A score is calculated only if all six scales are answered.
            </p>
          </div>

          {NASA_DIMENSIONS.map((dimension) => (
            <div key={dimension.key} className="space-y-2 border-b border-border pb-5 last:border-0">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor={`nasa-${dimension.key}`}>{dimension.label}</Label>
                <span className="text-metadata text-muted-foreground">{dimension.low} → {dimension.high}</span>
              </div>
              <select
                id={`nasa-${dimension.key}`}
                value={nasaResponses[dimension.key] ?? ""}
                onChange={(event) =>
                  setNasaResponses((responses) => ({
                    ...responses,
                    [dimension.key]: event.target.value === "" ? null : Number(event.target.value),
                  }))
                }
                className="h-10 w-full rounded-md border border-control-border bg-input px-3 text-ui text-foreground focus-ring"
              >
                <option value="">Prefer not to answer</option>
                {NASA_VALUES.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
          ))}

          <Button onClick={submitNasa}>
            {conditionIndex === 0 ? "Continue to second condition" : "Continue"}
          </Button>
        </section>
      )}

      {phase === "sus" && (
        <section className="space-y-7 rounded-lg border border-border bg-card p-6">
          <div>
            <h2 className="text-section font-semibold text-foreground">System Usability Scale</h2>
            <p className="mt-2 text-body text-muted-foreground">
              Thinking only about Codemap, select one response from 1 (strongly disagree) to 5 (strongly agree). Each response is optional. A score is calculated only if all ten items are answered.
            </p>
          </div>

          {SUS_ITEMS.map((item, index) => (
            <fieldset key={item} className="space-y-3 border-b border-border pb-5 last:border-0">
              <legend className="text-ui font-medium text-foreground">
                {index + 1}. {item}
              </legend>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-ui text-muted-foreground">
                  <input type="radio" name={`sus-${index}`} checked={susResponses[index] === null}
                    onChange={() => setSusResponses((responses) => responses.map((response, responseIndex) => responseIndex === index ? null : response))} />
                  Prefer not to answer
                </label>
                {[1, 2, 3, 4, 5].map((value) => (
                  <label key={value} className="flex items-center gap-2 text-ui text-muted-foreground">
                    <input
                      type="radio"
                      name={`sus-${index}`}
                      value={value}
                      checked={susResponses[index] === value}
                      onChange={() =>
                        setSusResponses((responses) =>
                          responses.map((response, responseIndex) => (responseIndex === index ? value : response)),
                        )
                      }
                    />
                    {value}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <Button onClick={() => setPhase("feedback")}>
            Continue
          </Button>
        </section>
      )}

      {phase === "feedback" && (
        <section className="space-y-6 rounded-lg border border-border bg-card p-6">
          <div>
            <h2 className="text-section font-semibold text-foreground">Final questions</h2>
            <p className="mt-2 text-body text-muted-foreground">These questions are optional. Leave any question blank if you prefer not to answer.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="helped">What helped you understand the repository when using Codemap?</Label>
            <Textarea id="helped" value={helped} onChange={(event) => setHelped(event.target.value)} rows={4} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="difficult">What was difficult or confusing when using Codemap?</Label>
            <Textarea id="difficult" value={difficult} onChange={(event) => setDifficult(event.target.value)} rows={4} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferred">Compared with manual browsing, which approach did you prefer and why?</Label>
            <Textarea id="preferred" value={preferred} onChange={(event) => setPreferred(event.target.value)} rows={4} />
          </div>

          <Button onClick={exportSession}>
            Export participant data
          </Button>
        </section>
      )}

      {phase === "complete" && (
        <section className="space-y-5 rounded-lg border border-border bg-card p-6">
          <h2 className="text-section font-semibold text-foreground">Session complete</h2>
          <p className="text-body text-muted-foreground">
            The pseudonymised JSON record has been exported. The researcher will mark the eight written answers separately against the verified reference answers.
          </p>
          <Button onClick={resetSession}>Start next participant</Button>
        </section>
      )}
    </main>
  );
}
