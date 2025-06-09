import { QueueClient } from "../../../queue/client.js";

export default defineWebSocketHandler({
  async open(peer) {
    console.log("WebSocket client connected:", peer.toString());

    // Send initial status to the new client
    await sendStatusUpdate(peer);
  },

  async message(peer, message) {
    const messageStr = message.toString();

    // Handle ping/pong and other non-JSON messages
    if (messageStr === "ping") {
      peer.send("pong");
      return;
    }

    if (messageStr === "pong") {
      // Just acknowledge, no response needed
      return;
    }

    // Try to parse as JSON for actual data messages
    try {
      const data = JSON.parse(messageStr);

      // Handle different message types
      switch (data.type) {
        case "request_status":
          await sendStatusUpdate(peer);
          break;
        default:
          console.log("Unknown message type:", data.type);
      }
    } catch (error) {
      // Only log error if it's not a simple ping/pong message
      if (!["ping", "pong"].includes(messageStr)) {
        console.error("Error parsing WebSocket message:", messageStr, error);
      }
    }
  },

  close(peer) {
    console.log("WebSocket client disconnected:", peer.toString());
  },

  error(peer, error) {
    console.error("WebSocket error for peer", peer.toString(), ":", error);
  },
});

async function sendStatusUpdate(peer: any): Promise<void> {
  try {
    const config = useRuntimeConfig();
    const queue = new QueueClient(config.redisHost, parseInt(config.redisPort));
    const counts = await queue.getJobCounts();
    const isPaused = await queue.isPaused();

    peer.send(
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
    peer.send(
      JSON.stringify({
        type: "error",
        message: "Failed to get status",
      })
    );
  }
}

// Broadcast status updates every 5 seconds to all connected clients
let broadcastInterval: NodeJS.Timeout | null = null;

// Start broadcasting when the first client connects
export function startBroadcasting() {
  if (broadcastInterval) return;

  broadcastInterval = setInterval(async () => {
    try {
      const config = useRuntimeConfig();
      const queue = new QueueClient(
        config.redisHost,
        parseInt(config.redisPort)
      );
      const counts = await queue.getJobCounts();
      const isPaused = await queue.isPaused();

      const _statusMessage = JSON.stringify({
        type: "status",
        data: {
          queue: counts,
          isPaused,
          timestamp: Date.now(),
        },
      });

      // This would need a way to access all connected peers
      // For now, we'll rely on client-side polling or manual requests
      console.log("Broadcasting status update");
    } catch (error) {
      console.error("Failed to broadcast status update:", error);
    }
  }, 5000);
}

export function stopBroadcasting() {
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
    broadcastInterval = null;
  }
}
