import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { QueueClient } from "../queue/client.js";
import { DatabaseClient } from "../db/client.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class WebServer {
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private queue: QueueClient;
  private db: DatabaseClient;
  private config: any;

  constructor(config: any) {
    this.config = config;
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.queue = new QueueClient(config.redisHost, config.redisPort);
    this.db = new DatabaseClient(config.dbPath);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(join(__dirname, "public")));
  }

  private setupRoutes(): void {
    // API Routes
    this.app.get("/api/status", async (req, res) => {
      try {
        const counts = await this.queue.getJobCounts();
        const isPaused = await this.queue.isPaused();

        res.json({
          queue: counts,
          isPaused,
          timestamp: Date.now(),
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to get status" });
      }
    });

    this.app.post("/api/pause", async (req, res) => {
      try {
        await this.queue.pauseQueue();
        res.json({ success: true, message: "Queue paused" });
        this.broadcastStatusUpdate();
      } catch (error) {
        res.status(500).json({ error: "Failed to pause queue" });
      }
    });

    this.app.post("/api/resume", async (req, res) => {
      try {
        await this.queue.resumeQueue();
        res.json({ success: true, message: "Queue resumed" });
        this.broadcastStatusUpdate();
      } catch (error) {
        res.status(500).json({ error: "Failed to resume queue" });
      }
    });

    this.app.get("/api/jobs", async (req, res) => {
      try {
        const jobs = await this.queue.getJobs([
          "waiting",
          "active",
          "completed",
          "failed",
        ]);
        const formattedJobs = jobs.map((job) => ({
          id: job.id,
          name: job.name,
          data: job.data,
          status: job.finishedOn
            ? "completed"
            : job.failedReason
              ? "failed"
              : job.processedOn
                ? "active"
                : "waiting",
          createdAt: job.timestamp,
          finishedAt: job.finishedOn,
          error: job.failedReason,
        }));

        res.json(formattedJobs);
      } catch (error) {
        res.status(500).json({ error: "Failed to get jobs" });
      }
    });

    this.app.post("/api/jobs/:jobId/retry", async (req, res) => {
      try {
        await this.queue.retryJob(req.params.jobId);
        res.json({ success: true, message: `Job ${req.params.jobId} retried` });
        this.broadcastStatusUpdate();
      } catch (error) {
        res.status(500).json({ error: "Failed to retry job" });
      }
    });

    this.app.delete("/api/jobs/:jobId", async (req, res) => {
      try {
        await this.queue.removeJob(req.params.jobId);
        res.json({ success: true, message: `Job ${req.params.jobId} removed` });
        this.broadcastStatusUpdate();
      } catch (error) {
        res.status(500).json({ error: "Failed to remove job" });
      }
    });

    this.app.get("/api/files", async (req, res) => {
      try {
        const files = this.db.getAllFiles();
        res.json(files);
      } catch (error) {
        res.status(500).json({ error: "Failed to get files" });
      }
    });

    this.app.post("/api/clear-completed", async (req, res) => {
      try {
        await this.queue.clearCompletedJobs();
        res.json({
          success: true,
          message: "Completed and failed jobs cleared",
        });
        this.broadcastStatusUpdate();
      } catch (error) {
        res.status(500).json({ error: "Failed to clear completed jobs" });
      }
    });

    // Serve the main page
    this.app.get("/", (req, res) => {
      res.sendFile(join(__dirname, "public", "index.html"));
    });
  }

  private setupWebSocket(): void {
    this.wss.on("connection", (ws) => {
      console.log("WebSocket client connected");

      // Send initial status
      this.sendStatusUpdate(ws);

      ws.on("close", () => {
        console.log("WebSocket client disconnected");
      });
    });

    // Send status updates every 5 seconds
    setInterval(() => {
      this.broadcastStatusUpdate();
    }, 5000);
  }

  private async sendStatusUpdate(ws: any): Promise<void> {
    try {
      const counts = await this.queue.getJobCounts();
      const isPaused = await this.queue.isPaused();

      ws.send(
        JSON.stringify({
          type: "status",
          data: {
            queue: counts,
            isPaused,
            timestamp: Date.now(),
          },
        })
      );
    } catch (error) {
      console.error("Failed to send status update:", error);
    }
  }

  private async broadcastStatusUpdate(): Promise<void> {
    const message = await this.getStatusMessage();
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        client.send(JSON.stringify(message));
      }
    });
  }

  private async getStatusMessage(): Promise<any> {
    try {
      const counts = await this.queue.getJobCounts();
      const isPaused = await this.queue.isPaused();

      return {
        type: "status",
        data: {
          queue: counts,
          isPaused,
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      return {
        type: "error",
        data: { message: "Failed to get status" },
      };
    }
  }

  public start(port: number = 3000): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        console.log(`🌐 Web interface running at http://localhost:${port}`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    this.wss.close();
    this.server.close();
    await this.queue.close();
    this.db.close();
  }
}
