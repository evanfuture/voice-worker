<conversation_history>
╭───────────────────────────────────────────────────────────────╮
│ > > Describe the main pieces of this system's architecture. │
╰───────────────────────────────────────────────────────────────╯

✦ Based on the file structure, this appears to be a sophisticated, asynchronous file-processing system
with a web-based management UI. Here's a breakdown of its main architectural components:

1. Web Interface & API (The web/ directory)

This is a full-stack web application, likely built with Nuxt.js (a Vue.js framework), that serves as
the primary control panel for the system.

- Frontend (`web/pages`, `web/components`): A rich user interface that allows users to:
  - View and manage files (files.vue).
  - Monitor the status of processing jobs (jobs.get.ts, status.get.ts).
  - See cost summaries, likely for external API usage (cost-summary.get.ts).
  - Manually approve or reject completed jobs (approval.vue, approve-jobs.post.ts).
  - Configure and manage the available processors (processors.vue, processor-configs.\*.ts).
- Backend API (`web/server/api`): A comprehensive RESTful API built into the Nuxt.js server. It acts
  as the bridge between the user-facing frontend and the core processing engine.
- Real-time Communication (`web/server/routes/_ws.ts`): The presence of a WebSocket file (\_ws.ts)
  indicates that the frontend receives real-time updates from the backend, likely for pushing live
  job status changes without needing to refresh the page.

2. Core Processing Engine (The core/ directory)

This is the heart of the system, responsible for the actual data processing. It's designed to run
independently and asynchronously.

- Asynchronous Job Queue (`core/queue/client.ts`): This is a critical architectural pattern. When a
  new task is created (like processing a new file), it's not handled immediately. Instead, it's added
  to a queue. This allows the system to manage long-running tasks efficiently, retry failed jobs, and
  not get overwhelmed by sudden bursts of work.
- File Watcher (`core/watcher/client.ts`): This component likely monitors a specific directory
  (perhaps dropbox/) for new files. When a file appears, it triggers the entire processing pipeline
  by adding a new job to the queue.
- Modular Processors (`core/processors/`): The actual work is broken down into a series of distinct,
  chainable steps. The filenames suggest a workflow like this:
  1.  convert-video: Prepares a video file.
  2.  transcribe: Converts the video's audio to text.
  3.  comprehend-video: Performs some form of analysis on the video content.
  4.  summarize: Uses a prompt from the prompts/ directory to create a text summary.
- Service Layer (`core/lib/service-layer.ts`): This abstracts the business logic, making the system
  more maintainable and testable by separating concerns.

3. Supporting Components

- Database (`core/db/client.ts`): The system uses a database to persist state. This would include
  information about files, the status of each processing job, job chains, metadata, and processor
  configurations.
- Command-Line Interface (`cli/index.ts`): A CLI provides a way for developers or administrators to
  interact with, manage, or debug the system from the command line, bypassing the web UI.
- Cost Calculation (`core/utils/cost-calculator.ts`): A dedicated utility for calculating the cost of
  operations. This is crucial if the processors rely on pay-per-use external AI services (like
  transcription or summarization APIs).

Overall Workflow

1.  A user or an automated process places a file into a monitored directory (e.g., dropbox/).
2.  The File Watcher detects the new file and adds a job (or a chain of jobs) to the Job Queue.
3.  The Core Processing Engine picks up the job from the queue.
4.  It executes the required Processors in sequence (e.g., Convert -> Transcribe -> Summarize).
5.  The status and results of each step are saved to the Database.
6.  The Web UI reads data from the database via its API and displays the progress in real-time to the
    user using WebSockets.
7.  The user can then view the results, see the costs, and perform management actions like approving
    the final output.

╭─────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ > Where are points of confusion around functionality, where does it seem like bugs are likely to │
│ emerge? │
╰─────────────────────────────────────────────────────────────────────────────────────────────────────╯

✦ Excellent question. Based on the architecture, here are the primary areas where functionality is
ambiguous and where bugs are most likely to surface.

Points of Confusion Around Functionality

These are areas where the intent and mechanism of the system are not fully clear from the file
structure alone.

1.  Job Chaining and Configuration:

    - The Ambiguity: The system clearly has a concept of "processors" (core/processors/) and
      "processor configurations" (web/server/api/processor-configs.\*.ts). However, it's not clear how
      these processors are chained together for a given file. Is there a default, hardcoded pipeline
      (e.g., convert -> transcribe -> summarize)? Or can a user define custom pipelines through the UI
      (processors.vue)? The existence of files-with-chains.get.ts suggests the latter, but the
      mechanism for creating and assigning these chains is a major unknown.

2.  The "Approval" Workflow:

    - The Ambiguity: The API has multiple endpoints related to approvals (pending-approval.get.ts,
      approve-jobs.post.ts, approval-batches.\*.ts). What exactly is being approved?
      - Is it the final, summarized text?
      - Is it the cost? The predicted-jobs.get.ts endpoint is highly suggestive. It could mean the
        system runs a cheap pre-analysis, predicts the cost of the full job, and then waits for
        user approval before proceeding with the expensive work. This is a sophisticated and
        important workflow, but its exact trigger and behavior are unclear.

3.  How are Jobs Initiated?

    - The Ambiguity: The core/watcher/client.ts strongly implies a "hot folder" (dropbox/) workflow.
      Is this the only way to add files? There are no obvious API endpoints in web/server/api/ for
      file uploads. This is a significant functional gap. If the only method is the hot folder, the
      UI is purely for monitoring, not for initiating work.

4.  The Role of "Parsers":
    - The Ambiguity: The web UI has a parsers.vue page, but there's no corresponding concept in the
      core/ processing engine. What are these parsers? Are they related to how files are initially
      read before being put into the queue? Are they a separate, unrelated feature? Their function is
      an open question.

Likely Bug Hotspots

These are architecturally sensitive areas where issues commonly arise in systems of this complexity.

1.  State Management and Race Conditions:

    - The Hotspot: The entire asynchronous flow is ripe for state-related bugs. The system's state is
      distributed across the file system (dropbox/), the queue, and the database.
    - Potential Bugs:
      - File Watcher Conflicts: What happens if a file in dropbox/ is modified while it's being
        processed? The watcher might ignore it, or it might create a duplicate job, leading to
        wasted resources and confusing results.
      - Database Contention: If two different processes (e.g., the summarize processor and a user
        action from the UI) try to update the same job record in the database simultaneously, it
        could lead to data corruption unless there are proper database transactions or optimistic
        locking in place.
      - UI/Backend Desynchronization: The UI gets real-time updates via WebSockets (\_ws.ts), but if
        that connection fails, the user might see stale data and perform actions (like retrying a
        job) that are no longer valid.

2.  Error Handling in Chained Jobs:

    - The Hotspot: A multi-step processing chain (convert -> transcribe -> summarize) is a complex
      failure domain.
    - Potential Bugs:
      - Partial Success: If transcribe succeeds but summarize fails, what is the overall status of
        the job? The system needs a clear, robust way to represent and handle this state. The
        retry-failed.post.ts endpoint is good, but does it retry the entire chain or just the
        failed step? Retrying the whole chain could be expensive and unnecessary.
      - Poison Pills: A malformed file or a persistent external API failure could create a job that
        always fails. If the retry logic is too aggressive, this "poison pill" job could get stuck
        in a loop, consuming queue resources indefinitely.

3.  Configuration Mismatches:

    - The Hotspot: The system's logic is split between the core engine and the web UI, with
      configuration stored in the database. This creates opportunities for a mismatch.
    - Potential Bugs: A user might be able to create a "processor configuration" via the UI that the
      backend core code doesn't actually know how to handle. This would lead to jobs that are
      accepted by the system but then immediately fail or get stuck because no processor can service
      them.

4.  Resource Management:
    - The Hotspot: Processors like convert-video.ts are likely very CPU and memory-intensive.
    - Potential Bugs: If the queue is not configured to limit how many of these heavy jobs can run
      concurrently, a user dropping 10 large video files into the dropbox could overwhelm the server,
      starving the web UI and other critical services of resources and potentially crashing the entire
      machine.

╭──────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ > Are you able to infer the longer-term plan for this app from the code? Can you define the most │
│ important functionality? │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────╯

✦ Of course. By analyzing the file structure, architectural patterns, and specific "tells" in the
codebase, we can infer the project's trajectory and define its core value proposition.

The Longer-Term Plan: An "AI-Powered Assembly Line"

The clues in the repository point towards a much more ambitious long-term vision than just a simple
file processor. The goal appears to be creating a highly automated, intelligent, and extensible
"assembly line" for digital content, with a strong emphasis on integrating with professional creative
and development workflows.

Here are the key pieces of evidence for this plan:

1.  AI-Driven Agency (`AGENT_TODOS.md`): The presence of a file named AGENT_TODOS.md is the most
    significant clue. In a software context, an "Agent" is a system that acts autonomously to achieve
    goals. This implies the long-term plan is for the application to do more than just execute a
    predefined sequence of tasks. The vision is likely for it to:

    - Intelligently select processors based on file type or content.
    - Predict outcomes, such as the cost or time required for a job (predicted-jobs.get.ts).
    - Potentially, self-correct or retry failed jobs using different strategies.

2.  Deep Integration with Design Workflows (`FIGMA_INTEGRATION.md`): This document reveals a plan to
    bridge the gap between design and automated processing. This is a high-value feature that
    suggests the target audience includes design and product teams, not just engineers. The plan
    could involve:

    - Automatically processing assets (images, icons, text) exported from Figma.
    - Using AI processors to generate documentation or even code components directly from design
      specifications.
    - The sophisticated design token system (web/assets/tokens/, .github/workflows/design-tokens.yml)
      reinforces this, showing a commitment to a professional, design-system-driven front-end.

3.  An Extensible, "Pluggable" Processor Architecture (`core/processors/`): The current processors
    (convert-video, transcribe, summarize) are just the beginning. The modular architecture is
    designed to be a framework where new capabilities can be easily added. The long-term plan is
    almost certainly to build a rich library of processors for handling various tasks:
    - Image analysis (object recognition, tagging).
    - Structured data extraction from documents (e.g., invoices, PDFs).
    - Code generation or analysis.

The Most Important Functionality

While the system has many parts, its single most important function—the core value it provides—is
cost-controlled, human-supervised, asynchronous processing.

Let's break down why this is the critical concept:

1.  Asynchronous Processing: This is the architectural foundation. The use of a job queue
    (core/queue/) is the key technical decision that allows the system to handle tasks that are slow
    and resource-intensive (like video processing or calling large language models) without
    collapsing. It ensures the system is scalable, resilient, and responsive.

2.  Cost Control: This is the critical business function. The most powerful AI models are expensive,
    and costs can spiral out of control. This application treats cost as a first-class citizen:

    - core/utils/cost-calculator.ts: A dedicated module for tracking expenses.
    - web/server/api/cost-summary.get.ts: An endpoint to make costs visible to the user.
    - predicted-jobs.get.ts: The ability to forecast costs before committing to the expensive work.

3.  Human Supervision (The Approval Workflow): This is what makes the system practical and
    trustworthy for high-stakes work. The multiple API endpoints for approvals
    (pending-approval.get.ts, approve-jobs.post.ts, approval-batches.\*.ts) are not just a feature;
    they are central to the entire philosophy. This workflow provides a crucial "off-ramp," allowing
    a user to review the predicted cost and expected outcome before giving the final go-ahead. It
    combines the power of automation with the judgment of a human, which is essential for managing
    both quality and budget.

In short, while the long-term vision is a sophisticated AI agent, the most important functionality
today is providing a reliable, predictable, and financially responsible way to run complex processing
pipelines.

╭────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ > Ok, so here was my initial intent, I'd like you to consider what parts of the codebase (as you │
│ neatly described previously) should be kept/discarded/adapted to more closely align with it: I │
│ envision a system that evolves on user demand to create machines around │
│ processing/transcribing/summarising/etc/etc/ pieces of content. So, like a living machine that │
│ continuously recieves new input (new pieces of info, new videos in the dropbox, new images with │
│ tags, etc), and incorporates that into its living outputs. We want it to be efficient, so the │
│ chains of dependecies within the graph are important, but the outputs are key. Something like │
│ "today's youtube monologe" which relies on previous draft scripts that come from analysis of │
│ improvised video recordings. Any of these might be human-in-the-loop too, because many machine │
│ flows will have an llm agent as part of their functionality, and any agent can be given tools to │
│ use (including a tool to request user-input). Cost is important because we're looking for a 24/7 │
│ monitoring of data that will change many times per day. We need to know how much each change │
│ might cost, if we can, to keep an eye on it and slow it down if necessary (adjust the queue or │
│ skip things or delay their processing, or batch them, etc). │
╰────────────────────────────────────────────────────────────────────────────────────────────────────────╯

✦ Thank you for that clarification. This vision is significantly more dynamic and powerful than a simple
processing pipeline. You're describing a self-organizing, event-driven system that builds and maintains
a living graph of interconnected data. It's less of a factory assembly line and more of a "content
nervous system."

This is a fantastic and achievable vision. The good news is that many components in your current
codebase are excellent foundations. However, the core architectural abstractions need to be elevated
to match this new goal.

Here’s a breakdown of what to keep, what to adapt, and what to discard.

Keep & Enhance: The Foundations are Solid

These components are well-aligned with your vision and form the bedrock of the new system.

- `core/processors/` (Keep & Enhance): This is the heart of your "create-a-machine" concept. These
  modular, single-responsibility processors are the perfect building blocks.

  - How to Enhance: They need to be standardized. Each processor should explicitly declare its
    inputs (the types of data it can handle) and its outputs (the type of data it produces). This
    will allow the system to dynamically chain them together.

- `core/utils/cost-calculator.ts` (Keep & Enhance): Your focus on cost is critical for a 24/7 system.
  This component is essential.

  - How to Enhance: Integrate its predictions more deeply into the core logic. The system should be
    able to use cost forecasts to make autonomous decisions (delaying, batching, alerting) beyond
    just waiting for a manual human approval.

- `web/server/api/` (Keep & Enhance): A strong API is crucial for observing and interacting with a
  complex system.

  - How to Enhance: The API will need new endpoints to expose the dependency graph, the status of
    "living outputs," and to receive human input for in-flight jobs.

- `AGENT_TODOS.md` / `FIGMA_INTEGRATION.md` (Keep): These documents confirm that the high-level,
  agentic, and integration-focused direction was the right one all along. They are your north stars.

Adapt Significantly: Evolve the Core Abstractions

These components are based on a simpler "pipeline" model and need to be fundamentally adapted to the
"living graph" model.

- `core/queue/client.ts` (Adapt): A simple FIFO (First-In, First-Out) queue is no longer sufficient.

  - The Problem: A queue processes jobs in order. Your vision requires that a job (e.g., "summarize
    script") can only run after its dependencies (e.g., "transcribe video") are complete.
  - The Adaptation: This needs to evolve into a Graph Scheduler or a Dependency-Aware Job Runner.
    Instead of just adding a job to a queue, you would "notify" the system that a piece of data has
    been updated. The scheduler would then look at the dependency graph and automatically trigger
    any downstream processes whose inputs are now ready.

- `core/db/client.ts` (Adapt): The database is currently designed to track discrete jobs. It needs to
  be redesigned to track the graph itself.

  - The Problem: It stores a list of jobs, not the relationships between them.
  - The Adaptation: The database schema must become the source of truth for the dependency graph.
    It needs to store nodes (the pieces of content, or "living outputs") and edges (the processors
    that transform one node into another). It will track versions of content and the dependencies
    between them.

- The "Approval" Workflow (`web/pages/approval.vue`, etc.) (Adapt): This concept is good, but too
  narrow.
  - The Problem: It's framed as a simple yes/no gate, likely for cost.
  - The Adaptation: This should be generalized into a "Human Input Service." This is precisely the
    "tool to request user-input" you described. Any processor in the graph should be able to pause
    its execution, send a request to this service (e.g., "Choose the best of these three
    summaries," "Provide a title for this document"), and wait for a human to respond via the UI
    before continuing. The UI would feature a "task inbox" instead of just an approval list.

Discard / Deprioritize: Legacy Concepts

These components are tied to the old model and can be replaced by the new, more powerful abstractions.

- `core/watcher/client.ts` (Discard/Replace): The "hot folder" concept is too limiting.
  - The Problem: It only allows file-based input. Your vision includes "new pieces of info," which
    could come from anywhere (API calls, webhooks, database changes).
  - The Replacement: This should be replaced by a more generic Ingestion Service. This service would
    have multiple entry points (a folder watcher, a set of API endpoints, a webhook receiver) and
    its only job would be to place new information into the graph as a "source node." The Graph
    Scheduler then takes over.

Summary of the Shift

Your new system is defined by one major conceptual shift:

┌──────────────────────────────────┬───────────────────────────────────────────────────────┐
│ From (Old Model) │ To (New Vision) │
├──────────────────────────────────┼───────────────────────────────────────────────────────┤
│ A linear **Pipeline** of jobs │ A dynamic **Dependency Graph** of "living" data │
│ A **Queue** that runs jobs in... │ A **Scheduler** that runs jobs when their inputs a... │
│ A **File Watcher** as the mai... │ An **Ingestion Service** for multiple input types │
│ A binary **Approval** gate │ A flexible **Human-in-the-Loop** service for any task │
│ A UI for **Monitoring** jobs │ A UI for **Composing and Observing** the living graph │
└──────────────────────────────────┴───────────────────────────────────────────────────────┘

The existing code is a fantastic starting point because you've already built the most important
low-level pieces: the processors and the cost calculator. The next step is to build the higher-level
abstractions (the scheduler, the graph database model, the human input service) that will allow these
pieces to work together in the intelligent, dynamic way you've envisioned.

╭────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ > I'd like to challenge you on one point (but I'd like you to re-challenge me if I'm off-base), and │
│ wonder aloud if there's not an elegance in having the file-based input be the source of truth for │
│ the system. Writing files and persisting them in markdown or rich text or json, deleting a file │
│ removes it as a dependency. There are a lot of dependable tools available for working with files, │
│ there's metadata included for free (though maybe some extra meta would need to be tracked │
│ somehow, maybe also in the file system)... It's portable in a way... │
╰────────────────────────────────────────────────────────────────────────────────────────────────────────╯

✦ This is an excellent challenge, and you are absolutely not off-base. You've hit on a very powerful and
elegant concept, one with a rich history in software engineering, particularly within the Unix
philosophy. The idea of using the file system as a tangible, observable, and self-describing database
is incredibly appealing.

Let's fully embrace that idea and see where it leads.

The Elegance: The File System as a "Makeflow" Database

The system you're describing is, in essence, a supercharged version of the make utility. In a
Makefile, you define targets (files) and their dependencies (other files). When you run make, it looks
at the file modification times and re-builds only what's necessary.

This approach is brilliant for:

1.  Simplicity & Tangibility: The state of the system is visible with ls. You can cat a file to see
    its content. You can rm a file to invalidate a part of the graph. There's no hidden state in a
    database you have to query.
2.  Portability: You can zip up the entire state of your system, move it, and have it work somewhere
    else. Backups are as simple as rsync.
3.  Tooling: You get to leverage decades of battle-hardened command-line tools for searching (grep,
    find), transforming (sed, awk), and managing the data.

For a certain class of problems, this is not just a valid approach; it's the best approach.

The Re-Challenge: Scaling in Complexity, Not Just Volume

The core of my re-challenge is this: your vision's richness, particularly around state, cost, and
human-in-the-loop interactions, introduces a level of complexity that the file system's metadata model
is not designed to handle gracefully.

Here are the specific points where the file-system-as-database model begins to break down under the
weight of your specific requirements:

1. The Challenge of Rich State:
   A file's metadata primarily tells you its name, size, and when it was last modified. Your system needs
   to track a much richer state for every single node in the graph:

- pending
- processing
- succeeded
- failed (retrying in 10m)
- failed (needs human intervention)
- waiting_for_human_input (prompt: 'Please provide a title')
- paused (cost exceeds budget)

How do you represent this? You could use file naming conventions (my_video.mp4.processing,
my_video.mp4.failed), but this becomes incredibly brittle. What if a process crashes mid-rename? You
now have an inconsistent state.

2. The Challenge of Representing Relationships:
   A file can easily represent a node. Representing the edges (the dependencies) is much harder.

- One-to-One: video.mp4 -> video.transcript.md (Easy, can be done with naming conventions).
- Many-to-One: chapter1.txt + chapter2.txt -> book.pdf. How do you name book.pdf to reflect its
  multiple parents?
- Querying Relationships: How do you ask the question: "What will break if I delete video.mp4?" You'd
  have to scan the entire file system for files that follow a specific naming convention. This is slow
  and inefficient compared to a single, indexed database query.

3. The Challenge of Atomic Operations:
   Your system needs to perform atomic updates. For example, when a summarization job finishes, you must:
1. Write the new summary.md file.
1. Update its state from processing to succeeded.
1. Record the final cost of the job.
1. Trigger the next job in the chain.

A database transaction wraps all of these steps into a single, all-or-nothing operation. With a file
system, these are separate, sequential actions. If the system crashes between steps 2 and 3, you have
a succeeded job with no recorded cost—a permanently inconsistent state.

The Synthesis: A Hybrid Model (The Best of Both Worlds)

This is where I believe the most robust and elegant solution lies. We can keep the spirit of your
file-based approach without being limited by it.

Use the file system for what it's best at: storing the data artifacts.
Use a database for what it's best at: storing the metadata, state, and relationships.

Here’s how it works:

1.  The Database is the Graph: The database (e.g., SQLite for portability, or Postgres for power)
    stores the graph structure. It has tables for nodes and edges. Each node record contains:

    - A unique ID.
    - Its current state (pending, failed, etc.).
    - The cost associated with creating it.
    - A pointer to its data artifact on the file system (e.g., /path/to/data/a1b2c3d4.json).
    - Any prompts for human input.

2.  The File System is the Artifact Store: The actual data (the video, the markdown text, the JSON
    output) lives on the file system. The filenames can be simple content-hashes or UUIDs that match
    the IDs in the database. This keeps the file system clean and simple.

Why this hybrid model is so powerful:

- You get the transactional integrity and querying power of a real database for your critical logic
  (state, cost, dependencies).
- You get the portability and simplicity of a file system for your bulk data. Backing up is still
  just rsync-ing the data directory and dumping the database.
- The database stays small and fast because it only holds metadata.
- The file system logic stays simple because it doesn't need complex naming conventions to manage
  state.

So, my re-challenge is this: the file system is an excellent datastore, but a poor database for the
complex, stateful, and highly relational system you envision. By combining it with a lightweight
database, you get all the benefits you cited without the significant risks to data integrity and
performance.

╭────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ > Haha, well yes, that was going to be my answer, the point being that the metadata in the database │
│ (and I prefer postgres) should play catchup to the file system. If a file is added or deleted, │
│ the database should eventually notice it is there or not and respond by kicking off the necessary │
│ steps to integrate or remove it from the graph. Given that, can you please create a comprehensive │
│ plan to align the codebase with the vision (including a record of that vision to be referenced as │
│ we work on it). │
╰────────────────────────────────────────────────────────────────────────────────────────────────────────╯

✦ Excellent. I am fully aligned with this hybrid vision. It combines the tangible, auditable nature of a
file-based system with the robust, transactional power of a relational database for managing the
complex relationships and state that your system demands.

Here is a comprehensive plan to refactor the codebase to achieve this. We will begin by creating the
VISION.md file to serve as our guiding document throughout the process.

Step 1: Create the Vision Document

First, I will create a VISION.md file in the root of the project. This document will capture the core
principles we've discussed, ensuring that all future development aligns with this clear goal.

╭──────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ ✔ WriteFile Writing to VISION.md │
│ │
│ 1 # Vision: The Content Nervous System │
│ 2 │
│ 3 This document outlines the guiding vision for this project. It is a living document │
│ intended to guide architectural decisions and feature development. │
│ 4 │
│ 5 ## Core Metaphor: A Living Graph │
│ 6 │
│ 7 The system is not a simple, linear pipeline; it is a **self-organizing, │
│ event-driven "nervous system"** for digital content. It continuously receives new │
│ input (files, data, user feedback) and incorporates it into a living, │
│ interconnected graph of information. │
│ 8 │
│ 9 The goal is to create "living outputs"—pieces of content like reports, video │
│ summaries, or draft scripts that automatically update and evolve as their source │
│ dependencies change. │
│ 10 │
│ 11 ## Guiding Principles │
│ 12 │
│ 13 1. **The File System is the Source of Truth for Artifacts.** │
│ 14 _ All primary data (videos, images, text files, JSON data) is stored directly │
│ on the file system. │
│ 15 _ This makes the system's data tangible, portable, and accessible with │
│ standard tools. │
│ 16 _ A file's existence or non-existence is a primary event. Deleting a file │
│ means removing it and its dependents from the graph. │
│ 17 │
│ 18 2. **The Database is the Source of Truth for Metadata and State.** │
│ 19 _ A relational database (PostgreSQL) tracks the _relationships_ between │
│ files, their processing **state**, their **cost**, and other critical metadata that │
│ doesn't fit naturally on the file system. │
│ 20 _ The database "plays catch-up" to the file system. Its primary role is to │
│ model the graph and manage the state of its nodes. │
│ 21 _ All operations that require transactional integrity (e.g., updating state │
│ and cost simultaneously) are handled by the database. │
│ 22 │
│ 23 3. **Execution is Dependency-Driven, Not Queue-Driven.** │
│ 24 _ We do not use a simple First-In, First-Out queue. │
│ 25 _ A **Scheduler** constantly observes the graph. A process is only triggered │
│ when all of its input dependencies are met (i.e., their state is `succeeded`). │
│ 26 _ This allows for a complex, branching, and resilient workflow. │
│ 27 │
│ 28 4. **Human-in-the-Loop is a First-Class Citizen.** │
│ 29 _ Any process in the graph can pause and request human input. │
│ 30 _ This is not just a binary "approval" gate but a core tool that can be used │
│ for clarification, selection, or content creation. │
│ 31 _ The system should provide a clear UI for users to see and respond to these │
│ requests. │
│ 32 │
│ 33 5. **Cost is a Primary Decision-Making Metric.** │
│ 34 _ The cost of every operation is tracked and forecasted where possible. │
│ 35 _ This data is not just for reporting; the system can use it to make │
│ autonomous decisions like pausing expensive workflows, batching jobs, or alerting │
│ users. │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────╯
✦ Excellent. With the VISION.md in place, we have a clear target. Here is a comprehensive plan to
refactor the codebase. This plan prioritizes foundational changes first (database and core logic)
before moving to user-facing features.

The Refactoring Plan

---

Phase 1: Establish the Graph Foundation (Database & Core Models)

The goal of this phase is to replace the old job-centric database schema with one that can represent a
dependency graph.

1.  Define the New Database Schema:

    - I will create a new document at docs/DATABASE_SCHEMA.md to define the tables for our graph
      model. This will include:
      - nodes: To represent every file artifact. It will store the file path, state (new,
        processing, succeeded, failed, waiting_for_human_input), cost, and other metadata.
      - edges: A simple join table to define the dependencies (source_node_id, target_node_id),
        creating the graph structure.
      - human_input_requests: To store requests for user feedback, linking them to a specific node.

2.  Update Database Client:
    - I will modify core/db/client.ts and web/server/utils/db.ts to use and expose the new schema.
      For now, this will involve replacing the existing Prisma schema or database setup with the new
      graph-based model.

---

Phase 2: Reinvent the Core Logic (The Scheduler)

This phase replaces the linear queue with a dependency-aware scheduler.

1.  Create the Scheduler:

    - I will create a new core/scheduler/ directory.
    - The new scheduler.ts will contain the core logic:
      - It will periodically query the database for nodes that are ready to be processed (i.e.,
        their dependencies have a succeeded state).
      - It will be responsible for invoking the correct processor for a given node.
      - It will update the state of nodes in the database (processing, succeeded, failed).

2.  Standardize Processors:

    - I will refactor the modules in core/processors/. Each processor will be updated to:
      - Be called by the Scheduler, not a queue worker.
      - Receive a node ID as input.
      - Interact with the database to create its output node record and the corresponding edge
        linking it back to its source.
      - Write its output artifact to the file system.

3.  Deprecate the Old Queue:
    - The core/queue/client.ts will be marked for deprecation and its logic will be bypassed in favor
      of the new Scheduler.

---

Phase 3: Synchronize the Real World (File System Watcher)

This phase makes the system aware of its environment.

1.  Rewrite the Watcher:
    - I will completely refactor core/watcher/client.ts. Its new responsibilities will be:
      - Initial Scan: On startup, scan the dropbox/ directory and reconcile it with the nodes table
        in the database. It will create new node records for untracked files and mark nodes as
        orphaned if their corresponding file is missing.
      - Live Monitoring: Watch for add and unlink events in the directory. An add event creates a
        new node in the database with the state new. An unlink event triggers the process of
        orphaning that node and its dependents.

---

Phase 4: Adapt the User Interface

This phase updates the UI to reflect the new underlying model. This will be an iterative process.

1.  Refactor API Endpoints:

    - I will overhaul the API endpoints in web/server/api/.
    - Endpoints like jobs.get.ts and failed-jobs.get.ts will be replaced with nodes.get.ts, which can
      be filtered by state (e.g., /api/nodes?state=failed).
    - New endpoints will be created to visualize the graph, e.g., /api/nodes/[id]/dependencies.

2.  Update UI (Initial Version):

    - The initial UI change will be to replace the job-centric pages (files.vue, processors.vue) with
      a single, powerful "Graph Explorer" view.
    - At first, this can be a simple table-based view of all the nodes from the database, showing
      their state, cost, and relationships. A full graphical visualization can be a future goal.

3.  Implement Human-in-the-Loop UI:
    - I will create a new page and API for the "Human Input" system. This will be a simple inbox where
      users can see pending requests and submit their feedback, which will un-pause the waiting
      nodes.

I will now proceed with Phase 1, Step 1: Define the New Database Schema by creating the
docs/DATABASE_SCHEMA.md file. Shall I proceed?

╭────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ > You need a way to return to that plan as you work, decide how would you prefer to do that and then │
│ you can carry on. Don't forget that you can also pause to ask me what you need. │
╰────────────────────────────────────────────────────────────────────────────────────────────────────────╯

✦ You've made an excellent point. To ensure I don't lose track of the plan across multiple interactions,
I will adopt the following process:

1.  Persist the Plan: I will save the complete, multi-phase plan we've just discussed into a file
    named REFACTORING_PLAN.md in the project's root directory.
2.  Re-orient at Each Step: Before beginning work on a new phase or a major step, I will first read
    the contents of REFACTORING_PLAN.md. This will serve as my "state check" to ensure I know exactly
    what has been done and what needs to happen next.
3.  Communicate My Focus: After reading the plan, I will explicitly state which phase and step I am
    about to execute.

This approach makes the plan a durable artifact within the project itself, and my process for
executing it will be transparent and predictable.

I will now proceed. First, I'll create the REFACTORING_PLAN.md file. Then, I will begin Phase 1.
</conversation_history>
