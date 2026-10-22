import { registerAuthEmailHandlers } from "./auth/emails";

// Handlers live in an in-memory registry, so every place that processes jobs imports this file
// for its side effect (the after-response sender and the cron sweep). Registering twice is harmless.
// Add each new kind's registration here.
registerAuthEmailHandlers();
