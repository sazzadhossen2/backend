import { config } from "./src/config/config.js";
import { connectDB } from "./src/config/db.js";
import app from "./app.js";

const start = async () => {
  try {
    await connectDB();
    app.listen(config.port, () => {
      console.log(`API running on port ${config.port} (${config.env})`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

start();
