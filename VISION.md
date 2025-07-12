# Vision: The Content Nervous System

This document outlines the guiding vision for this project. It is a living document intended to guide architectural decisions and feature development.

## Core Metaphor: A Living Graph

The system is not a simple, linear pipeline; it is a **self-organizing, event-driven "nervous system"** for digital content. It continuously receives new input (files, data, user feedback) and incorporates it into a living, interconnected graph of information.

The goal is to create "living outputs"—pieces of content like reports, video summaries, or draft scripts that automatically update and evolve as their source dependencies change.

## Guiding Principles

1.  **The File System is the Source of Truth for Artifacts.**
    *   All primary data (videos, images, text files, JSON data) is stored directly on the file system.
    *   This makes the system's data tangible, portable, and accessible with standard tools.
    *   A file's existence or non-existence is a primary event. Deleting a file means removing it and its dependents from the graph.

2.  **The Database is the Source of Truth for Metadata and State.**
    *   A relational database (PostgreSQL) tracks the *relationships* between files, their processing **state**, their **cost**, and other critical metadata that doesn't fit naturally on the file system.
    *   The database "plays catch-up" to the file system. Its primary role is to model the graph and manage the state of its nodes.
    *   All operations that require transactional integrity (e.g., updating state and cost simultaneously) are handled by the database.

3.  **Execution is Dependency-Driven, Not Queue-Driven.**
    *   We do not use a simple First-In, First-Out queue.
    *   A **Scheduler** constantly observes the graph. A process is only triggered when all of its input dependencies are met (i.e., their state is `succeeded`).
    *   This allows for a complex, branching, and resilient workflow.

4.  **Human-in-the-Loop is a First-Class Citizen.**
    *   Any process in the graph can pause and request human input.
    *   This is not just a binary "approval" gate but a core tool that can be used for clarification, selection, or content creation.
    *   The system should provide a clear UI for users to see and respond to these requests.

5.  **Cost is a Primary Decision-Making Metric.**
    *   The cost of every operation is tracked and forecasted where possible.
    *   This data is not just for reporting; the system can use it to make autonomous decisions like pausing expensive workflows, batching jobs, or alerting users.
