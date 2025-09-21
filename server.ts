import express from "express";
import ViteExpress from "vite-express";
import apiRoutes from "./src/pages/api";

const app = express();

app.use(express.json());
app.use("/api", apiRoutes);

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000...")
);
