# Database Schema: The Graph Model

This document defines the PostgreSQL schema for the Content Nervous System. The schema is designed to represent a directed acyclic graph (DAG) of content artifacts, their states, and their relationships.

---

### Table: `nodes`

Represents a single piece of content in the system, which corresponds to an artifact on the file system.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | The unique identifier for the node. |
| `artifact_path` | `TEXT` | `UNIQUE`, `NOT NULL` | The absolute path to the data file on the file system. |
| `node_type` | `TEXT` | | The type of processor that can operate on this node (e.g., 'video', 'transcript'). |
| `state` | `TEXT` | `NOT NULL`, `DEFAULT 'new'` | The current processing state of the node. See possible values below. |
| `cost_usd` | `NUMERIC(10, 6)` | `DEFAULT 0.0` | The cumulative cost in USD to generate this node. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Timestamp of when the node was first created. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Timestamp of the last update to the node. |
| `last_error` | `TEXT` | | Stores the last error message if the node's state is `failed`. |

#### `state` Enum Values:

*   `new`: The artifact has been detected but not yet processed.
*   `processing`: A processor is currently working on this node.
*   `succeeded`: The node has been successfully processed.
*   `failed`: Processing failed. See `last_error` for details.
*   `waiting_for_human_input`: The node is paused, awaiting feedback from a user.
*   `orphaned`: The source artifact file is missing from the file system.

---

### Table: `edges`

Represents the dependency relationship between two nodes. This forms the structure of the graph.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `source_node_id` | `UUID` | `FOREIGN KEY (nodes.id) ON DELETE CASCADE` | The ID of the parent/dependency node. |
| `target_node_id` | `UUID` | `FOREIGN KEY (nodes.id) ON DELETE CASCADE` | The ID of the child/dependent node. |
| | | `PRIMARY KEY (source_node_id, target_node_id)` | Ensures a dependency is only represented once. |

---

### Table: `human_input_requests`

Stores requests for human feedback that are blocking a node from proceeding.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | The unique identifier for the request. |
| `node_id` | `UUID` | `FOREIGN KEY (nodes.id) ON DELETE CASCADE` | The node that is waiting for this input. |
| `prompt` | `TEXT` | `NOT NULL` | The question or prompt to display to the user. |
| `response` | `JSONB` | | The user's response, stored as JSON. |
| `status` | `TEXT` | `NOT NULL`, `DEFAULT 'pending'` | `pending`, `completed`, `cancelled` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Timestamp of when the request was created. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | Timestamp of the last update. |
